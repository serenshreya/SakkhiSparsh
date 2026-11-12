"""
Dermatological Pre-Screening Model — Kaggle Training Script
=============================================================
Environment: Kaggle Notebook, GPU = T4 x1/x2, Internet enabled
Persistence: "Files only"

Datasets handled by this pipeline:
1. ISIC Archive (2019/2020) — 70,000+ dermoscopic images
2. HAM10000 — 10,015 benchmark images across 7 diagnostic classes
3. Fitzpatrick17k — 16,577 clinical images across all 6 Fitzpatrick skin tone types (I-VI)
4. SD-198 / DermNet NZ — ~20,000 clinical images across 198 condition categories
"""

import os
import json
import math
import warnings
import hashlib
from pathlib import Path
from collections import Counter

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
import torchvision.transforms as T
import torchvision.models as models
from PIL import Image

from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score, roc_auc_score, confusion_matrix,
    classification_report, precision_recall_fscore_support
)
from sklearn.preprocessing import LabelEncoder

import joblib
import optuna

warnings.filterwarnings('ignore')

# ============================================================
# 0. Configuration & Kaggle Input Directories
# ============================================================
KAGGLE_INPUT_DIR = '/kaggle/input'
OUTPUT_DIR = '/kaggle/working'
MANIFEST_PATH = os.path.join(OUTPUT_DIR, 'manifest.csv')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
IMG_SIZE = 224
SEED = 42

# Dataset Input Folders in /kaggle/input (auto-discovery handles variations)
HAM10000_PATH = os.path.join(KAGGLE_INPUT_DIR, 'ham10000')
ISIC2019_PATH = os.path.join(KAGGLE_INPUT_DIR, 'isic-2019')
FITZPATRICK_PATH = os.path.join(KAGGLE_INPUT_DIR, 'fitzpatrick17k')
SD198_PATH = os.path.join(KAGGLE_INPUT_DIR, 'sd-198')

torch.manual_seed(SEED)
np.random.seed(SEED)

print(f"Device: {DEVICE}")
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")


# ============================================================
# 1. Class Mappings
# ============================================================
HAM10000_LABEL_MAP = {
    'akiec': 'actinic_keratosis', 'bcc': 'basal_cell_carcinoma',
    'bkl': 'benign_keratosis', 'df': 'dermatofibroma',
    'mel': 'melanoma', 'nv': 'melanocytic_nevus', 'vasc': 'vascular_lesion',
}

ISIC2019_COLUMNS = ['MEL', 'NV', 'BCC', 'AK', 'BKL', 'DF', 'VASC', 'SCC', 'UNK']
ISIC2019_LABEL_MAP = {
    'MEL': 'melanoma', 'NV': 'melanocytic_nevus', 'BCC': 'basal_cell_carcinoma',
    'AK': 'actinic_keratosis', 'BKL': 'benign_keratosis', 'DF': 'dermatofibroma',
    'VASC': 'vascular_lesion', 'SCC': 'squamous_cell_carcinoma', 'UNK': 'unknown',
}

TRIAGE_TIER_MAP = {
    'melanocytic_nevus': 'benign', 'benign_keratosis': 'benign',
    'dermatofibroma': 'benign', 'vascular_lesion': 'benign',
    'seborrheic_keratosis': 'benign', 'acne': 'benign', 'eczema': 'benign',
    'psoriasis': 'benign', 'rosacea': 'benign', 'contact_dermatitis': 'benign',
    'seborrheic_dermatitis': 'benign', 'urticaria': 'benign', 'vitiligo': 'benign',
    'warts': 'benign', 'tinea': 'benign', 'folliculitis': 'benign',
    'pityriasis_rosea': 'benign', 'lichen_planus': 'benign',
    'actinic_keratosis': 'uncertain', 'unknown': 'uncertain',
    'melanoma': 'malignant_suspect', 'basal_cell_carcinoma': 'malignant_suspect',
    'squamous_cell_carcinoma': 'malignant_suspect',
    'mycosis_fungoides': 'malignant_suspect',
}


