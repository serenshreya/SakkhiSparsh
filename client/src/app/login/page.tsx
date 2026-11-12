'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
          },
        });

        if (signUpError) {
          // Handle specific Supabase error codes
          if (signUpError.message.toLowerCase().includes('rate limit')) {
            throw new Error('Too many sign-up attempts. Please wait a few minutes and try again.');
          }
          if (signUpError.message.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw signUpError;
        }

        // Check if Supabase returned a session (auto-confirm is ON)
        if (data.session) {
          router.push(role === 'doctor' ? '/doctor/dashboard' : '/upload');
          return;
        }

        // No session = email confirmation is required
        // Check if user was actually created (identities array not empty)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          // User already exists but is unconfirmed or this email is taken
          throw new Error('This email is already registered. Please sign in instead.');
        }

        // Show success message — user must confirm email
        setSuccessMsg(
          'Account created! Please check your email inbox and click the confirmation link before signing in. (Check your spam folder too.)'
        );
      } else {
        // Sign In
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error(
              'Invalid email or password. Make sure you have confirmed your email after signing up.'
            );
          }
          if (signInError.message.includes('Email not confirmed')) {
            throw new Error(
              'Your email has not been confirmed yet. Please check your inbox for the confirmation link.'
            );
          }
          throw signInError;
        }

        // Fetch profile to determine redirect
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          router.push(profile?.role === 'doctor' ? '/doctor/dashboard' : '/upload');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-bg-secondary)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-xl)' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-md)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              color: 'var(--color-accent-blue)',
            }}>
              DermScreen
            </span>
          </div>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            AI-Assisted Dermatological Pre-Screening
          </p>
        </div>

        {/* Card */}
        <div className="card" id="login-card">
          <h2 style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          <form onSubmit={handleSubmit} id="login-form">
            {isSignUp && (
              <>
                <div className="form-group">
                  <label htmlFor="fullName" className="form-label form-label--required">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Dr. Jane Smith"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role" className="form-label form-label--required">
                    Role
                  </label>
                  <select
                    id="role"
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'patient' | 'doctor')}
                  >
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                  </select>
                  <p className="form-hint">
                    Doctors get access to full findings, Grad-CAM, and feedback controls.
                  </p>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label form-label--required">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label form-label--required">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>

            {successMsg && (
              <div style={{
                marginBottom: 'var(--space-lg)',
                padding: 'var(--space-md)',
                backgroundColor: '#e8f5e9',
                border: '1px solid #4caf50',
                color: '#2e7d32',
                fontSize: 'var(--font-size-sm)',
                lineHeight: 'var(--line-height)',
              }} id="login-success">
                {successMsg}
              </div>
            )}

            {error && (
              <div className="form-error" style={{ marginBottom: 'var(--space-lg)' }} id="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn--primary btn--full btn--large"
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: 'var(--space-xl)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent-blue)',
                cursor: 'pointer',
                fontWeight: 500,
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
              id="toggle-auth-mode"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{
          marginTop: 'var(--space-xl)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          lineHeight: 'var(--line-height)',
        }}>
          This is a clinical decision-support tool for pre-screening purposes only.
          It does not replace professional medical diagnosis.
        </p>
      </div>
    </div>
  );
}
