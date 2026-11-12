-- ============================================================
-- 001_schema.sql
-- Dermatological Pre-Screening System — Core Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- Role enum for auth-linked profiles
CREATE TYPE public.user_role AS ENUM ('doctor', 'patient');

-- Profiles table — extends auth.users with a role
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role public.user_role NOT NULL DEFAULT 'patient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Patients
-- ============================================================
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  age INT CHECK (age > 0 AND age < 150),
  gender TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Scans
-- ============================================================
CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_quality_flag TEXT DEFAULT 'good'
    CHECK (image_quality_flag IN ('good', 'retake_recommended')),
  symptom_duration TEXT,
  symptom_itch BOOLEAN DEFAULT false,
  symptom_pain BOOLEAN DEFAULT false,
  body_location TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Ayurveda condition mapping (curated by qualified practitioner)
-- Must exist before recommendations table references it
-- ============================================================
CREATE TABLE public.ayurveda_condition_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modern_condition TEXT NOT NULL UNIQUE,
  dosha_classification TEXT NOT NULL,
  dietary_notes TEXT,
  lifestyle_notes TEXT,
  classical_reference TEXT,
  verified_by TEXT DEFAULT 'SEED_DATA_UNVERIFIED',
  verified_at TIMESTAMPTZ
);

-- ============================================================
-- Findings
-- ============================================================
CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  triage_tier TEXT NOT NULL
    CHECK (triage_tier IN ('benign', 'uncertain', 'malignant_suspect')),
  differential JSONB NOT NULL DEFAULT '[]'::jsonb,
  minor_signs JSONB DEFAULT '{}'::jsonb,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  gradcam_url TEXT,
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Recommendations
-- ============================================================
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  risk_tier TEXT NOT NULL
    CHECK (risk_tier IN ('low', 'moderate', 'high')),
  ayurveda_advice JSONB DEFAULT '{}'::jsonb,
  allopathy_advice JSONB DEFAULT '{}'::jsonb,
  ayurveda_condition_map_id UUID REFERENCES public.ayurveda_condition_map(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Doctor Feedback (feeds retraining queue)
-- ============================================================
CREATE TABLE public.doctor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id),
  confirmed BOOLEAN,
  correction_label TEXT,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_scans_patient_id ON public.scans(patient_id);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_findings_scan_id ON public.findings(scan_id);
CREATE INDEX idx_recommendations_finding_id ON public.recommendations(finding_id);
CREATE INDEX idx_doctor_feedback_finding_id ON public.doctor_feedback(finding_id);
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
