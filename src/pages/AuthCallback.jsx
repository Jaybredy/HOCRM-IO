import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';

/**
 * Handles Supabase auth callbacks (password recovery, magic links, email confirmations).
 * Supabase redirects here with tokens in the URL hash.
 */

// Only allow same-origin paths as ?returnTo. Reject absolute URLs, schemes,
// protocol-relative refs, anything that could leak the session token to a
// third-party origin via an open-redirect chain.
function safeReturnTo(rawReturnTo) {
  if (!rawReturnTo) return '/';
  try {
    // Must start with `/` and not `//` (protocol-relative). Reject schemes.
    if (typeof rawReturnTo !== 'string') return '/';
    if (!rawReturnTo.startsWith('/') || rawReturnTo.startsWith('//')) return '/';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawReturnTo)) return '/';
    // Resolve against current origin and confirm origin didn't change.
    const u = new URL(rawReturnTo, window.location.origin);
    if (u.origin !== window.location.origin) return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/';
  }
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase puts tokens in the URL hash fragment
        // The JS client automatically picks them up via onAuthStateChange
        const { data: { session }, error } = await supabase.auth.getSession();

        const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));

        if (error) {
          setMessage(`Authentication error: ${error.message}`);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (session) {
          setMessage('Authenticated! Redirecting...');
          setTimeout(() => navigate(returnTo), 1000);
        } else {
          setMessage('No session found. Redirecting to login...');
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (err) {
        setMessage(`Error: ${err.message}`);
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">{message}</p>
      </div>
    </div>
  );
}
