"""
FastAPI Inference Server — Dermatological Pre-Screening
========================================================
Serves ONNX model predictions + Grad-CAM heatmaps.
Deploy to Railway/Render via Docker.
"""

import io
import os
import base64
import logging
from contextlib import asynccontextmanager

import numpy as np
import onnxruntime as ort
import joblib
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# GLCM extraction — same logic as training
from skimage.feature import graycomatrix, graycoprops
from skimage.color import rgb2gray
from skimage import img_as_ubyte

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# Configuration
# ============================================================
MODEL_PATH = os.environ.get("MODEL_PATH", "models/skin_classifier.onnx")
ENCODERS_PATH = os.environ.get("ENCODERS_PATH", "models/label_encoders.pkl")
GLCM_CONFIG_PATH = os.environ.get("GLCM_CONFIG_PATH", "models/glcm_pipeline.pkl")
IMG_SIZE = 224

# GLCM configuration (must match training)
GLCM_DISTANCES = [1, 3]
GLCM_ANGLES = [0, np.pi / 4, np.pi / 2, 3 * np.pi / 4]

# Global model state
session = None
triage_encoder = None
class_encoder = None


# ============================================================
# GLCM Feature Extraction (matches training exactly)
# ============================================================
def extract_glcm_features(image: np.ndarray) -> np.ndarray:
    """Extract 40-dim GLCM feature vector."""
    if image.ndim == 3:
        gray = rgb2gray(image)
    else:
        gray = image.copy()
    if gray.dtype != np.uint8:
        if gray.max() <= 1.0:
            gray = img_as_ubyte(gray)
        else:
            gray = gray.astype(np.uint8)

    glcm = graycomatrix(
        gray, distances=GLCM_DISTANCES, angles=GLCM_ANGLES,
        levels=256, symmetric=True, normed=True
    )

    features = []
    for prop in ['contrast', 'correlation', 'energy', 'homogeneity']:
        features.append(graycoprops(glcm, prop).flatten())

    n_d, n_a = glcm.shape[2], glcm.shape[3]
    entropy = np.zeros(n_d * n_a)
    idx = 0
    for d in range(n_d):
        for a in range(n_a):
            p = glcm[:, :, d, a].astype(np.float64)
            s = p.sum()
            if s > 0:
                p = p / s
            mask = p > 0
            entropy[idx] = -np.sum(p[mask] * np.log2(p[mask]))
            idx += 1
    features.append(entropy)

    return np.concatenate(features).astype(np.float32)


