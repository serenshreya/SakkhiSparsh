"""
Class Mappings — Unified Label System
======================================
Maps condition labels from all four source datasets into:
1. A unified class label (lowercase, snake_case)
2. A triage tier (benign / uncertain / malignant_suspect)
3. Fitzpatrick type normalization
"""

# ============================================================
# HAM10000 class mapping (7 classes)
# ============================================================
HAM10000_LABEL_MAP = {
    'akiec': 'actinic_keratosis',
    'bcc': 'basal_cell_carcinoma',
    'bkl': 'benign_keratosis',
    'df': 'dermatofibroma',
    'mel': 'melanoma',
    'nv': 'melanocytic_nevus',
    'vasc': 'vascular_lesion',
}

# ============================================================
# ISIC 2019 class mapping (9 classes, some overlap with HAM10000)
# ============================================================
ISIC2019_LABEL_MAP = {
    'MEL': 'melanoma',
    'NV': 'melanocytic_nevus',
    'BCC': 'basal_cell_carcinoma',
    'AK': 'actinic_keratosis',
    'BKL': 'benign_keratosis',
    'DF': 'dermatofibroma',
    'VASC': 'vascular_lesion',
    'SCC': 'squamous_cell_carcinoma',
    'UNK': 'unknown',
    # Common label text variations
    'Melanoma': 'melanoma',
    'Melanocytic nevus': 'melanocytic_nevus',
    'Basal cell carcinoma': 'basal_cell_carcinoma',
    'Actinic keratosis': 'actinic_keratosis',
    'Benign keratosis': 'benign_keratosis',
    'Dermatofibroma': 'dermatofibroma',
    'Vascular lesion': 'vascular_lesion',
    'Squamous cell carcinoma': 'squamous_cell_carcinoma',
}

# ============================================================
# Fitzpatrick17k — uses its own label names (114 conditions)
# We map the most common ones; others map via fuzzy matching
# ============================================================
FITZPATRICK17K_COMMON_MAP = {
    'acne': 'acne',
    'acne keloidalis nuchae': 'acne',
    'actinic keratosis': 'actinic_keratosis',
    'alopecia areata': 'alopecia_areata',
    'basal cell carcinoma': 'basal_cell_carcinoma',
    'contact dermatitis': 'contact_dermatitis',
    'dermatofibroma': 'dermatofibroma',
    'eczema': 'eczema',
    'folliculitis': 'folliculitis',
    'granuloma annulare': 'granuloma_annulare',
    'lichen planus': 'lichen_planus',
    'lupus erythematosus': 'lupus_erythematosus',
    'melanoma': 'melanoma',
    'morphea': 'morphea',
    'mycosis fungoides': 'mycosis_fungoides',
    'nevus': 'melanocytic_nevus',
    'photodermatitis': 'photodermatitis',
    'pityriasis rosea': 'pityriasis_rosea',
    'psoriasis': 'psoriasis',
    'rosacea': 'rosacea',
    'sarcoidosis': 'sarcoidosis',
    'sebaceous hyperplasia': 'sebaceous_hyperplasia',
    'seborrheic dermatitis': 'seborrheic_dermatitis',
    'seborrheic keratosis': 'seborrheic_keratosis',
    'squamous cell carcinoma': 'squamous_cell_carcinoma',
    'tinea': 'tinea',
    'urticaria': 'urticaria',
    'vitiligo': 'vitiligo',
    'wart': 'warts',
}

# ============================================================
# SD-198 — uses folder names (198 categories)
# Map common ones; rest are lowercased and snake_cased
# ============================================================
SD198_COMMON_MAP = {
    'Acne': 'acne',
    'Actinic_Keratosis': 'actinic_keratosis',
    'Basal_Cell_Carcinoma': 'basal_cell_carcinoma',
    'Eczema': 'eczema',
    'Melanoma': 'melanoma',
    'Psoriasis': 'psoriasis',
    'Rosacea': 'rosacea',
    'Seborrheic_Keratosis': 'seborrheic_keratosis',
    'Urticaria': 'urticaria',
    'Vitiligo': 'vitiligo',
    'Warts': 'warts',
}

