"""
GLCM Texture Feature Extraction Utilities
==========================================
Used in both training (Kaggle) and inference (FastAPI).
Computes Gray-Level Co-occurrence Matrix features:
  contrast, correlation, energy, homogeneity, entropy

Computed at 4 angles (0°, 45°, 90°, 135°) × 2 distances (1, 3)
= 8 GLCM matrices → 5 features each = 40-dimensional feature vector.
"""

import numpy as np
from skimage.feature import graycomatrix, graycoprops
from skimage.color import rgb2gray
from skimage import img_as_ubyte


# Configuration — must match exactly between training and inference
GLCM_DISTANCES = [1, 3]
GLCM_ANGLES = [0, np.pi / 4, np.pi / 2, 3 * np.pi / 4]
GLCM_LEVELS = 256
GLCM_PROPERTIES = ['contrast', 'correlation', 'energy', 'homogeneity']
# Entropy is computed separately (not a built-in skimage property)


def compute_entropy(glcm: np.ndarray) -> np.ndarray:
    """
    Compute Shannon entropy from a GLCM matrix.
    
    Args:
        glcm: GLCM array of shape (levels, levels, n_distances, n_angles)
    
    Returns:
        Entropy values of shape (n_distances, n_angles)
    """
    # Normalize each GLCM slice to get probabilities
    n_dist = glcm.shape[2]
    n_ang = glcm.shape[3]
    entropy = np.zeros((n_dist, n_ang))
    
    for d in range(n_dist):
        for a in range(n_ang):
            p = glcm[:, :, d, a].astype(np.float64)
            p_sum = p.sum()
            if p_sum > 0:
                p = p / p_sum
            # Avoid log(0)
            mask = p > 0
            entropy[d, a] = -np.sum(p[mask] * np.log2(p[mask]))
    
    return entropy


def extract_glcm_features(image: np.ndarray) -> np.ndarray:
    """
    Extract GLCM texture features from an image.
    
    Args:
        image: Input image as numpy array. Can be:
               - RGB float [0, 1] of shape (H, W, 3)
               - RGB uint8 [0, 255] of shape (H, W, 3)
               - Grayscale float [0, 1] of shape (H, W)
               - Grayscale uint8 [0, 255] of shape (H, W)
    
    Returns:
        1D numpy array of 40 GLCM features:
        [contrast_d1a0, contrast_d1a1, ..., entropy_d3a3]
    """
    # Convert to grayscale if needed
    if image.ndim == 3:
        gray = rgb2gray(image)
    else:
        gray = image.copy()
    
    # Ensure uint8 for GLCM computation
    if gray.dtype != np.uint8:
        if gray.max() <= 1.0:
            gray = img_as_ubyte(gray)
        else:
            gray = gray.astype(np.uint8)
    
    # Compute GLCM
    glcm = graycomatrix(
        gray,
        distances=GLCM_DISTANCES,
        angles=GLCM_ANGLES,
        levels=GLCM_LEVELS,
        symmetric=True,
        normed=True
    )
    
    # Extract standard properties
    features = []
    for prop in GLCM_PROPERTIES:
        prop_values = graycoprops(glcm, prop)  # shape: (n_distances, n_angles)
        features.append(prop_values.flatten())
    
    # Compute entropy
    entropy_values = compute_entropy(glcm)  # shape: (n_distances, n_angles)
    features.append(entropy_values.flatten())
    
    # Concatenate all: 4 props × 8 combos + 1 entropy × 8 combos = 40
    feature_vector = np.concatenate(features).astype(np.float32)
    
    return feature_vector


def get_feature_names() -> list:
    """Return ordered list of feature names for interpretability."""
    names = []
    all_props = GLCM_PROPERTIES + ['entropy']
    for prop in all_props:
        for d in GLCM_DISTANCES:
            for a_idx, a in enumerate(GLCM_ANGLES):
                angle_deg = int(np.degrees(a))
                names.append(f"{prop}_d{d}_a{angle_deg}")
    return names


if __name__ == "__main__":
    # Quick test with a random image
    test_img = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    features = extract_glcm_features(test_img)
    names = get_feature_names()
    print(f"Feature vector shape: {features.shape}")
    print(f"Feature names ({len(names)}): {names[:5]} ... {names[-5:]}")
    print(f"First 5 values: {features[:5]}")