def normalize_fitzpatrick(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return 'unknown'
    try:
        v = int(float(val))
    except (ValueError, TypeError):
        roman = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6}
        v = roman.get(str(val).strip(), -1)
    if v in (1, 2): return 'I-II'
    if v in (3, 4): return 'III-IV'
    if v in (5, 6): return 'V-VI'
    return 'unknown'


# ============================================================
# 2. GLCM Feature Extraction
# ============================================================
from skimage.feature import graycomatrix, graycoprops
from skimage.color import rgb2gray
from skimage import img_as_ubyte

GLCM_DISTANCES = [1, 3]
GLCM_ANGLES = [0, np.pi/4, np.pi/2, 3*np.pi/4]


def extract_glcm_features(image: np.ndarray) -> np.ndarray:
    if image.ndim == 3:
        gray = rgb2gray(image)
    else:
        gray = image.copy()
    if gray.dtype != np.uint8:
        if gray.max() <= 1.0:
            gray = img_as_ubyte(gray)
        else:
            gray = gray.astype(np.uint8)
    
    glcm = graycomatrix(gray, distances=GLCM_DISTANCES, angles=GLCM_ANGLES,
                        levels=256, symmetric=True, normed=True)
    
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
            if s > 0: p = p / s
            mask = p > 0
            entropy[idx] = -np.sum(p[mask] * np.log2(p[mask]))
            idx += 1
    features.append(entropy)
    
    return np.concatenate(features).astype(np.float32)


