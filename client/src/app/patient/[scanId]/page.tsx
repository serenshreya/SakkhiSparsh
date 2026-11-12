'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NavBar from '@/components/ui/NavBar';
import ClinicalReportDashboard from '@/components/ui/ClinicalReportDashboard';
import type { Profile, Finding, Recommendation, Scan, Patient } from '@/lib/types';
import { STORAGE_BUCKETS } from '@/lib/constants';

export default function PatientReportPage() {
  const params = useParams();
  const scanId = params.scanId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [finding, setFinding] = useState<Finding | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [gradcamImageUrl, setGradcamImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Profile
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (profileData) setProfile(profileData as Profile);

      // Scan
      const { data: scanData } = await supabase
        .from('scans').select('*').eq('id', scanId).single();
      if (scanData) {
        setScan(scanData as Scan);

        // Fetch patient profile info
        if (scanData.patient_id) {
          const { data: ptData } = await supabase
            .from('patients')
            .select('*')
            .eq('id', scanData.patient_id)
            .single();
          if (ptData) setPatient(ptData as Patient);
        }

        // Get signed image URL
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

        // Grad-CAM image signed URL
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
      }

      setLoading(false);
    };

    loadData();

    // Poll if scan is still processing
    const interval = setInterval(async () => {
      const { data: scanData } = await supabase
        .from('scans').select('status').eq('id', scanId).single();
      if (scanData?.status === 'completed' || scanData?.status === 'error') {
        clearInterval(interval);
        loadData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanId, supabase]);

  if (loading) {
    return (
      <>
        <NavBar profile={profile} />
        <div className="page-container page-container--form">
          <div className="loading-text" id="patient-loading">
            {scan?.status === 'processing'
              ? 'Analyzing skin lesion scan... Generating explainability report.'
              : 'Loading your clinical detailed report...'}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar profile={profile} />
      <ClinicalReportDashboard
        scan={scan}
        patient={patient}
        finding={finding}
        recommendation={recommendation}
        scanImageUrl={scanImageUrl}
        gradcamImageUrl={gradcamImageUrl}
        isDoctor={false}
        profile={profile}
      />
    </>
  );
}
