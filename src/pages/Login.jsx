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

  const handlePasswordSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Signed in');
      handleRedirect();
    } catch (err) {
      toast.error(err.message || 'Sign in failed');
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

  const handleResetSession = async () => {
    await clearAuthStorage();
    toast.success('Session cleared. Try signing in again.');
    setEmail('');
    setPassword('');
    setMagicLinkSent(false);
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
                      Forgot your password, or signing in for the first time after your invite expired?
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