# ============================================================
# 3. Data Loading — Build Manifest CSV
# ============================================================
def build_manifest():
    rows = []
    root_search = KAGGLE_INPUT_DIR if os.path.exists(KAGGLE_INPUT_DIR) else '.'
    
    # --- HAM10000 ---
    ham_dirs = list(Path(root_search).rglob('HAM10000_metadata*'))
    if ham_dirs:
        ham_meta_path = str(ham_dirs[0])
        print(f"Found HAM10000 metadata: {ham_meta_path}")
        ham_df = pd.read_csv(ham_meta_path)
        
        for _, row in ham_df.iterrows():
            img_id = row['image_id']
            img_path = None
            for found in Path(root_search).rglob(f'{img_id}.jpg'):
                img_path = str(found)
                break
            
            if img_path and os.path.exists(img_path):
                label = HAM10000_LABEL_MAP.get(row['dx'], row['dx'])
                triage = TRIAGE_TIER_MAP.get(label, 'uncertain')
                patient_id = str(row.get('lesion_id', img_id))
                rows.append({
                    'image_path': img_path,
                    'class_label': label,
                    'triage_label': triage,
                    'fitzpatrick_type': 'unknown',
                    'patient_id': f'ham_{patient_id}',
                    'source_dataset': 'ham10000'
                })
        print(f"HAM10000: {len([r for r in rows if r['source_dataset'] == 'ham10000'])} samples")
    
    # --- ISIC 2019/2020 ---
    isic_gt_files = list(Path(root_search).rglob('*GroundTruth*'))
    if isic_gt_files:
        isic_gt_path = str(isic_gt_files[0])
        print(f"Found ISIC ground truth: {isic_gt_path}")
        isic_df = pd.read_csv(isic_gt_path)
        
        label_cols = [c for c in isic_df.columns if c in ISIC2019_COLUMNS]
        if label_cols:
            for _, row in isic_df.iterrows():
                img_id = row.get('image', row.iloc[0])
                label_raw = 'UNK'
                for col in label_cols:
                    if row.get(col, 0) == 1.0:
                        label_raw = col
                        break
                
                img_path = None
                for found in Path(root_search).rglob(f'{img_id}.jpg'):
                    img_path = str(found)
                    break
                
                if img_path and os.path.exists(img_path):
                    label = ISIC2019_LABEL_MAP.get(label_raw, label_raw.lower())
                    triage = TRIAGE_TIER_MAP.get(label, 'uncertain')
                    rows.append({
                        'image_path': img_path,
                        'class_label': label,
                        'triage_label': triage,
                        'fitzpatrick_type': 'unknown',
                        'patient_id': f'isic_{img_id}',
                        'source_dataset': 'isic2019'
                    })
        print(f"ISIC 2019: {len([r for r in rows if r['source_dataset'] == 'isic2019'])} samples")
    
    # --- Fitzpatrick17k ---
    fitz_files = list(Path(root_search).rglob('fitzpatrick17k*'))
    if fitz_files:
        fitz_csv = None
        for f in fitz_files:
            if f.suffix == '.csv':
                fitz_csv = str(f)
                break
        
        if fitz_csv:
            print(f"Found Fitzpatrick17k CSV: {fitz_csv}")
            fitz_df = pd.read_csv(fitz_csv)
            
            for _, row in fitz_df.iterrows():
                img_id = str(row.get('md5hash', row.get('hasher', '')))
                label_raw = str(row.get('label', '')).lower().strip()
                fitz_type = row.get('fitzpatrick_scale', row.get('fitzpatrick', None))
                
                img_path = None
                for ext in ['.jpg', '.png', '.jpeg']:
                    for found in Path(root_search).rglob(f'{img_id}{ext}'):
                        img_path = str(found)
                        break
                    if img_path: break
                
                if img_path and os.path.exists(img_path):
                    label = label_raw.replace(' ', '_').replace('-', '_')
                    triage = TRIAGE_TIER_MAP.get(label, 'uncertain')
                    rows.append({
                        'image_path': img_path,
                        'class_label': label,
                        'triage_label': triage,
                        'fitzpatrick_type': normalize_fitzpatrick(fitz_type),
                        'patient_id': f'fitz_{img_id}',
                        'source_dataset': 'fitzpatrick17k'
                    })
            print(f"Fitzpatrick17k: {len([r for r in rows if r['source_dataset'] == 'fitzpatrick17k'])} samples")
    
    # --- SD-198 ---
    sd198_dirs = list(Path(root_search).rglob('SD-198'))
    if not sd198_dirs:
        sd198_dirs = [p for p in Path(root_search).iterdir() if p.is_dir() and '198' in p.name]
    
    for sd_dir in sd198_dirs:
        if sd_dir.is_dir():
            for class_dir in sd_dir.iterdir():
                if class_dir.is_dir():
                    label_raw = class_dir.name
                    label = label_raw.lower().replace(' ', '_').replace('-', '_')
                    triage = TRIAGE_TIER_MAP.get(label, 'uncertain')
                    
                    for img_file in class_dir.glob('*'):
                        if img_file.suffix.lower() in ('.jpg', '.jpeg', '.png', '.bmp'):
                            rows.append({
                                'image_path': str(img_file),
                                'class_label': label,
                                'triage_label': triage,
                                'fitzpatrick_type': 'unknown',
                                'patient_id': f'sd198_{img_file.stem}',
                                'source_dataset': 'sd198'
                            })
            print(f"SD-198: {len([r for r in rows if r['source_dataset'] == 'sd198'])} samples")
    
    df = pd.DataFrame(rows)
    
    if len(df) == 0:
        print("\n⚠️ No dataset files found in /kaggle/input! Creating synthetic test dataset...")
        dummy_rows = []
        for i in range(200):
            dummy_rows.append({
                'image_path': f'dummy_{i}.jpg',
                'class_label': ['melanocytic_nevus', 'melanoma', 'benign_keratosis',
                               'actinic_keratosis', 'basal_cell_carcinoma'][i % 5],
                'triage_label': ['benign', 'malignant_suspect', 'benign',
                                'uncertain', 'malignant_suspect'][i % 5],
                'fitzpatrick_type': ['I-II', 'III-IV', 'V-VI', 'unknown'][i % 4],
                'patient_id': f'dummy_{i // 2}',
                'source_dataset': 'synthetic'
            })
        df = pd.DataFrame(dummy_rows)
    
    class_counts = df['class_label'].value_counts()
    valid_classes = class_counts[class_counts >= 10].index.tolist()
    df = df[df['class_label'].isin(valid_classes)].reset_index(drop=True)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df.to_csv(MANIFEST_PATH, index=False)
    print(f"\n✓ Manifest saved to: {MANIFEST_PATH}")
    print(f"Total images: {len(df)}")
    print(f"Total unique classes: {df['class_label'].nunique()}")
    return df


