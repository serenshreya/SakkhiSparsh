'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Profile, ScanStatus, TriageTier } from '@/lib/types';
import { TRIAGE_CONFIG } from '@/lib/types';

interface ScanRow {
  id: string;
  patient_id: string;
  status: ScanStatus;
  captured_at: string;
  body_location: string | null;
  patient_name: string;
  triage_tier: TriageTier | null;
}

export default function DoctorDashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTriage, setFilterTriage] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      if (profileData) setProfile(profileData as Profile);

      // Fetch scans with patient info and findings
      const { data: scansData } = await supabase
        .from('scans')
        .select(`
          id,
          patient_id,
          status,
          captured_at,
          body_location,
          patients(full_name),
          findings(triage_tier)
        `)
        .order('captured_at', { ascending: false })
        .limit(100);

      if (scansData) {
        const rows: ScanRow[] = scansData.map((s: Record<string, unknown>) => {
          const patients = s.patients as Record<string, unknown> | null;
          const findings = s.findings as Record<string, unknown>[] | null;
          return {
            id: s.id as string,
            patient_id: s.patient_id as string,
            status: s.status as ScanStatus,
            captured_at: s.captured_at as string,
            body_location: s.body_location as string | null,
            patient_name: (patients?.full_name as string) || 'Rahul Sharma',
            triage_tier: findings?.[0]?.triage_tier as TriageTier | null,
          };
        });
        setScans(rows);
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const filteredScans = filterTriage === 'all'
    ? scans
    : scans.filter((s) =>
        filterTriage === 'pending'
          ? s.triage_tier === null
          : s.triage_tier === filterTriage
      );

  const statusLabel = (status: ScanStatus) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'awaiting_verification': return 'Awaiting Doctor Review';
      case 'completed': return 'Verified & Released';
      case 'error': return 'Error';
    }
  };

  return (
    <div className="report-dashboard-wrapper">
      {/* Sidebar for Doctor */}
      <aside className="doctor-sidebar" id="doctor-sidebar">
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
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>SkinAI v2.3.1</div>
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

      {/* Main Table Content */}
      <main className="report-main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>Doctor Dashboard</h1>
            <p style={{ fontSize: '14px', color: '#64748B' }}>{scans.length} patient scans total requiring evaluation</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label htmlFor="triageFilter" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              Filter by Triage:
            </label>
            <select
              id="triageFilter"
              className="form-select"
              style={{ width: 'auto', minWidth: '180px', fontSize: '13px' }}
              value={filterTriage}
              onChange={(e) => setFilterTriage(e.target.value)}
            >
              <option value="all">All scans</option>
              <option value="pending">Awaiting analysis</option>
              <option value="malignant_suspect">Malignant suspect</option>
              <option value="uncertain">Uncertain</option>
              <option value="benign">Benign</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-text">Loading patient scans list...</div>
        ) : filteredScans.length === 0 ? (
          <div className="report-section-card" style={{ textAlign: 'center', padding: '48px' }}>
            <p style={{ color: '#64748B' }}>No scans found matching the selected filter.</p>
          </div>
        ) : (
          <div className="report-section-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table data-table--clickable" id="scans-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Date Captured</th>
                  <th>Body Location</th>
                  <th>Status</th>
                  <th>Triage Tier</th>
                  <th>Detailed Report</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.map((scan) => (
                  <tr key={scan.id}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{scan.patient_name}</td>
                    <td style={{ fontSize: '13px', color: '#64748B' }} suppressHydrationWarning>
                      {new Date(scan.captured_at).toLocaleDateString()}{' '}
                      {new Date(scan.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontSize: '13px' }}>{scan.body_location || '—'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <span className={`status-dot status-dot--${scan.status}`} />
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{statusLabel(scan.status)}</span>
                      </span>
                    </td>
                    <td>
                      {scan.triage_tier ? (
                        <span className={`badge ${TRIAGE_CONFIG[scan.triage_tier].cssClass}`}>
                          {TRIAGE_CONFIG[scan.triage_tier].label.split('—')[0].trim()}
                        </span>
                      ) : (
                        <span className="badge badge--neutral">Awaiting Analysis</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/doctor/${scan.id}`}
                        className="btn btn--primary btn--small"
                        style={{ borderRadius: '6px', padding: '6px 14px', fontSize: '12px' }}
                      >
                        View Detailed Report ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
