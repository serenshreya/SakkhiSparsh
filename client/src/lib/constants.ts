// ============================================================
// Environment and app-wide constants
// ============================================================

export const APP_NAME = 'DermScreen';
export const APP_DESCRIPTION = 'AI-Assisted Dermatological Pre-Screening';

// Inference service URL
export const INFERENCE_URL = process.env.INFERENCE_API_URL || 'http://localhost:8000';

// Model version
export const MODEL_VERSION = 'v1.0.0';

// Supabase Storage buckets
export const STORAGE_BUCKETS = {
  SCAN_IMAGES: 'scan-images',
  GRADCAM_HEATMAPS: 'gradcam-heatmaps',
} as const;

// Max file size for uploads (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Accepted image types
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Minimum image dimensions
export const MIN_IMAGE_DIMENSION = 224;
