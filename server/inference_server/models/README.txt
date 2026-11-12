# Model Files Placement Guide
#
# After training on Kaggle, download these 3 files from /kaggle/working/
# and place them in THIS directory:
#
# 1. skin_classifier.onnx      — ONNX model weights (~60-100 MB)
# 2. label_encoders.pkl         — Triage + differential label encoders
# 3. glcm_pipeline.pkl          — GLCM feature extraction configuration
#
# The inference server loads these on startup automatically.