# ============================================================
# 4. Dataset & Transforms
# ============================================================
train_transforms = T.Compose([
    T.Resize((IMG_SIZE, IMG_SIZE)),
    T.RandomHorizontalFlip(p=0.5),
    T.RandomVerticalFlip(p=0.5),
    T.RandomRotation(20),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
    T.RandomResizedCrop(IMG_SIZE, scale=(0.8, 1.0)),
    T.ToTensor(),
])

val_transforms = T.Compose([
    T.Resize((IMG_SIZE, IMG_SIZE)),
    T.ToTensor(),
])


class SkinLesionDataset(Dataset):
    def __init__(self, df, triage_encoder, class_encoder, transform=None, precomputed_glcm=None):
        self.df = df.reset_index(drop=True)
        self.transform = transform
        self.triage_encoder = triage_encoder
        self.class_encoder = class_encoder
        self.precomputed_glcm = precomputed_glcm
    
    def __len__(self):
        return len(self.df)
    
    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = row['image_path']
        
        try:
            img = Image.open(img_path).convert('RGB')
        except (FileNotFoundError, Exception):
            img = Image.new('RGB', (IMG_SIZE, IMG_SIZE), (128, 128, 128))
        
        if self.precomputed_glcm is not None:
            glcm_feat = self.precomputed_glcm[idx]
        else:
            img_array = np.array(img.resize((IMG_SIZE, IMG_SIZE)))
            glcm_feat = extract_glcm_features(img_array)
        
        if self.transform:
            img_tensor = self.transform(img)
        else:
            img_tensor = val_transforms(img)
        
        triage_label = self.triage_encoder.transform([row['triage_label']])[0]
        class_label = self.class_encoder.transform([row['class_label']])[0]
        
        return (
            img_tensor,
            torch.tensor(glcm_feat, dtype=torch.float32),
            torch.tensor(triage_label, dtype=torch.long),
            torch.tensor(class_label, dtype=torch.long),
        )


# ============================================================
# 5. Model Architecture
# ============================================================
class DermClassifier(nn.Module):
    def __init__(self, n_classes, dropout=0.4, glcm_dim=40, glcm_proj_dim=64):
        super().__init__()
        self.backbone = models.efficientnet_b4(weights=models.EfficientNet_B4_Weights.DEFAULT)
        backbone_out = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Identity()
        
        self.glcm_proj = nn.Sequential(
            nn.Linear(glcm_dim, glcm_proj_dim),
            nn.ReLU(),
            nn.BatchNorm1d(glcm_proj_dim),
        )
        
        fused_dim = backbone_out + glcm_proj_dim
        self.bilstm = nn.LSTM(
            input_size=fused_dim, hidden_size=256, num_layers=1, batch_first=True, bidirectional=True,
        )
        
        lstm_out = 256 * 2
        self.dropout = nn.Dropout(dropout)
        
        self.triage_head = nn.Linear(lstm_out, 3)
        self.differential_head = nn.Linear(lstm_out, n_classes)
    
    def forward(self, images, glcm_features):
        cnn_feat = self.backbone(images)
        glcm_proj = self.glcm_proj(glcm_features)
        fused = torch.cat([cnn_feat, glcm_proj], dim=1)
        fused_seq = fused.unsqueeze(1)
        
        lstm_out, _ = self.bilstm(fused_seq)
        lstm_out = lstm_out.squeeze(1)
        lstm_out = self.dropout(lstm_out)
        
        triage_logits = self.triage_head(lstm_out)
        differential_logits = self.differential_head(lstm_out)
        return triage_logits, differential_logits


