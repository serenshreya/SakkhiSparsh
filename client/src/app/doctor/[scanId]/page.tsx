'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ClinicalReportDashboard from '@/components/ui/ClinicalReportDashboard';
import type {
  Profile, Finding, Recommendation, Scan, DoctorFeedback, Patient, PrescribedMedicine
} from '@/lib/types';
import { STORAGE_BUCKETS } from '@/lib/constants';

export default function DoctorScanPage() {
  const params = useParams();
  const scanId = params.scanId as string;
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [finding, setFinding] = useState<Finding | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [existingFeedback, setExistingFeedback] = useState<DoctorFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  // Image URLs
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [gradcamImageUrl, setGradcamImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (profileData) setProfile(profileData as Profile);

      // Scan
      const { data: scanData } = await supabase
        .from('scans').select('*').eq('id', scanId).single();
      if (scanData) {
        setScan(scanData as Scan);

        // Patient info
        if (scanData.patient_id) {
          const { data: ptData } = await supabase
            .from('patients')
            .select('*')
            .eq('id', scanData.patient_id)
            .single();
          if (ptData) setPatient(ptData as Patient);
        }

        // Get signed URL for scan image
        const { data: signedData } = await supabase.storage
          .from(STORAGE_BUCKETS.SCAN_IMAGES)
          .createSignedUrl(scanData.image_url, 3600);
        if (signedData) setScanImageUrl(signedData.signedUrl);
      }

      // Finding
      const { data: findingData } = await supabase
        .from('findings').select('*').eq('scan_id', scanId).single();
      if (findingData) {
        setFinding(findingData as Finding);

        // Grad-CAM URL
        if (findingData.gradcam_url) {
          const { data: gradcamSigned } = await supabase.storage
            .from(STORAGE_BUCKETS.GRADCAM_HEATMAPS)
            .createSignedUrl(findingData.gradcam_url, 3600);
          if (gradcamSigned) setGradcamImageUrl(gradcamSigned.signedUrl);
        }

        // Recommendation
        const { data: recData } = await supabase
          .from('recommendations').select('*').eq('finding_id', findingData.id).single();
        if (recData) setRecommendation(recData as Recommendation);

        // Existing feedback
        const { data: fbData } = await supabase
          .from('doctor_feedback')
          .select('*')
          .eq('finding_id', findingData.id)
          .eq('doctor_id', user.id)
          .single();
        if (fbData) setExistingFeedback(fbData as DoctorFeedback);
      }

      setLoading(false);
    };

    loadData();
  }, [scanId, supabase]);

  const handleFeedbackSubmit = async (data: {
    confirmed: boolean;
    correctionLabel: string;
    notes: string;
    prescribedMedicines: PrescribedMedicine[];
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !finding || !scan) return;

    const feedbackData = {
      finding_id: finding.id,
      doctor_id: user.id,
      confirmed: data.confirmed,
      correction_label: data.confirmed ? null : data.correctionLabel || null,
      notes: data.notes || null,
      prescribed_medicines: data.prescribedMedicines,
    };

    if (existingFeedback) {
      await supabase
        .from('doctor_feedback')
        .update(feedbackData)
        .eq('id', existingFeedback.id);
    } else {
      await supabase
        .from('doctor_feedback')
        .insert(feedbackData);
    }

    // Update recommendations with verified doctor notes and prescribed medicines
    if (recommendation) {
      await supabase
        .from('recommendations')
        .update({
          doctor_notes: data.notes,
          prescribed_medicines: data.prescribedMedicines,
          doctor_verified: true,
          doctor_verified_at: new Date().toISOString(),
          doctor_name: profile?.full_name || 'Dr. Ananya Rao',
        })
        .eq('id', recommendation.id);
    }

    // Mark scan status as officially completed and verified!
    await supabase
      .from('scans')
      .update({ status: 'completed' })
      .eq('id', scan.id);

    setScan((prev) => (prev ? { ...prev, status: 'completed' } : prev));
  };

  if (loading) {
    return (
      <div className="report-dashboard-wrapper" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-text">Loading clinical decision report...</div>
      </div>
    );
  }

  return (
    <ClinicalReportDashboard
      scan={scan}
      patient={patient}
      finding={finding}
      recommendation={recommendation}
      scanImageUrl={scanImageUrl}
      gradcamImageUrl={gradcamImageUrl}
      isDoctor={true}
      profile={profile}
      onFeedbackSubmit={handleFeedbackSubmit}
      existingFeedback={existingFeedback}
    />
  );
}
