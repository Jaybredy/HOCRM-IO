import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SetPassword() {
  const navigate = useNavigate();
  const { user, clearMustChangePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const validate = () => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
      return 'Use a mix of uppercase and lowercase letters.';
    }
    if (!/\d/.test(password)) return 'Include at least one number.';
    if (password !== confirm) return 'Passwords don’t match.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          must_change_password: false,
          temp_password_expires_at: null,
        },
      });
      if (updateError) throw updateError;

      clearMustChangePassword();
      toast.success('Password set. Welcome aboard!');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to set password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-100">
            Set your password
          </CardTitle>
          <CardDescription className="text-slate-400">
            One last step{user?.email ? ` for ${user.email}` : ''} — pick a password you'll remember.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                autoComplete="new-password"
                autoFocus
                required
              />
              <p className="text-xs text-slate-500">
                At least 8 characters. Mix uppercase, lowercase, and at least one number.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-slate-300">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded p-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200"
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save password and continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