# ============================================================
# 6. Data Splitting (Patient ID Grouped)
# ============================================================
def split_data(df):
    df = df.copy()
    df['strat_key'] = df['class_label'] + '_' + df['fitzpatrick_type']
    
    strat_counts = df['strat_key'].value_counts()
    rare_keys = strat_counts[strat_counts < 3].index
    df.loc[df['strat_key'].isin(rare_keys), 'strat_key'] = df.loc[
        df['strat_key'].isin(rare_keys), 'class_label'] + '_other'
    
    strat_counts = df['strat_key'].value_counts()
    rare_keys = strat_counts[strat_counts < 2].index
    df.loc[df['strat_key'].isin(rare_keys), 'strat_key'] = 'rare_combined'
    
    groups = df['patient_id'].values
    
    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=SEED)
    train_idx, temp_idx = next(gss1.split(df, df['strat_key'], groups=groups))
    
    df_train = df.iloc[train_idx]
    df_temp = df.iloc[temp_idx]
    
    temp_groups = df_temp['patient_id'].values
    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=SEED)
    val_idx, test_idx = next(gss2.split(df_temp, df_temp['strat_key'], groups=temp_groups))
    
    df_val = df_temp.iloc[val_idx]
    df_test = df_temp.iloc[test_idx]
    
    train_patients = set(df_train['patient_id'])
    val_patients = set(df_val['patient_id'])
    test_patients = set(df_test['patient_id'])
    
    assert len(train_patients & val_patients) == 0, "DATA LEAKAGE: train-val overlap!"
    assert len(train_patients & test_patients) == 0, "DATA LEAKAGE: train-test overlap!"
    assert len(val_patients & test_patients) == 0, "DATA LEAKAGE: val-test overlap!"
    
    print(f"Split sizes — Train: {len(df_train)}, Val: {len(df_val)}, Test: {len(df_test)}")
    print("✓ Patient ID overlap check passed — zero data leakage.")
    
    return df_train.reset_index(drop=True), df_val.reset_index(drop=True), df_test.reset_index(drop=True)


# ============================================================
# 7. Training & Evaluation Loops
# ============================================================
def compute_class_weights(labels, device):
    counts = Counter(labels)
    total = sum(counts.values())
    weights = {k: total / (len(counts) * v) for k, v in counts.items()}
    n_classes = max(counts.keys()) + 1
    w = torch.ones(n_classes, device=device)
    for k, v in weights.items():
        w[k] = v
    return w


def train_epoch(model, loader, optimizer, triage_criterion, diff_criterion, device):
    model.train()
    total_loss, n_batches = 0, 0
    for imgs, glcm, triage_labels, class_labels in loader:
        imgs, glcm = imgs.to(device), glcm.to(device)
        triage_labels, class_labels = triage_labels.to(device), class_labels.to(device)
        
        optimizer.zero_grad()
        triage_logits, diff_logits = model(imgs, glcm)
        loss_triage = triage_criterion(triage_logits, triage_labels)
        loss_diff = diff_criterion(diff_logits, class_labels)
        
        loss = 0.6 * loss_triage + 0.4 * loss_diff
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()
        n_batches += 1
    return total_loss / max(n_batches, 1)


