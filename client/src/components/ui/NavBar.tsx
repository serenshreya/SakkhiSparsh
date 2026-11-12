'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface NavBarProps {
  profile: Profile | null;
}

export default function NavBar({ profile }: NavBarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const homeLink = profile?.role === 'doctor' ? '/doctor/dashboard' : '/upload';

  return (
    <nav className="nav-bar" id="main-navigation">
      <Link href={homeLink} className="nav-brand" id="nav-brand-link">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        DermScreen
      </Link>

      <div className="nav-actions">
        {profile && (
          <>
            <span className="nav-role-badge" id="nav-role-badge">
              {profile.role}
            </span>
            {profile.role === 'doctor' && (
              <Link href="/doctor/dashboard" className="btn btn--secondary btn--small" id="nav-dashboard-link">
                Dashboard
              </Link>
            )}
            {profile.role === 'patient' && (
              <Link href="/upload" className="btn btn--secondary btn--small" id="nav-upload-link">
                New Scan
              </Link>
            )}
            <button onClick={handleSignOut} className="btn btn--secondary btn--small" id="nav-signout-btn">
              Sign Out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
