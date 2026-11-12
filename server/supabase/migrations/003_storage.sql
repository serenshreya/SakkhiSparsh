-- ============================================================
-- 003_storage.sql
-- Private storage buckets for medical images
-- Run after schema + RLS migrations
-- ============================================================

-- Create private buckets (NOT public — signed URLs only)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('scan-images', 'scan-images', false),
  ('gradcam-heatmaps', 'gradcam-heatmaps', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage policies for scan-images
-- ============================================================

-- Patients can upload to their own folder: scan-images/{user_id}/*
CREATE POLICY "Patients can upload own scan images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Patients can view their own images
CREATE POLICY "Patients can view own scan images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Doctors can view all scan images
CREATE POLICY "Doctors can view all scan images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'scan-images'
    AND public.is_doctor()
  );

-- ============================================================
-- Storage policies for gradcam-heatmaps
-- ============================================================

-- Service role inserts heatmaps (no user-facing INSERT policy needed)
-- The API route uses the service-role key to upload

-- Patients can view heatmaps linked to their scans
CREATE POLICY "Patients can view own gradcam heatmaps"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'gradcam-heatmaps'
    AND (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM public.scans s
      JOIN public.patients p ON s.patient_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Doctors can view all heatmaps
CREATE POLICY "Doctors can view all gradcam heatmaps"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'gradcam-heatmaps'
    AND public.is_doctor()
  );