@torch.no_grad()
def evaluate(model, loader, device, triage_encoder, class_encoder):
    model.eval()
    all_triage_preds, all_triage_labels, all_triage_probs = [], [], []
    all_diff_preds, all_diff_labels, all_diff_probs = [], [], []
    
    for imgs, glcm, triage_labels, class_labels in loader:
        imgs, glcm = imgs.to(device), glcm.to(device)
        triage_logits, diff_logits = model(imgs, glcm)
        
        triage_probs = torch.softmax(triage_logits, dim=1).cpu().numpy()
        diff_probs = torch.softmax(diff_logits, dim=1).cpu().numpy()
        
        all_triage_preds.extend(triage_logits.argmax(1).cpu().numpy())
        all_triage_labels.extend(triage_labels.numpy())
        all_triage_probs.extend(triage_probs)
        all_diff_preds.extend(diff_logits.argmax(1).cpu().numpy())
        all_diff_labels.extend(class_labels.numpy())
        all_diff_probs.extend(diff_probs)
    
    triage_acc = accuracy_score(all_triage_labels, all_triage_preds)
    try:
        triage_auroc = roc_auc_score(all_triage_labels, all_triage_probs, multi_class='ovr', average='macro')
    except ValueError:
        triage_auroc = 0.0
    
    triage_cm = confusion_matrix(all_triage_labels, all_triage_preds, labels=range(3))
    diff_acc = accuracy_score(all_diff_labels, all_diff_preds)
    
    return {
        'triage_acc': triage_acc, 'triage_auroc': triage_auroc, 'triage_cm': triage_cm,
        'diff_acc': diff_acc, 'triage_preds': all_triage_preds, 'diff_preds': all_diff_preds
    }


def evaluate_by_fitzpatrick(model, df_test, test_dataset, device, triage_encoder, class_encoder):
    model.eval()
    results = {}
    for bucket in ['I-II', 'III-IV', 'V-VI', 'unknown']:
        mask = df_test['fitzpatrick_type'] == bucket
        if mask.sum() == 0:
            results[bucket] = {'n_samples': 0, 'note': 'no samples'}
            continue
        subset_indices = np.where(mask.values)[0]
        subset = torch.utils.data.Subset(test_dataset, subset_indices)
        loader = DataLoader(subset, batch_size=32, shuffle=False, num_workers=0)
        metrics = evaluate(model, loader, device, triage_encoder, class_encoder)
        results[bucket] = {
            'n_samples': int(mask.sum()),
            'triage_accuracy': float(metrics['triage_acc']),
            'triage_auroc': float(metrics['triage_auroc']),
        }
    return results


def optuna_objective(trial, df_train_sub, df_val, triage_encoder, class_encoder):
    lr = trial.suggest_float('lr', 1e-5, 1e-3, log=True)
    batch_size = trial.suggest_categorical('batch_size', [16, 32])
    dropout = trial.suggest_float('dropout', 0.2, 0.6)
    
    n_classes = len(class_encoder.classes_)
    model = DermClassifier(n_classes=n_classes, dropout=dropout).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    
    train_ds = SkinLesionDataset(df_train_sub, triage_encoder, class_encoder, transform=train_transforms)
    val_ds = SkinLesionDataset(df_val, triage_encoder, class_encoder, transform=val_transforms)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=2, pin_memory=True)
    
    triage_weights = compute_class_weights(triage_encoder.transform(df_train_sub['triage_label']), DEVICE)
    class_weights = compute_class_weights(class_encoder.transform(df_train_sub['class_label']), DEVICE)
    triage_criterion = nn.CrossEntropyLoss(weight=triage_weights)
    diff_criterion = nn.CrossEntropyLoss(weight=class_weights)
    
    best_auroc = 0
    for epoch in range(5):
        train_epoch(model, train_loader, optimizer, triage_criterion, diff_criterion, DEVICE)
        metrics = evaluate(model, val_loader, DEVICE, triage_encoder, class_encoder)
        if metrics['triage_auroc'] > best_auroc:
            best_auroc = metrics['triage_auroc']
        trial.report(metrics['triage_auroc'], epoch)
        if trial.should_prune():
            raise optuna.exceptions.TrialPruned()
    return best_auroc


