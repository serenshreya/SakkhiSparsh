// ============================================================
// TypeScript types matching Supabase schema
// ============================================================

export type UserRole = 'doctor' | 'patient';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Patient {
  id: string;
  user_id: string | null;
  full_name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  created_at: string;
}

export type ImageQualityFlag = 'good' | 'retake_recommended';
export type ScanStatus = 'pending' | 'processing' | 'awaiting_verification' | 'completed' | 'error';

export interface PrescribedMedicine {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface DoctorOption {
  id: string;
  full_name: string;
  specialty: string;
  hospital?: string;
}

export interface Scan {
  id: string;
  patient_id: string;
  image_url: string;
  image_quality_flag: ImageQualityFlag;
  symptom_duration: string | null;
  symptom_itch: boolean;
  symptom_pain: boolean;
  body_location: string | null;
  status: ScanStatus;
  captured_at: string;
  assigned_doctor_id?: string | null;
  assigned_doctor_name?: string | null;
}

export type TriageTier = 'benign' | 'uncertain' | 'malignant_suspect';
export type RiskTier = 'low' | 'moderate' | 'high';

export interface DifferentialItem {
  condition: string;
  confidence: number;
}

export interface MinorSigns {
  asymmetry_score: number | null;
  border_irregularity: number | null;
  color_variation: number | null;
  diameter_estimate: number | null;
}

export interface Finding {
  id: string;
  scan_id: string;
  triage_tier: TriageTier;
  differential: DifferentialItem[];
  minor_signs: MinorSigns;
  confidence_score: number;
  gradcam_url: string | null;
  model_version: string;
  created_at: string;
}

export interface Recommendation {
  id: string;
  finding_id: string;
  risk_tier: RiskTier;
  ayurveda_advice: AyurvedaAdvice;
  allopathy_advice: AllopathyAdvice;
  ayurveda_condition_map_id: string | null;
  prescribed_medicines?: PrescribedMedicine[];
  doctor_notes?: string | null;
  doctor_verified?: boolean;
  doctor_verified_at?: string | null;
  doctor_name?: string | null;
  created_at: string;
}

export interface AyurvedaAdvice {
  dosha_classification: string;
  dietary_notes: string;
  lifestyle_notes: string;
  classical_reference: string;
}

export interface AllopathyAdvice {
  category: string;
  urgency: string;
  next_steps: string[];
}

export interface AyurvedaConditionMap {
  id: string;
  modern_condition: string;
  dosha_classification: string;
  dietary_notes: string | null;
  lifestyle_notes: string | null;
  classical_reference: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

export interface DoctorFeedback {
  id: string;
  finding_id: string;
  doctor_id: string;
  confirmed: boolean | null;
  correction_label: string | null;
  notes: string | null;
  prescribed_medicines?: PrescribedMedicine[];
  submitted_at: string;
}

// Inference API response types
export interface InferenceResponse {
  triage: {
    tier: TriageTier;
    confidence: number;
  };
  differential: DifferentialItem[];
  minor_signs: MinorSigns;
  model_version: string;
  gradcam_base64?: string | null;
}

// Composite types for views
export interface ScanWithFindings extends Scan {
  findings?: Finding;
  patient?: Patient;
  recommendations?: Recommendation;
}

// Body location options for symptom form
export const BODY_LOCATIONS = [
  'Face', 'Scalp', 'Neck', 'Chest', 'Back', 'Abdomen',
  'Upper arm (left)', 'Upper arm (right)',
  'Forearm (left)', 'Forearm (right)',
  'Hand (left)', 'Hand (right)',
  'Upper leg (left)', 'Upper leg (right)',
  'Lower leg (left)', 'Lower leg (right)',
  'Foot (left)', 'Foot (right)',
  'Groin', 'Buttocks', 'Other',
] as const;

export const SYMPTOM_DURATIONS = [
  'Less than 1 week',
  '1-2 weeks',
  '2-4 weeks',
  '1-3 months',
  '3-6 months',
  '6-12 months',
  'More than 1 year',
  'Since birth / lifelong',
  'Unknown',
] as const;

// Triage tier display config
export const TRIAGE_CONFIG: Record<TriageTier, { label: string; cssClass: string }> = {
  benign: { label: 'Benign', cssClass: 'badge--benign' },
  uncertain: { label: 'Uncertain — Further evaluation recommended', cssClass: 'badge--uncertain' },
  malignant_suspect: { label: 'Malignant suspect — Urgent referral', cssClass: 'badge--malignant_suspect' },
};

export const RISK_CONFIG: Record<RiskTier, { label: string; cssClass: string }> = {
  low: { label: 'Low Risk', cssClass: 'badge--low' },
  moderate: { label: 'Moderate Risk', cssClass: 'badge--moderate' },
  high: { label: 'High Risk', cssClass: 'badge--high' },
};

// Map triage tier to risk tier
export function triageToRisk(triage: TriageTier): RiskTier {
  switch (triage) {
    case 'benign': return 'low';
    case 'uncertain': return 'moderate';
    case 'malignant_suspect': return 'high';
  }
}

// Format condition name for display
export function formatConditionName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
