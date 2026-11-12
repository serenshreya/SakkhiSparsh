-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security — every table must have RLS enabled
-- ============================================================

-- Helper: check if current user has doctor role
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'doctor'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user has patient role
CREATE OR REPLACE FUNCTION public.is_patient()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'patient'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Doctors can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_doctor());

-- ============================================================
-- Patients
-- ============================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own record"
  ON public.patients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Patients can insert own record"
  ON public.patients FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Patients can update own record"
  ON public.patients FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Doctors can view all patients"
  ON public.patients FOR SELECT
  USING (public.is_doctor());

-- ============================================================
-- Scans
-- ============================================================
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own scans"
  ON public.scans FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own scans"
  ON public.scans FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view all scans"
  ON public.scans FOR SELECT
  USING (public.is_doctor());

CREATE POLICY "Doctors can update scan status"
  ON public.scans FOR UPDATE
  USING (public.is_doctor());

-- ============================================================
-- Findings
-- ============================================================
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own findings"
  ON public.findings FOR SELECT
  USING (
    scan_id IN (
      SELECT s.id FROM public.scans s
      JOIN public.patients p ON s.patient_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view all findings"
  ON public.findings FOR SELECT
  USING (public.is_doctor());

CREATE POLICY "Service role can insert findings"
  ON public.findings FOR INSERT
  WITH CHECK (true);  -- Controlled by service-role key in API route

CREATE POLICY "Service role can update findings"
  ON public.findings FOR UPDATE
  USING (true);  -- Controlled by service-role key in API route

-- ============================================================
-- Recommendations
-- ============================================================
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own recommendations"
  ON public.recommendations FOR SELECT
  USING (
    finding_id IN (
      SELECT f.id FROM public.findings f
      JOIN public.scans s ON f.scan_id = s.id
      JOIN public.patients p ON s.patient_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view all recommendations"
  ON public.recommendations FOR SELECT
  USING (public.is_doctor());

CREATE POLICY "Service role can insert recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK (true);  -- Controlled by service-role key in API route

-- ============================================================
-- Ayurveda Condition Map
-- ============================================================
ALTER TABLE public.ayurveda_condition_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read ayurveda map"
  ON public.ayurveda_condition_map FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admin/service-role can write to this table (no policy for INSERT/UPDATE)
-- This means it can only be modified via service-role key or SQL Editor

-- ============================================================
-- Doctor Feedback
-- ============================================================
ALTER TABLE public.doctor_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view all feedback"
  ON public.doctor_feedback FOR SELECT
  USING (public.is_doctor());

CREATE POLICY "Doctors can insert feedback"
  ON public.doctor_feedback FOR INSERT
  WITH CHECK (
    public.is_doctor() AND doctor_id = auth.uid()
  );

CREATE POLICY "Doctors can update own feedback"
  ON public.doctor_feedback FOR UPDATE
  USING (doctor_id = auth.uid());