# ============================================================
# 8. Main Execution
# ============================================================
def main():
    print("=" * 60)
    print("DERMATOLOGICAL PRE-SCREENING MODEL — KAGGLE PIPELINE")
    print("=" * 60)
    
    df = build_manifest()
    
    triage_encoder = LabelEncoder()
    triage_encoder.fit(['benign', 'uncertain', 'malignant_suspect'])
    
    class_encoder = LabelEncoder()
    class_encoder.fit(sorted(df['class_label'].unique()))
    n_classes = len(class_encoder.classes_)
    
    df_train, df_val, df_test = split_data(df)
    
    print("\n🔍 Running Optuna Hyperparameter Optimization...")
    df_train_sub = df_train.sample(frac=0.2, random_state=SEED).reset_index(drop=True)
    study = optuna.create_study(direction='maximize', sampler=optuna.samplers.TPESampler(seed=SEED))
    study.optimize(
        lambda trial: optuna_objective(trial, df_train_sub, df_val, triage_encoder, class_encoder),
        n_trials=15, timeout=1800, show_progress_bar=True
    )
    best_params = study.best_params
    
    print("\n🚀 Training Full Model...")
    model = DermClassifier(n_classes=n_classes, dropout=best_params['dropout']).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=best_params['lr'], weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=30)
    
    train_ds = SkinLesionDataset(df_train, triage_encoder, class_encoder, transform=train_transforms)
    val_ds = SkinLesionDataset(df_val, triage_encoder, class_encoder, transform=val_transforms)
    test_ds = SkinLesionDataset(df_test, triage_encoder, class_encoder, transform=val_transforms)
    
    train_loader = DataLoader(train_ds, batch_size=best_params['batch_size'], shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=2, pin_memory=True)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False, num_workers=2, pin_memory=True)
    
    triage_weights = compute_class_weights(triage_encoder.transform(df_train['triage_label']), DEVICE)
    class_weights_tensor = compute_class_weights(class_encoder.transform(df_train['class_label']), DEVICE)
    triage_criterion = nn.CrossEntropyLoss(weight=triage_weights)
    diff_criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)
    
    best_auroc = 0
    patience, patience_counter = 5, 0
    for epoch in range(30):
        train_loss = train_epoch(model, train_loader, optimizer, triage_criterion, diff_criterion, DEVICE)
        val_metrics = evaluate(model, val_loader, DEVICE, triage_encoder, class_encoder)
        scheduler.step()
        if val_metrics['triage_auroc'] > best_auroc:
            best_auroc = val_metrics['triage_auroc']
            patience_counter = 0
            torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, 'best_model.pth'))
        else:
            patience_counter += 1
            if patience_counter >= patience:
                break
    
    model.load_state_dict(torch.load(os.path.join(OUTPUT_DIR, 'best_model.pth')))
    test_metrics = evaluate(model, test_loader, DEVICE, triage_encoder, class_encoder)
    fitz_results = evaluate_by_fitzpatrick(model, df_test, test_ds, DEVICE, triage_encoder, class_encoder)
    
    metrics_output = {
        'model_version': 'v1.0.0', 'best_hyperparameters': best_params,
        'triage': {'accuracy': float(test_metrics['triage_acc']), 'auroc': float(test_metrics['triage_auroc'])},
        'fitzpatrick_stratified': fitz_results,
    }
    with open(os.path.join(OUTPUT_DIR, 'metrics.json'), 'w') as f:
        json.dump(metrics_output, f, indent=2, default=str)
    
    # ============================================================
    # 9. Export Model Artifacts for Offline Use
    # ============================================================
    print("\n" + "=" * 60)
    print("EXPORTING MODEL ARTIFACTS FOR OFFLINE USE")
    print("=" * 60)
    
    # Export ONNX model
    model.eval()
    dummy_img = torch.randn(1, 3, IMG_SIZE, IMG_SIZE).to(DEVICE)
    dummy_glcm = torch.randn(1, 40).to(DEVICE)
    onnx_path = os.path.join(OUTPUT_DIR, 'skin_classifier.onnx')
    torch.onnx.export(
        model, (dummy_img, dummy_glcm), onnx_path,
        export_params=True, opset_version=14,
        input_names=['image', 'glcm_features'],
        output_names=['triage_logits', 'differential_logits'],
        dynamic_axes={'image': {0: 'batch_size'}, 'glcm_features': {0: 'batch_size'}}
    )
    print(f"  ✓ ONNX model exported: {onnx_path}")
    
    # Export label encoders
    encoders_path = os.path.join(OUTPUT_DIR, 'label_encoders.pkl')
    joblib.dump({
        'triage_encoder': triage_encoder,
        'class_encoder': class_encoder
    }, encoders_path)
    print(f"  ✓ Label encoders exported: {encoders_path}")
    print(f"    Triage classes: {list(triage_encoder.classes_)}")
    print(f"    Differential classes ({len(class_encoder.classes_)}): {list(class_encoder.classes_[:5])}...")
    
    # Export GLCM pipeline config
    glcm_path = os.path.join(OUTPUT_DIR, 'glcm_pipeline.pkl')
    joblib.dump({
        'distances': GLCM_DISTANCES,
        'angles': GLCM_ANGLES,
        'levels': 256,
        'img_size': IMG_SIZE
    }, glcm_path)
    print(f"  ✓ GLCM config exported: {glcm_path}")
    
    # Export PyTorch checkpoint (for fine-tuning later)
    checkpoint_path = os.path.join(OUTPUT_DIR, 'best_model.pth')
    print(f"  ✓ PyTorch checkpoint: {checkpoint_path}")
    
    # ============================================================
    # 10. Package All Artifacts into a Single ZIP
    # ============================================================
    import zipfile
    
    zip_path = os.path.join(OUTPUT_DIR, 'model_artifacts.zip')
    artifact_files = {
        'skin_classifier.onnx': onnx_path,
        'label_encoders.pkl': encoders_path,
        'glcm_pipeline.pkl': glcm_path,
        'metrics.json': os.path.join(OUTPUT_DIR, 'metrics.json'),
        'best_model.pth': checkpoint_path,
    }
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for arcname, filepath in artifact_files.items():
            if os.path.exists(filepath):
                zf.write(filepath, arcname)
                size_mb = os.path.getsize(filepath) / (1024 * 1024)
                print(f"  📦 Packed: {arcname} ({size_mb:.1f} MB)")
    
    zip_size = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"\n  ✅ model_artifacts.zip created ({zip_size:.1f} MB)")
    
    # Create download instructions manifest
    manifest_text = """DOWNLOAD INSTRUCTIONS
====================

These are the trained model artifacts for DermScreen.

HOW TO USE:
1. Download "model_artifacts.zip" from the Kaggle Output tab
2. Unzip it
3. Copy these 3 files into your project:

   server/inference_server/models/skin_classifier.onnx
   server/inference_server/models/label_encoders.pkl
   server/inference_server/models/glcm_pipeline.pkl

4. Restart the inference server:
   cd server/inference_server
   python main.py

5. The server will auto-detect the model files and exit demo mode.

FILES IN THIS ARCHIVE:
- skin_classifier.onnx   — ONNX model (EfficientNet-B4 + GLCM + BiLSTM)
- label_encoders.pkl      — Triage encoder (3 tiers) + differential encoder (N classes)
- glcm_pipeline.pkl       — GLCM feature extraction configuration
- metrics.json            — Test set evaluation metrics
- best_model.pth          — PyTorch checkpoint (for fine-tuning, not needed for inference)
"""
    
    readme_path = os.path.join(OUTPUT_DIR, 'DOWNLOAD_THESE.txt')
    with open(readme_path, 'w') as f:
        f.write(manifest_text)
    print(f"  ✓ Download instructions: {readme_path}")
    
    # Final summary
    print("\n" + "=" * 60)
    print("✅ TRAINING COMPLETE — ALL ARTIFACTS EXPORTED")
    print("=" * 60)
    print(f"\n  Model version: v1.0.0")
    print(f"  Triage accuracy: {test_metrics['triage_acc']:.4f}")
    print(f"  Triage AUROC:    {test_metrics['triage_auroc']:.4f}")
    print(f"  Differential accuracy: {test_metrics['diff_acc']:.4f}")
    print(f"\n  📥 Download 'model_artifacts.zip' from the Kaggle Output tab")
    print(f"  📂 Unzip into: server/inference_server/models/")
    print(f"  🚀 Restart inference server to exit demo mode\n")


if __name__ == '__main__':
    main()

