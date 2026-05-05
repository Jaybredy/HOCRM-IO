import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, clearAuthStorage } from '@/api/base44Client';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);

  const returnTo = searchParams.get('returnTo') || '/';

  // On Login mount: if there's NO valid session, proactively wipe any
  // stale `sb-*` keys from localStorage. A leftover session (corrupted,
  // expired-but-not-removed, or from a previous user on a shared device)
  // can win against the new tokens issued by the next magic-link click,
  // which is exactly how a real invitee got stuck.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data?.session) {
        await clearAuthStorage();
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleRedirect = () => {
    // If returnTo is a full URL on the same origin, use navigate with just the path
    try {
      const url = new URL(returnTo, window.location.origin);
      if (url.origin === window.location.origin) {
        navigate(url.pathname + url.search + url.hash, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      navigate(returnTo, { replace: true });
    }
  };

  const [signInError, setSignInError] = useState(null);

  const handlePasswordSignIn = async (e) => {
    e.preventDefault();
    setSignInError(null);
    if (!email || !password) {
      setSignInError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Signed in');
      handleRedirect();
    } catch (err) {
      // Surface inline (visible regardless of toast wiring) AND fire a
      // toast — covers both the Sonner-mounted and not-mounted cases.
      const msg = err?.message?.toLowerCase().includes('invalid login')
        ? "That email and password didn't match. Try again, or use the troubleshooting options below."
        : err?.message || 'Sign in failed';
      setSignInError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setMagicLinkSent(true);
      toast.success('Sign-in link sent — check your email.');
    } catch (err) {
      toast.error(err.message || 'Failed to send sign-in link');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }
    setLoading(true);
    try {
      // Recovery email lands on /auth/callback, which forwards to
      // /welcome/set-password once the recovery session is established.
      // SetPassword's updateUser({password}) call works for any
      // authenticated user, not just first-time invitees.
      const redirectTo = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent('/welcome/set-password')}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setResetLinkSent(true);
      toast.success('Password reset link sent — check your email.');
    } catch (err) {
      toast.error(err?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    await clearAuthStorage();
    toast.success('Session cleared. Try signing in again.');
    setEmail('');
    setPassword('');
    setMagicLinkSent(false);
    setResetLinkSent(false);
    setTroubleshootOpen(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-100">
            Hotel Sales Spark
          </CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {magicLinkSent ? (
            <div className="text-center space-y-4">
              <p className="text-slate-300">
                A sign-in link has been sent to <strong className="text-slate-100">{email}</strong>.
              </p>
              <p className="text-sm text-slate-400">
                Check your inbox and click the link to sign in.
              </p>
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setMagicLinkSent(false)}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  autoComplete="current-password"
                />
              </div>

              {signInError && (
                <div
                  role="alert"
                  className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded p-2"
                >
                  {signInError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="pt-2">
                {!troubleshootOpen ? (
                  <button
                    type="button"
                    className="block w-full text-center text-xs text-slate-500 hover:text-slate-300 underline-offset-4 hover:underline"
                    onClick={() => setTroubleshootOpen(true)}
                  >
                    Trouble signing in?
                  </button>
                ) : (
                  <div className="space-y-3 border-t border-slate-800 pt-4">
                    <p className="text-xs text-slate-500 text-center">
                      Forgot your password, want to set a new one, or signing in for the first time after your invite expired?
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                      disabled={loading}
                      onClick={handleMagicLink}
                    >
                      Email me a one-time sign-in link
                    </Button>
                    {resetLinkSent ? (
                      <p className="text-xs text-emerald-400 text-center">
                        Reset link sent to <strong>{email}</strong>. Check your inbox.
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                        disabled={loading}
                        onClick={handleResetPassword}
                      >
                        Reset / set a new password
                      </Button>
                    )}
                    <button
                      type="button"
                      className="block w-full text-center text-xs text-slate-500 hover:text-slate-300 underline-offset-4 hover:underline"
                      onClick={handleResetSession}
                    >
                      Still stuck? Reset session and start over
                    </button>
                    <button
                      type="button"
                      className="block w-full text-center text-xs text-slate-600 hover:text-slate-400"
                      onClick={() => setTroubleshootOpen(false)}
                    >
                      Hide
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
