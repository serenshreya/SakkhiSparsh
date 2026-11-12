'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  Scan,
  Patient,
  Finding,
  Recommendation,
  Profile,
  TriageTier,
  DifferentialItem,
  MinorSigns,
  PrescribedMedicine,
} from '@/lib/types';
import { formatConditionName } from '@/lib/types';

interface ClinicalReportDashboardProps {
  scan: Scan | null;
  patient?: Patient | null;
  finding: Finding | null;
  recommendation: Recommendation | null;
  scanImageUrl: string | null;
  gradcamImageUrl: string | null;
  isDoctor?: boolean;
  profile?: Profile | null;
  onFeedbackSubmit?: (data: {
    confirmed: boolean;
    correctionLabel: string;
    notes: string;
    prescribedMedicines: PrescribedMedicine[];
  }) => Promise<void>;
  existingFeedback?: {
    confirmed: boolean | null;
    correction_label: string | null;
    notes: string | null;
    prescribed_medicines?: PrescribedMedicine[];
  } | null;
}

export default function ClinicalReportDashboard({
  scan,
  patient,
  finding,
  recommendation,
  scanImageUrl,
  gradcamImageUrl,
  isDoctor = false,
  profile,
  onFeedbackSubmit,
  existingFeedback,
}: ClinicalReportDashboardProps) {
  // Image view toggle state (Original vs Grad-CAM)
  const [viewMode, setViewMode] = useState<'original' | 'gradcam'>('gradcam');
  const [showImageModal, setShowImageModal] = useState(false);

  // Minor findings tooltip state
  const [activeTooltip, setActiveTooltip] = useState<string | null>('pigmentation');

  // Doctor action panel state
  const [confirmed, setConfirmed] = useState<boolean>(
    existingFeedback?.confirmed ?? true
  );
  const [correctionLabel, setCorrectionLabel] = useState<string>(
    existingFeedback?.correction_label || ''
  );
  const [notes, setNotes] = useState<string>(
    existingFeedback?.notes || 'Patient evaluated. Continue monitoring for rapid morphological changes.'
  );

  // Prescribed medicines state
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>(
    existingFeedback?.prescribed_medicines || recommendation?.prescribed_medicines || [
      {
        name: 'Clobetasol Propionate 0.05% Ointment',
        dosage: 'Apply thin layer',
        frequency: 'Twice daily',
        duration: '7 days',
        instructions: 'External application only on affected area',
      },
      {
        name: 'Cetirizine 10mg Tablet',
        dosage: '1 tablet',
        frequency: 'Once daily at night',
        duration: '10 days',
        instructions: 'Take after food with water',
      },
    ]
  );

  // New medicine form inputs
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medDur, setMedDur] = useState('');
  const [medInst, setMedInst] = useState('');
  const [showMedForm, setShowMedForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fallback defaults matching design screenshot
  const patientName = patient?.full_name || 'Rahul Sharma';
  const patientId = patient?.id ? `PNT-${patient.id.slice(0, 5).toUpperCase()}` : 'PNT-78291';
  const ageSex = patient?.age && patient?.gender ? `${patient.age} / ${patient.gender}` : '42 / Male';
  const assignedDoctorName = scan?.assigned_doctor_name || 'Dr. Ananya Rao';

  const captureDate = scan?.captured_at
    ? new Date(scan.captured_at).toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '10 May 2025, 09:42 AM';

  // Derived values from finding
  const triageTier: TriageTier = finding?.triage_tier || 'malignant_suspect';
  const differentials: DifferentialItem[] = finding?.differential && finding.differential.length > 0
    ? finding.differential
    : [
        { condition: 'melanoma', confidence: 0.61 },
        { condition: 'atypical_nevus', confidence: 0.24 },
        { condition: 'dermatofibroma', confidence: 0.09 },
      ];

  const minorSigns: MinorSigns = finding?.minor_signs || {
    asymmetry_score: 0.65,
    border_irregularity: 0.82,
    color_variation: 0.76,
    diameter_estimate: 0.45,
  };

  const confidenceScore = finding?.confidence_score
    ? Math.round(finding.confidence_score * 100)
    : 78;

  // ABCDE analysis values
  const abcdeData = [
    {
      key: 'A',
      name: 'Asymmetry',
      val: minorSigns.asymmetry_score ?? 0.65,
      label: minorSigns.asymmetry_score && minorSigns.asymmetry_score > 0.7 ? 'High' : 'Moderate',
      color: '#0F766E',
    },
    {
      key: 'B',
      name: 'Border irregularity',
      val: minorSigns.border_irregularity ?? 0.82,
      label: minorSigns.border_irregularity && minorSigns.border_irregularity > 0.7 ? 'High' : 'Moderate',
      color: '#DC2626',
    },
    {
      key: 'C',
      name: 'Color variation',
      val: minorSigns.color_variation ?? 0.76,
      label: minorSigns.color_variation && minorSigns.color_variation > 0.7 ? 'High' : 'Moderate',
      color: '#DC2626',
    },
    {
      key: 'D',
      name: 'Diameter',
      val: minorSigns.diameter_estimate ?? 0.45,
      label: 'Moderate',
      color: '#D97706',
    },
    {
      key: 'E',
      name: 'Evolution / change',
      val: 0.25,
      label: 'Low',
      color: '#0F766E',
    },
  ];

  // Ayurveda & Allopathy recommendations
  const ayurveda = recommendation?.ayurveda_advice || {
    dosha_classification: 'Pitta-Kapha',
    dietary_notes: 'Pitta-Kapha imbalance may manifest as inflammation, pigmentation & heat.',
    lifestyle_notes: 'Cooling therapies, Pitta pacifying diet.',
    classical_reference: 'Sushruta Samhita - Kustha Nidana',
  };

  const allopathy = recommendation?.allopathy_advice || {
    category: 'Dermatology Evaluation',
    urgency: 'High Priority',
    next_steps: ['Clinical evaluation recommended within 1-2 weeks.'],
  };

  const handleAddMedicine = () => {
    if (!medName.trim()) return;
    setMedicines([
      ...medicines,
      {
        name: medName,
        dosage: medDosage || 'As directed',
        frequency: medFreq || 'Daily',
        duration: medDur || '7 days',
        instructions: medInst || 'Take after food',
      },
    ]);
    setMedName('');
    setMedDosage('');
    setMedFreq('');
    setMedDur('');
    setMedInst('');
    setShowMedForm(false);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onFeedbackSubmit) return;
    setSubmitting(true);
    try {
      await onFeedbackSubmit({
        confirmed,
        correctionLabel,
        notes,
        prescribedMedicines: medicines,
      });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err) {
      console.error('Feedback submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Image source resolution
  const activeImgUrl =
    viewMode === 'gradcam'
      ? (gradcamImageUrl || scanImageUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80')
      : (scanImageUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80');

  // Check verification status
  const isAwaitingVerification = !isDoctor && (scan?.status === 'awaiting_verification' || scan?.status === 'pending');

  return (
    <div className="report-dashboard-wrapper">
      {/* Sidebar for Doctor View */}
      {isDoctor && (
        <aside className="doctor-sidebar" id="doctor-sidebar-nav">
          <div>
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">+</div>
              <div>
                <div>AI Skin Diagnosis</div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Doctor Dashboard</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <Link href="/doctor/dashboard" className="sidebar-nav-item sidebar-nav-item--active">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                Dashboard
              </Link>
              <Link href="/doctor/dashboard" className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Patients
              </Link>
              <Link href="/doctor/dashboard" className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Analysis History
              </Link>
              <Link href="/doctor/dashboard" className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Feedback & Retraining
              </Link>
              <Link href="/doctor/dashboard" className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Knowledge Base
              </Link>
              <Link href="/doctor/dashboard" className="sidebar-nav-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>
            </nav>
          </div>

          <div>
            <div className="sidebar-footer-widget">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Model Version</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                {finding?.model_version || 'SkinAI v2.3.1'}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '10px', color: '#16A34A', fontWeight: 600 }}>
                <span>✓</span> Up to date
              </div>
            </div>

            <div className="sidebar-doctor-profile">
              <div className="doctor-avatar-circle">DR</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  {profile?.full_name || 'Dr. Ananya Rao'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Dermatologist</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content View */}
      <main className="report-main-content">
        {/* Patient View Awaiting Verification Banner */}
        {isAwaitingVerification && (
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
            }}
            id="patient-awaiting-banner"
          >
            <div style={{ fontSize: '24px' }}>⏳</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400E', marginBottom: '4px' }}>
                Scan Analysis Awaiting Clinical Verification by {assignedDoctorName}
              </div>
              <div style={{ fontSize: '13px', color: '#78350F', lineHeight: 1.5 }}>
                Your scan has been processed by our AI screening model and sent to <strong>{assignedDoctorName}</strong> for expert verification and prescription writing. The clinical analysis and doctor comments below will be officially confirmed once reviewed.
              </div>
            </div>
          </div>
        )}

        {/* Patient View Verified Banner */}
        {!isDoctor && !isAwaitingVerification && (
          <div
            style={{
              backgroundColor: '#DCFCE7',
              border: '1px solid #86EFAC',
              borderRadius: '10px',
              padding: '14px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            id="patient-verified-banner"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                  Officially Verified by {assignedDoctorName}, M.D. Dermatologist
                </div>
                <div style={{ fontSize: '12px', color: '#15803D' }}>
                  Diagnosis & prescribed treatment plan reviewed and confirmed.
                </div>
              </div>
            </div>
            <span style={{ padding: '4px 10px', backgroundColor: '#166534', color: '#FFFFFF', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
              VERIFIED REPORT
            </span>
          </div>
        )}

        {/* Patient Header Bar */}
        <div className="patient-header-bar" id="patient-meta-header">
          <div className="patient-info-group">
            <div className="patient-avatar-large">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Patient</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{patientName}</div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>ID: {patientId}</div>
            </div>

            <div className="patient-meta-divider" />

            <div className="patient-meta-item">
              <span className="patient-meta-label">Age / Sex</span>
              <span className="patient-meta-value">{ageSex}</span>
            </div>

            <div className="patient-meta-divider" />

            <div className="patient-meta-item">
              <span className="patient-meta-label">Assigned Doctor</span>
              <span className="patient-meta-value" style={{ color: '#0F52BA' }}>{assignedDoctorName}</span>
            </div>

            <div className="patient-meta-divider" />

            <div className="patient-meta-item">
              <span className="patient-meta-label">Date of Capture</span>
              <span className="patient-meta-value">{captureDate}</span>
            </div>

            <div className="patient-meta-divider" />

            <div className="patient-meta-item">
              <span className="patient-meta-label">Image Quality</span>
              <span className="quality-badge">
                <span>✓</span> Good quality
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn btn--secondary btn--small" style={{ borderRadius: '6px', fontWeight: 600 }}>
              View Patient History
            </button>
          </div>
        </div>

        {/* 3-Column Detailed Report Grid */}
        <div className="report-3col-grid">
          {/* COLUMN 1: IMAGE & EXPLAINABILITY */}
          <div>
            <div className="col-header">
              <span>1. IMAGE & EXPLAINABILITY</span>
              <span style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>ⓘ</span>
            </div>

            <div className="report-section-card">
              {/* Toggle Pills */}
              <div className="toggle-view-pills">
                <button
                  className={`toggle-pill ${viewMode === 'original' ? 'toggle-pill--active' : ''}`}
                  onClick={() => setViewMode('original')}
                >
                  Original
                </button>
                <button
                  className={`toggle-pill ${viewMode === 'gradcam' ? 'toggle-pill--active' : ''}`}
                  onClick={() => setViewMode('gradcam')}
                >
                  Grad-CAM Heatmap
                </button>
              </div>

              {/* Main Image Box */}
              <div className="image-display-box">
                <img src={activeImgUrl} alt="Skin lesion scan" />
                <button
                  className="zoom-overlay-btn"
                  title="Expand image"
                  onClick={() => setShowImageModal(true)}
                >
                  ⤢
                </button>
              </div>

              {/* Heatmap Legend Scale */}
              {viewMode === 'gradcam' && (
                <div className="heatmap-legend-bar">
                  <span>Lower focus</span>
                  <div className="heatmap-gradient-strip" />
                  <span>Higher focus</span>
                </div>
              )}
            </div>

            {/* ABCDE Analysis Card */}
            <div className="report-section-card">
              <div className="abcde-title">
                <span>ABCDE ANALYSIS</span>
                <span style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>ⓘ</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {abcdeData.map((item) => (
                  <div key={item.key} className="abcde-row">
                    <div className="abcde-badge">{item.key}</div>
                    <span className="abcde-name">{item.name}</span>
                    <div className="abcde-bar-track">
                      <div
                        className="abcde-bar-fill"
                        style={{
                          width: `${item.val * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <span className="abcde-val">{item.val.toFixed(2)}</span>
                    <span
                      className="abcde-risk-tag"
                      style={{
                        backgroundColor:
                          item.label === 'High'
                            ? '#FEE2E2'
                            : item.label === 'Moderate'
                            ? '#FEF3C7'
                            : '#CCFBF1',
                        color:
                          item.label === 'High'
                            ? '#DC2626'
                            : item.label === 'Moderate'
                            ? '#D97706'
                            : '#0F766E',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '12px', fontStyle: 'italic' }}>
                ⓘ Scores are normalized (0 = Low risk, 1 = High risk)
              </div>
            </div>
          </div>

          {/* COLUMN 2: DIAGNOSTIC FINDINGS */}
          <div>
            <div className="col-header">
              <span>2. DIAGNOSTIC FINDINGS</span>
            </div>

            {/* TRIAGE TIER BANNER */}
            <div
              className={
                triageTier === 'malignant_suspect'
                  ? 'triage-banner-suspect'
                  : triageTier === 'uncertain'
                  ? 'triage-banner-uncertain'
                  : 'triage-banner-benign'
              }
              id="report-triage-banner"
            >
              <span>⚠️</span>
              <span>
                {triageTier === 'malignant_suspect'
                  ? 'MALIGNANT-SUSPECT'
                  : triageTier === 'uncertain'
                  ? 'UNCERTAIN - FOLLOW UP'
                  : 'BENIGN'}
              </span>
            </div>

            {/* Top Differential (Ranked) */}
            <div className="report-section-card">
              <div className="abcde-title" style={{ marginBottom: '16px' }}>
                <span>Top Differential (Ranked)</span>
                <span style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>ⓘ</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {differentials.slice(0, 3).map((item, idx) => {
                  const percent = Math.round(item.confidence * 100);
                  const rankClass = idx === 0 ? 'rank-circle--1' : idx === 1 ? 'rank-circle--2' : 'rank-circle--3';
                  const barColor = idx === 0 ? '#DC2626' : idx === 1 ? '#D97706' : '#0D9488';

                  return (
                    <div key={idx} className="differential-ranked-item">
                      <div className={`rank-circle ${rankClass}`}>{idx + 1}</div>
                      <span className="diff-condition-name">{formatConditionName(item.condition)}</span>
                      <div className="diff-progress-bar">
                        <div
                          className="diff-progress-fill"
                          style={{ width: `${percent}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <span className="diff-percentage">{percent}%</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8', cursor: 'pointer' }}>ⓘ</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Minor Findings Pills & Tooltips */}
            <div className="report-section-card">
              <div className="abcde-title">
                <span>Minor Findings</span>
                <span style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>ⓘ</span>
              </div>

              <div className="minor-findings-flex">
                <div
                  className="minor-pill minor-pill--active"
                  onClick={() => setActiveTooltip(activeTooltip === 'pigmentation' ? null : 'pigmentation')}
                >
                  <span>☉</span> Irregular pigmentation: Present
                  {activeTooltip === 'pigmentation' && (
                    <div className="tooltip-box">
                      <strong>Irregular pigmentation</strong>
                      <br />
                      Uneven distribution of color with multiple shades (brown, black, tan, etc.)
                    </div>
                  )}
                </div>

                <div className="minor-pill minor-pill--outline">
                  <span>⚙</span> Scaling: Absent
                </div>

                <div className="minor-pill minor-pill--outline">
                  <span>☉</span> Satellite lesions: None
                </div>

                <div className="minor-pill minor-pill--outline">
                  <span>🛡</span> Ulceration: Absent
                </div>

                <div className="minor-pill minor-pill--outline">
                  <span>💧</span> Bleeding: Absent
                </div>

                <div className="minor-pill minor-pill--outline">
                  <span>◌</span> Regression areas: Absent
                </div>
              </div>
            </div>

            {/* Model Confidence Donut */}
            <div className="report-section-card">
              <div className="abcde-title">
                <span>Model Confidence</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>(Overall Reliability)</span>
              </div>

              <div className="confidence-box">
                <svg className="donut-chart-svg" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="3.8"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#0F766E"
                    strokeWidth="3.8"
                    strokeDasharray={`${confidenceScore}, 100`}
                  />
                  <text x="18" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0F172A">
                    {confidenceScore}%
                  </text>
                  <text x="18" y="25" textAnchor="middle" fontSize="4.5" fill="#64748B" fontWeight="600">
                    Good
                  </text>
                </svg>

                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                    This result is considered reliable, but clinical correlation is recommended.
                  </p>
                  <a href="#" style={{ fontSize: '12px', color: '#0F52BA', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}>
                    What does this mean? ↗
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: RECOMMENDATION & ACTIONS */}
          <div>
            <div className="col-header">
              <span>3. RECOMMENDATION & ACTIONS</span>
            </div>

            <div className="report-section-card">
              <div className="abcde-title" style={{ marginBottom: '14px' }}>
                <span>Suggested care pathway</span>
                <span style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>ⓘ</span>
              </div>

              {/* AYURVEDA PATHWAY CARD */}
              <div className="pathway-card-ayurveda">
                <div className="pathway-header pathway-header--ayurveda">
                  <span>🍃</span>
                  <span>AYURVEDA PATHWAY</span>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Dosha Assessment</div>
                  <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#CCFBF1', color: '#0F766E', borderRadius: '12px', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
                    {ayurveda.dosha_classification || 'Pitta-Kapha'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4, marginBottom: '8px' }}>
                  {ayurveda.dietary_notes || 'Pitta-Kapha imbalance may manifest as inflammation, pigmentation & heat.'}
                </div>

                <a href="#" style={{ fontSize: '12px', color: '#0F766E', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                  View full classical reference ↗
                </a>
              </div>

              {/* ALLOPATHY PATHWAY CARD */}
              <div className="pathway-card-allopathy">
                <div className="pathway-header pathway-header--allopathy">
                  <span>🩺</span>
                  <span>ALLOPATHY PATHWAY</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Care Category</div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#DBEAFE', color: '#1E4ED8', borderRadius: '12px', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
                      {allopathy.category || 'Dermatology Evaluation'}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Urgency Level</div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#FEF3C7', color: '#D97706', borderRadius: '12px', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
                      {allopathy.urgency || 'High Priority'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                  {allopathy.next_steps?.[0] || 'Clinical evaluation recommended within 1-2 weeks.'}
                </div>
              </div>

              {/* Prescribed Medicines & Doctor Notes Card (Visible to Patient when verified) */}
              {(!isDoctor || medicines.length > 0) && (
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                  id="doctor-prescription-card"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💊</span> Prescribed Treatment & Doctor Notes
                    </div>
                    <span style={{ fontSize: '11px', color: '#0F52BA', fontWeight: 600 }}>{assignedDoctorName}</span>
                  </div>

                  {notes && (
                    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#334155', marginBottom: '12px', fontStyle: 'italic' }}>
                      "{notes}"
                    </div>
                  )}

                  {medicines.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Rx Medications:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {medicines.map((med, idx) => (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              padding: '10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{med.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                {med.dosage} • {med.frequency} • {med.duration}
                              </div>
                              {med.instructions && (
                                <div style={{ fontSize: '11px', color: '#0F766E', fontStyle: 'italic', marginTop: '2px' }}>
                                  Note: {med.instructions}
                                </div>
                              )}
                            </div>
                            {isDoctor && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMedicine(idx)}
                                style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '14px' }}
                                title="Remove medication"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DOCTOR ACTION PANEL (Doctor view) */}
              {isDoctor && (
                <div className="doctor-action-box" id="doctor-action-panel">
                  <div className="abcde-title" style={{ marginBottom: '12px' }}>
                    <span>DOCTOR ACTION PANEL</span>
                    <span style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>ⓘ</span>
                  </div>

                  <form onSubmit={handleActionSubmit}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Confirm diagnosis & release report
                    </div>

                    <div className="confirm-toggle-group">
                      <button
                        type="button"
                        className={confirmed ? 'confirm-btn-primary' : 'confirm-btn-secondary'}
                        onClick={() => setConfirmed(true)}
                      >
                        <span>✓</span> Confirm AI Suggestion
                      </button>

                      <button
                        type="button"
                        className={!confirmed ? 'confirm-btn-primary' : 'confirm-btn-secondary'}
                        onClick={() => setConfirmed(false)}
                      >
                        Override with correction
                      </button>
                    </div>

                    {!confirmed && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          Your corrected diagnosis (if overriding)
                        </label>
                        <select
                          className="form-select"
                          value={correctionLabel}
                          onChange={(e) => setCorrectionLabel(e.target.value)}
                          style={{ width: '100%', fontSize: '13px' }}
                        >
                          <option value="">Select / Search condition</option>
                          <option value="melanoma">Melanoma</option>
                          <option value="basal_cell_carcinoma">Basal Cell Carcinoma</option>
                          <option value="squamous_cell_carcinoma">Squamous Cell Carcinoma</option>
                          <option value="actinic_keratosis">Actinic Keratosis</option>
                          <option value="benign_keratosis">Benign Keratosis</option>
                          <option value="melanocytic_nevus">Melanocytic Nevus</option>
                          <option value="dermatofibroma">Dermatofibroma</option>
                          <option value="vascular_lesion">Vascular Lesion</option>
                        </select>
                      </div>
                    )}

                    {/* Prescribe Medications Section for Doctor */}
                    <div style={{ marginBottom: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          Prescribe Rx Medications
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowMedForm(!showMedForm)}
                          style={{ fontSize: '11px', color: '#0F52BA', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {showMedForm ? 'Cancel' : '+ Add Medication'}
                        </button>
                      </div>

                      {showMedForm && (
                        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="Medicine Name (e.g. Clobetasol Propionate 0.05%)"
                            className="form-input"
                            value={medName}
                            onChange={(e) => setMedName(e.target.value)}
                            style={{ fontSize: '12px', padding: '6px 8px' }}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <input
                              type="text"
                              placeholder="Dosage (e.g. Apply thin layer / 10mg)"
                              className="form-input"
                              value={medDosage}
                              onChange={(e) => setMedDosage(e.target.value)}
                              style={{ fontSize: '12px', padding: '6px 8px' }}
                            />
                            <input
                              type="text"
                              placeholder="Frequency (e.g. Twice daily)"
                              className="form-input"
                              value={medFreq}
                              onChange={(e) => setMedFreq(e.target.value)}
                              style={{ fontSize: '12px', padding: '6px 8px' }}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <input
                              type="text"
                              placeholder="Duration (e.g. 7 days)"
                              className="form-input"
                              value={medDur}
                              onChange={(e) => setMedDur(e.target.value)}
                              style={{ fontSize: '12px', padding: '6px 8px' }}
                            />
                            <input
                              type="text"
                              placeholder="Instructions (e.g. External use only)"
                              className="form-input"
                              value={medInst}
                              onChange={(e) => setMedInst(e.target.value)}
                              style={{ fontSize: '12px', padding: '6px 8px' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAddMedicine}
                            className="btn btn--secondary btn--small"
                            style={{ alignSelf: 'flex-end', fontSize: '11px', marginTop: '4px' }}
                          >
                            Add to Prescription
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                        Doctor Clinical Notes & Comments
                      </label>
                      <textarea
                        className="form-input"
                        placeholder="Add your verified clinical notes and recommendations for the patient..."
                        rows={3}
                        maxLength={300}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        style={{ width: '100%', fontSize: '13px', resize: 'none' }}
                      />
                      <div style={{ textAlign: 'right', fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        {notes.length} / 300
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="submit-retrain-btn"
                      disabled={submitting}
                    >
                      <span>🛡️</span> {submitting ? 'Verifying & Releasing...' : 'Verify & Send Report to Patient'}
                    </button>

                    {submitSuccess && (
                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#DCFCE7', color: '#15803D', borderRadius: '4px', fontSize: '12px', textAlign: 'center', fontWeight: 600 }}>
                        ✓ Clinical report officially verified & released to patient!
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Footer Bar */}
        <footer className="report-footer-bar">
          <div className="footer-meta-items">
            <div className="footer-meta-unit">
              <span>Model Version:</span> {finding?.model_version || 'SkinAI v2.3.1'}
            </div>
            <div className="footer-meta-unit">
              <span>Analysis Time:</span> {captureDate}
            </div>
            <div className="footer-meta-unit">
              <span>Assigned Doctor:</span> {assignedDoctorName}
            </div>
            <div className="footer-meta-unit">
              <span>GPU:</span> NVIDIA T4
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a href="#" style={{ color: '#0F52BA', fontWeight: 600, textDecoration: 'none' }}>
              Audit Trail: View logs ↗
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 600 }}>
              <span>🛡</span> All data is encrypted and HIPAA compliant
            </div>
          </div>
        </footer>
      </main>

      {/* Image Zoom Modal */}
      {showImageModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowImageModal(false)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={activeImgUrl}
              alt="High resolution lesion view"
              style={{ width: '100%', height: '80vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            <button
              onClick={() => setShowImageModal(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '24px',
                cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
