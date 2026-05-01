import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, clearAuthStorage } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

/**
 * Handles Supabase auth callbacks (magic links, password recovery, email confirmations).
 *
 * Supabase's `/auth/v1/verify` endpoint redirects here with EITHER tokens
 * (`#access_token=...&refresh_token=...&type=magiclink`) on success OR an
 * error fragment (`#error=access_denied&error_code=otp_expired&...`) on
 * failure. The previous version of this page only checked `getSession()`
 * and silently bounced to `/login` on either error or race conditions —
 * which is exactly how a real invitee got stuck (see 2026-04-30 incident:
 * recovery_sent_at recorded but no session created).
 *
 * This version:
 *   1. Subscribes to `onAuthStateChange` so the SIGNED_IN event from the
 *      URL-hash detection wins even if it fires AFTER our initial read.
 *   2. Parses the hash for `error=` and surfaces the real reason.
 *   3. After 8s with neither outcome, declares the link expired/used
 *      and offers a "Request a new sign-in link" button.
 */

const HUMAN_ERRORS = {
  otp_expired: 'Your sign-in link has expired. Request a new one below.',
  access_denied: 'This sign-in link is no longer valid. It may have already been used or expired.',
  invalid_request: 'That sign-in link looks invalid. Request a new one below.',
  server_error: 'A server error occurred while signing you in. Please try again.',
};

function safeReturnTo(rawReturnTo) {
  if (!rawReturnTo) return '/';
  try {
    if (typeof rawReturnTo !== 'string') return '/';
    if (!rawReturnTo.startsWith('/') || rawReturnTo.startsWith('//')) return '/';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawReturnTo)) return '/';
    const u = new URL(rawReturnTo, window.location.origin);
    if (u.origin !== window.location.origin) return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/';
  }
}

function parseHashError(hash) {
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const error = params.get('error');
  const code = params.get('error_code');
  const description = params.get('error_description');
  if (!error && !code) return null;
  return {
    code: code || error,
    message: HUMAN_ERRORS[code] || HUMAN_ERRORS[error] || description?.replace(/\+/g, ' ') || 'Sign-in failed.',
  };
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | error | success
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));

    // 1. If the URL hash carries an explicit error, fail fast.
    const hashError = parseHashError(window.location.hash);
    if (hashError) {
      settledRef.current = true;
      setStatus('error');
      setErrorMessage(hashError.message);
      return;
    }

    // 2. Subscribe to auth state changes so a SIGNED_IN event fired after
    //    our initial read still wins.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settledRef.current) return;
      if (event === 'SIGNED_IN' && session) {
        settledRef.current = true;
        setStatus('success');
        setTimeout(() => navigate(returnTo, { replace: true }), 600);
      }
    });

    // 3. Also probe getSession() — covers the case where detectSessionInUrl
    //    completed before this component mounted.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (settledRef.current) return;
      if (error) {
        settledRef.current = true;
        setStatus('error');
        setErrorMessage(error.message || 'Failed to read session.');
        return;
      }
      if (session) {
        settledRef.current = true;
        setStatus('success');
        setTimeout(() => navigate(returnTo, { replace: true }), 600);
      }
    });

    // 4. Backstop: if neither path settles within 8s, declare failure.
    const timeoutId = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      setStatus('error');
      setErrorMessage('We could not complete sign-in. The link may have expired or already been used.');
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  const handleRequestNewLink = async (e) => {
    e?.preventDefault();
    if (!email) {
      toast.error('Enter your email address');
      return;
    }
    setResending(true);
    try {
      // Wipe any stale session before requesting — guarantees the next
      // click lands in a clean tab.
      await clearAuthStorage();
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setResent(true);
      toast.success('New sign-in link sent. Check your email.');
    } catch (err) {
      toast.error(err.message || 'Failed to send a new link');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Signing you in...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Authenticated. Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-left shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Sign-in didn't complete</h2>
            <p className="text-sm text-slate-600 mb-4">{errorMessage}</p>

            {resent ? (
              <p className="text-sm text-emerald-700">
                A new sign-in link has been sent to <strong>{email}</strong>. Check your inbox (and spam).
              </p>
            ) : (
              <form onSubmit={handleRequestNewLink} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="resend-email" className="text-slate-700 text-sm">
                    Your email
                  </Label>
                  <Input
                    id="resend-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resending}>
                  {resending ? 'Sending...' : 'Request a new sign-in link'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/login', { replace: true })}
                >
                  Back to sign in
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
