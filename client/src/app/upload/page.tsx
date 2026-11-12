'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NavBar from '@/components/ui/NavBar';
import type { Profile, DoctorOption } from '@/lib/types';
import { BODY_LOCATIONS, SYMPTOM_DURATIONS } from '@/lib/types';
import { STORAGE_BUCKETS, MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Image state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Symptom form state
  const [symptomDuration, setSymptomDuration] = useState('');
  const [symptomItch, setSymptomItch] = useState(false);
  const [symptomPain, setSymptomPain] = useState(false);
  const [bodyLocation, setBodyLocation] = useState('');

  // Consulting doctor selection state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [doctorsList, setDoctorsList] = useState<DoctorOption[]>([]);

  // Model status
  const [modelStatus, setModelStatus] = useState<{
    model_loaded: boolean; demo_mode: boolean; model_version: string;
  } | null>(null);

  // Load profile + real doctor accounts + model status
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (data) setProfile(data as Profile);
      }

      // Fetch registered doctor accounts from /api/doctors (bypasses browser RLS)
      try {
        const docRes = await fetch('/api/doctors');
        if (docRes.ok) {
          const docData = await docRes.json();
          if (docData.doctors && docData.doctors.length > 0) {
            setDoctorsList(docData.doctors);
            setSelectedDoctorId(docData.doctors[0].id);
          }
        }
      } catch (docErr) {
        console.error('Failed to load doctors list:', docErr);
      }
    };

    loadData();

    // Check inference server status
    fetch('/api/inference')
      .then(res => res.json())
      .then(data => setModelStatus(data))
      .catch(() => setModelStatus({ model_loaded: false, demo_mode: true, model_version: 'offline' }));
  }, [supabase]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be under 10MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Ensure patient record exists
      let { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!patient) {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            user_id: user.id,
            full_name: profile?.full_name || 'Patient',
          })
          .select('id')
          .single();
        if (patientError) throw patientError;
        patient = newPatient;
      }

      // 2. Upload image to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.SCAN_IMAGES)
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 3. Create scan record with assigned doctor (failsafe for DB schema variations)
      const assignedDoc = doctorsList.find((d) => d.id === selectedDoctorId) || doctorsList[0] || { id: 'doc-1', full_name: 'Dr. Ananya Rao' };

      let scan: { id: string } | null = null;

      // Try inserting with assigned_doctor columns first
      const { data: scanWithDoc, error: scanError1 } = await supabase
        .from('scans')
        .insert({
          patient_id: patient!.id,
          image_url: fileName,
          symptom_duration: symptomDuration || null,
          symptom_itch: symptomItch,
          symptom_pain: symptomPain,
          body_location: bodyLocation || null,
          status: 'pending',
          assigned_doctor_id: assignedDoc.id,
          assigned_doctor_name: assignedDoc.full_name,
        })
        .select('id')
        .single();

      if (scanWithDoc) {
        scan = scanWithDoc;
      } else if (scanError1) {
        console.warn('Inserting scan with doctor columns failed, falling back to base columns:', scanError1.message);
        // Fallback: insert base columns only if assigned_doctor columns don't exist in Postgres
        const { data: baseScan, error: scanError2 } = await supabase
          .from('scans')
          .insert({
            patient_id: patient!.id,
            image_url: fileName,
            symptom_duration: symptomDuration || null,
            symptom_itch: symptomItch,
            symptom_pain: symptomPain,
            body_location: bodyLocation || null,
            status: 'pending',
          })
          .select('id')
          .single();

        if (scanError2) throw scanError2;
        scan = baseScan;
      }

      // 4. Trigger inference via API route
      const inferenceResponse = await fetch('/api/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId: scan!.id,
          assignedDoctorName: assignedDoc.full_name,
        }),
      });

      if (!inferenceResponse.ok) {
        const errData = await inferenceResponse.json().catch(() => ({}));
        console.error('Inference error:', errData);
        setSuccess(`Scan uploaded. Sent to ${assignedDoc.full_name} for verification.`);
      } else {
        setSuccess(`Scan uploaded & AI pre-screened! Sent to ${assignedDoc.full_name} for verification.`);
      }

      // 5. Redirect to patient report view
      setTimeout(() => {
        router.push(`/patient/${scan!.id}`);
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <NavBar profile={profile} />

      <div className="page-container page-container--form">
        {/* Model Status Banner */}
        {modelStatus && (
          <div
            id="model-status-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              marginBottom: 'var(--space-lg)',
              fontSize: 'var(--font-size-sm)',
              border: '1px solid',
              borderColor: modelStatus.model_loaded ? '#4caf50' : '#ff9800',
              backgroundColor: modelStatus.model_loaded ? '#e8f5e9' : '#fff3e0',
              color: modelStatus.model_loaded ? '#2e7d32' : '#e65100',
            }}
          >
            <span style={{ fontSize: '14px' }}>
              {modelStatus.model_loaded ? '●' : '●'}
            </span>
            <span>
              {modelStatus.model_loaded
                ? `AI Model Active (${modelStatus.model_version})`
                : 'Demo Mode — predictions are synthetic. Place trained model files in server/inference_server/models/ and restart.'}
            </span>
          </div>
        )}

        <div className="page-header">
          <h1>Upload Skin Scan</h1>
          <p>Take a clear, well-lit photo of the affected area for AI-assisted pre-screening.</p>
        </div>

        <form onSubmit={handleSubmit} id="upload-form">
          {/* Image Upload */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>Scan Image</h3>

            {!previewUrl ? (
              <div
                className="upload-area"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                id="upload-dropzone"
              >
                <div className="upload-area__icon">📷</div>
                <div className="upload-area__text">
                  Click to select or drag an image here
                </div>
                <div className="upload-area__hint">
                  JPEG, PNG, or WebP • Max 10MB • Min 224×224px
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div className="upload-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Scan preview" />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <span className="text-sm text-muted">{selectedFile?.name}</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="btn btn--secondary btn--small"
                    id="clear-image-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-input"
            />
          </div>

          {/* Select Consulting Doctor Card */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }} id="select-doctor-card">
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Select Consulting Doctor for Verification</h3>
            <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-lg)' }}>
              Your scan will be analyzed by our AI model and sent directly to your chosen specialist for clinical verification.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
              {doctorsList.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoctorId(doc.id)}
                  style={{
                    border: '1px solid',
                    borderColor: selectedDoctorId === doc.id ? '#0F52BA' : '#E2E8F0',
                    backgroundColor: selectedDoctorId === doc.id ? '#EFF6FF' : '#FFFFFF',
                    borderRadius: '8px',
                    padding: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: selectedDoctorId === doc.id ? '#0F52BA' : '#DBEAFE',
                        color: selectedDoctorId === doc.id ? '#FFFFFF' : '#1D4ED8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                      }}
                    >
                      DR
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{doc.full_name}</div>
                      <div style={{ fontSize: '11px', color: '#0F52BA', fontWeight: 600 }}>{doc.specialty}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>🏥 {doc.hospital}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Symptom Form */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>Symptoms</h3>

            <div className="form-group">
              <label htmlFor="bodyLocation" className="form-label">
                Body Location
              </label>
              <select
                id="bodyLocation"
                className="form-select"
                value={bodyLocation}
                onChange={(e) => setBodyLocation(e.target.value)}
              >
                <option value="">Select location...</option>
                {BODY_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="symptomDuration" className="form-label">
                How long have you had this?
              </label>
              <select
                id="symptomDuration"
                className="form-select"
                value={symptomDuration}
                onChange={(e) => setSymptomDuration(e.target.value)}
              >
                <option value="">Select duration...</option>
                {SYMPTOM_DURATIONS.map((dur) => (
                  <option key={dur} value={dur}>{dur}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div className="form-checkbox-group">
                <input
                  type="checkbox"
                  id="symptomItch"
                  checked={symptomItch}
                  onChange={(e) => setSymptomItch(e.target.checked)}
                />
                <label htmlFor="symptomItch" className="form-label" style={{ marginBottom: 0 }}>
                  Itching present
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="form-checkbox-group">
                <input
                  type="checkbox"
                  id="symptomPain"
                  checked={symptomPain}
                  onChange={(e) => setSymptomPain(e.target.checked)}
                />
                <label htmlFor="symptomPain" className="form-label" style={{ marginBottom: 0 }}>
                  Pain or tenderness
                </label>
              </div>
            </div>
          </div>

          {/* Error / Success Messages */}
          {error && (
            <div className="disclaimer-banner" style={{ marginBottom: 'var(--space-lg)', borderColor: 'var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)', color: 'var(--color-risk-high)' }} id="upload-error">
              {error}
            </div>
          )}
          {success && (
            <div className="disclaimer-banner disclaimer-banner--info" style={{ marginBottom: 'var(--space-lg)' }} id="upload-success">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn--primary btn--full btn--large"
            disabled={loading || !selectedFile}
            id="upload-submit-btn"
          >
            {loading ? 'Uploading & Analyzing...' : 'Upload & Analyze'}
          </button>

          <p className="text-xs text-muted text-center mt-lg">
            Your image is stored securely and only accessible to you and authorized medical professionals.
          </p>
        </form>
      </div>
    </>
  );
}