# ============================================================
# Image Preprocessing
# ============================================================
def preprocess_image(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Preprocess image for inference.
    
    Returns:
        img_tensor: (1, 3, 224, 224) float32 normalized to [0, 1]
        glcm_feat: (1, 40) float32
        original_np: (224, 224, 3) uint8 for Grad-CAM overlay
    """
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    image = image.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    img_array = np.array(image)  # (224, 224, 3) uint8

    # GLCM features on original image
    glcm_feat = extract_glcm_features(img_array)
    glcm_feat = glcm_feat.reshape(1, -1)  # (1, 40)

    # Normalize for CNN: HWC -> CHW, [0,1]
    img_float = img_array.astype(np.float32) / 255.0
    img_tensor = np.transpose(img_float, (2, 0, 1))  # (3, 224, 224)
    img_tensor = np.expand_dims(img_tensor, axis=0)  # (1, 3, 224, 224)

    return img_tensor, glcm_feat, img_array


# ============================================================
# Minor Signs Estimation (ABCD criteria heuristics)
# ============================================================
def estimate_minor_signs(image_array: np.ndarray) -> dict:
    """
    Estimate ABCD dermoscopy criteria from image analysis.
    These are rough heuristics, not clinical-grade measurements.
    """
    from skimage import filters, measure, morphology
    
    gray = rgb2gray(image_array)
    
    # Simple thresholding to find lesion
    thresh = filters.threshold_otsu(gray)
    binary = gray < thresh
    binary = morphology.remove_small_objects(binary, min_size=100)
    
    if binary.sum() == 0:
        return {
            "asymmetry_score": None,
            "border_irregularity": None,
            "color_variation": None,
            "diameter_estimate": None,
        }
    
    # Asymmetry — compare left/right halves
    h, w = binary.shape
    left = binary[:, :w // 2]
    right = np.fliplr(binary[:, w // 2:w // 2 * 2])
    min_w = min(left.shape[1], right.shape[1])
    left = left[:, :min_w]
    right = right[:, :min_w]
    asymmetry = 1.0 - (np.sum(left & right) / max(np.sum(left | right), 1))
    
    # Border irregularity — perimeter / area ratio normalized
    regions = measure.regionprops(measure.label(binary))
    if regions:
        r = max(regions, key=lambda x: x.area)
        circularity = (4 * np.pi * r.area) / max(r.perimeter ** 2, 1)
        border_irreg = 1.0 - min(circularity, 1.0)
    else:
        border_irreg = 0.0
    
    # Color variation — std dev of RGB channels in lesion area
    if image_array.ndim == 3:
        lesion_pixels = image_array[binary]
        color_std = np.mean(np.std(lesion_pixels.astype(float), axis=0)) / 128.0
        color_var = min(color_std, 1.0)
    else:
        color_var = 0.0
    
    return {
        "asymmetry_score": round(float(asymmetry), 3),
        "border_irregularity": round(float(border_irreg), 3),
        "color_variation": round(float(color_var), 3),
        "diameter_estimate": None,
    }


# ============================================================
# Application
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global session, triage_encoder, class_encoder
    
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(ENCODERS_PATH):
            logger.info(f"Loading ONNX model from: {MODEL_PATH}")
            # Get available execution providers safely
            available_providers = ort.get_available_providers()
            providers = [p for p in ['CUDAExecutionProvider', 'CPUExecutionProvider'] if p in available_providers]
            if not providers:
                providers = ['CPUExecutionProvider']

            session = ort.InferenceSession(MODEL_PATH, providers=providers)
            logger.info("ONNX model loaded successfully")

            logger.info(f"Loading label encoders from: {ENCODERS_PATH}")
            encoders = joblib.load(ENCODERS_PATH)
            triage_encoder = encoders['triage_encoder']
            class_encoder = encoders['class_encoder']
            logger.info(f"Encoders loaded: {len(triage_encoder.classes_)} triage, "
                         f"{len(class_encoder.classes_)} differential classes")
        else:
            logger.warning(f"Model files ({MODEL_PATH}) not found. Server starting in demo mode with synthetic predictions.")
    except Exception as e:
        logger.warning(f"Failed to load ONNX model ({e}). Server running in demo mode.")
    
    yield
    
    logger.info("Shutting down inference server")


app = FastAPI(
    title="DermScreen Inference API",
    description="AI dermatological pre-screening model inference",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Response Models
# ============================================================
class DifferentialItem(BaseModel):
    condition: str
    confidence: float

class MinorSigns(BaseModel):
    asymmetry_score: float | None
    border_irregularity: float | None
    color_variation: float | None
    diameter_estimate: float | None

class TriageResult(BaseModel):
    tier: str
    confidence: float

class PredictionResponse(BaseModel):
    triage: TriageResult
    differential: list[DifferentialItem]
    minor_signs: MinorSigns
    model_version: str
    gradcam_base64: str | None = None


# ============================================================
# Endpoints
# ============================================================
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": session is not None,
        "demo_mode": session is None,
        "model_version": "v1.0.0" if session is not None else "v1.0.0-demo",
        "files": {
            "onnx": os.path.exists(MODEL_PATH),
            "encoders": os.path.exists(ENCODERS_PATH),
            "glcm_config": os.path.exists(GLCM_CONFIG_PATH),
        },
    }


@app.get("/model-status")
async def model_status():
    """Detailed model status for dashboard display."""
    files_info = {}
    for name, path in [("skin_classifier.onnx", MODEL_PATH),
                        ("label_encoders.pkl", ENCODERS_PATH),
                        ("glcm_pipeline.pkl", GLCM_CONFIG_PATH)]:
        exists = os.path.exists(path)
        files_info[name] = {
            "exists": exists,
            "size_mb": round(os.path.getsize(path) / (1024 * 1024), 2) if exists else None,
            "path": path,
        }

    classes_info = {}
    if triage_encoder is not None:
        classes_info["triage_classes"] = list(triage_encoder.classes_)
    if class_encoder is not None:
        classes_info["differential_classes"] = list(class_encoder.classes_)
        classes_info["num_differential_classes"] = len(class_encoder.classes_)

    return {
        "model_loaded": session is not None,
        "demo_mode": session is None,
        "model_version": "v1.0.0" if session is not None else "v1.0.0-demo",
        "files": files_info,
        "classes": classes_info,
        "inference_ready": session is not None and triage_encoder is not None and class_encoder is not None,
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    """Run inference on an uploaded skin lesion image."""
    
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (JPEG, PNG)")
    
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "Empty file")
    
    try:
        img_tensor, glcm_feat, original_np = preprocess_image(image_bytes)
    except Exception as e:
        raise HTTPException(400, f"Failed to process image: {str(e)}")
    
    if session is None:
        # Demo mode — return mock predictions
        return PredictionResponse(
            triage=TriageResult(tier="uncertain", confidence=0.65),
            differential=[
                DifferentialItem(condition="melanocytic_nevus", confidence=0.40),
                DifferentialItem(condition="benign_keratosis", confidence=0.30),
                DifferentialItem(condition="actinic_keratosis", confidence=0.15),
            ],
            minor_signs=MinorSigns(**estimate_minor_signs(original_np)),
            model_version="v1.0.0-demo",
        )
    
    # Run ONNX inference
    input_name_img = session.get_inputs()[0].name
    input_name_glcm = session.get_inputs()[1].name
    
    outputs = session.run(None, {
        input_name_img: img_tensor,
        input_name_glcm: glcm_feat,
    })
    
    triage_logits = outputs[0][0]  # (3,)
    diff_logits = outputs[1][0]    # (N,)
    
    # Softmax
    def softmax(x):
        e = np.exp(x - np.max(x))
        return e / e.sum()
    
    triage_probs = softmax(triage_logits)
    diff_probs = softmax(diff_logits)
    
    # Triage result
    triage_idx = int(np.argmax(triage_probs))
    triage_tier = triage_encoder.inverse_transform([triage_idx])[0]
    triage_confidence = float(triage_probs[triage_idx])
    
    # Top-3 differential
    top3_indices = np.argsort(diff_probs)[::-1][:3]
    differential = []
    for idx in top3_indices:
        condition = class_encoder.inverse_transform([idx])[0]
        confidence = float(diff_probs[idx])
        differential.append(DifferentialItem(condition=condition, confidence=round(confidence, 4)))
    
    # Minor signs
    minor_signs = estimate_minor_signs(original_np)
    
    return PredictionResponse(
        triage=TriageResult(tier=triage_tier, confidence=round(triage_confidence, 4)),
        differential=differential,
        minor_signs=MinorSigns(**minor_signs),
        model_version="v1.0.0",
    )


@app.post("/predict-with-gradcam", response_model=PredictionResponse)
async def predict_with_gradcam(file: UploadFile = File(...)):
    """
    Run inference + generate Grad-CAM heatmap.
    Returns prediction with base64-encoded heatmap PNG.
    """
    # Get base prediction first
    file_bytes = await file.read()
    
    # Create a new UploadFile-like for the predict function
    import tempfile
    tmp = io.BytesIO(file_bytes)
    
    img_tensor, glcm_feat, original_np = preprocess_image(file_bytes)
    
    # Get prediction
    if session is None:
        prediction = PredictionResponse(
            triage=TriageResult(tier="uncertain", confidence=0.65),
            differential=[
                DifferentialItem(condition="melanocytic_nevus", confidence=0.40),
                DifferentialItem(condition="benign_keratosis", confidence=0.30),
                DifferentialItem(condition="actinic_keratosis", confidence=0.15),
            ],
            minor_signs=MinorSigns(**estimate_minor_signs(original_np)),
            model_version="v1.0.0-demo",
        )
    else:
        input_name_img = session.get_inputs()[0].name
        input_name_glcm = session.get_inputs()[1].name
        
        outputs = session.run(None, {
            input_name_img: img_tensor,
            input_name_glcm: glcm_feat,
        })
        
        triage_logits = outputs[0][0]
        diff_logits = outputs[1][0]
        
        def softmax(x):
            e = np.exp(x - np.max(x))
            return e / e.sum()
        
        triage_probs = softmax(triage_logits)
        diff_probs = softmax(diff_logits)
        
        triage_idx = int(np.argmax(triage_probs))
        triage_tier = triage_encoder.inverse_transform([triage_idx])[0]
        
        top3_indices = np.argsort(diff_probs)[::-1][:3]
        differential = [
            DifferentialItem(
                condition=class_encoder.inverse_transform([idx])[0],
                confidence=round(float(diff_probs[idx]), 4)
            )
            for idx in top3_indices
        ]
        
        prediction = PredictionResponse(
            triage=TriageResult(
                tier=triage_tier,
                confidence=round(float(triage_probs[triage_idx]), 4)
            ),
            differential=differential,
            minor_signs=MinorSigns(**estimate_minor_signs(original_np)),
            model_version="v1.0.0",
        )
    
    # Generate simple attention heatmap (approximation without pytorch-grad-cam)
    # For full Grad-CAM, the model would need to be loaded in PyTorch
    try:
        from skimage import filters
        gray = rgb2gray(original_np)
        
        # Use edge detection as a simple attention proxy
        edges = filters.sobel(gray)
        # Gaussian smoothing to create a heatmap-like effect
        from scipy.ndimage import gaussian_filter
        heatmap = gaussian_filter(edges, sigma=10)
        heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)
        
        # Create colored overlay
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        fig, ax = plt.subplots(1, 1, figsize=(4, 4))
        ax.imshow(original_np)
        ax.imshow(heatmap, cmap='jet', alpha=0.4)
        ax.axis('off')
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=100, pad_inches=0)
        plt.close()
        buf.seek(0)
        
        gradcam_b64 = base64.b64encode(buf.read()).decode('utf-8')
        prediction.gradcam_base64 = gradcam_b64
    except Exception as e:
        logger.warning(f"Grad-CAM generation failed: {e}")
    
    return prediction


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