# ============================================================
# Triage tier assignments
# benign: clearly non-cancerous conditions
# uncertain: pre-malignant or ambiguous conditions requiring monitoring
# malignant_suspect: known malignancies or high-risk pre-cancers
# ============================================================
TRIAGE_TIER_MAP = {
    # Benign
    'melanocytic_nevus': 'benign',
    'benign_keratosis': 'benign',
    'dermatofibroma': 'benign',
    'vascular_lesion': 'benign',
    'seborrheic_keratosis': 'benign',
    'acne': 'benign',
    'eczema': 'benign',
    'psoriasis': 'benign',
    'rosacea': 'benign',
    'contact_dermatitis': 'benign',
    'seborrheic_dermatitis': 'benign',
    'urticaria': 'benign',
    'vitiligo': 'benign',
    'warts': 'benign',
    'tinea': 'benign',
    'folliculitis': 'benign',
    'pityriasis_rosea': 'benign',
    'granuloma_annulare': 'benign',
    'alopecia_areata': 'benign',
    'photodermatitis': 'benign',
    'sebaceous_hyperplasia': 'benign',
    'morphea': 'benign',
    'lichen_planus': 'benign',

    # Uncertain — requires monitoring, possible pre-malignant
    'actinic_keratosis': 'uncertain',
    'unknown': 'uncertain',
    'lupus_erythematosus': 'uncertain',
    'sarcoidosis': 'uncertain',

    # Malignant suspect
    'melanoma': 'malignant_suspect',
    'basal_cell_carcinoma': 'malignant_suspect',
    'squamous_cell_carcinoma': 'malignant_suspect',
    'mycosis_fungoides': 'malignant_suspect',
}

# Default triage for unmapped conditions
DEFAULT_TRIAGE = 'uncertain'


def normalize_label(raw_label: str, source_dataset: str) -> str:
    """
    Normalize a raw label from any dataset to our unified label system.
    
    Args:
        raw_label: Original label string from the dataset
        source_dataset: One of 'ham10000', 'isic2019', 'fitzpatrick17k', 'sd198'
    
    Returns:
        Normalized label string (lowercase, snake_case)
    """
    if source_dataset == 'ham10000':
        return HAM10000_LABEL_MAP.get(raw_label, raw_label.lower().replace(' ', '_'))
    elif source_dataset == 'isic2019':
        return ISIC2019_LABEL_MAP.get(raw_label, raw_label.lower().replace(' ', '_'))
    elif source_dataset == 'fitzpatrick17k':
        lower = raw_label.lower().strip()
        return FITZPATRICK17K_COMMON_MAP.get(lower, lower.replace(' ', '_').replace('-', '_'))
    elif source_dataset == 'sd198':
        return SD198_COMMON_MAP.get(raw_label, raw_label.lower().replace(' ', '_'))
    else:
        return raw_label.lower().replace(' ', '_')


def get_triage_tier(unified_label: str) -> str:
    """
    Map a unified label to its triage tier.
    
    Returns:
        One of 'benign', 'uncertain', 'malignant_suspect'
    """
    return TRIAGE_TIER_MAP.get(unified_label, DEFAULT_TRIAGE)


def normalize_fitzpatrick(raw_value) -> str:
    """
    Normalize Fitzpatrick skin type to a standard bucket.
    
    Args:
        raw_value: Could be int (1-6), string ('I'-'VI', '1'-'6'),
                   float, or NaN/None
    
    Returns:
        One of 'I-II', 'III-IV', 'V-VI', 'unknown'
    """
    if raw_value is None:
        return 'unknown'
    
    try:
        import math
        if isinstance(raw_value, float) and math.isnan(raw_value):
            return 'unknown'
    except (TypeError, ValueError):
        pass
    
    # Convert to int
    roman_to_int = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6}
    
    if isinstance(raw_value, str):
        raw_value = raw_value.strip()
        if raw_value in roman_to_int:
            val = roman_to_int[raw_value]
        elif raw_value.isdigit():
            val = int(raw_value)
        else:
            return 'unknown'
    elif isinstance(raw_value, (int, float)):
        val = int(raw_value)
    else:
        return 'unknown'
    
    if val in (1, 2):
        return 'I-II'
    elif val in (3, 4):
        return 'III-IV'
    elif val in (5, 6):
        return 'V-VI'
    else:
        return 'unknown'


def get_all_triage_classes() -> list:
    """Return ordered list of triage classes."""
    return ['benign', 'uncertain', 'malignant_suspect']


def get_fitzpatrick_buckets() -> list:
    """Return ordered list of Fitzpatrick buckets."""
    return ['I-II', 'III-IV', 'V-VI', 'unknown']
