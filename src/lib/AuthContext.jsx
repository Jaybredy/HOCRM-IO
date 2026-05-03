import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, wipeAuthStorage } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false); // No Base44 public settings — always false
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({}); // Not used in Supabase migration
  // Phase 4 onboarding gate: when an invitee signs in with their temp
  // password, this is true until they set their own password at
  // /welcome/set-password. Cleared by clearMustChangePassword() once the
  // user finishes the reset.
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    checkAppState();

    // Listen for auth state changes (sign-in, sign-out, token refresh).
    //
    // SIGNED_OUT fires both for explicit logout AND when a refresh-token
    // exchange fails (session genuinely dead). The previous version cleared
    // user state but left authError as null, so AuthenticatedApp didn't
    // redirect to /login — the app stayed mounted with no session and RLS
    // rejected every subsequent query, leaving the user on a broken page
    // until they manually refreshed.
    //
    // We now (a) wipe `sb-*` localStorage so the next sign-in attempt isn't
    // poisoned by stale token fragments, and (b) set authError so
    // AuthenticatedApp's <Navigate to="/login"> kicks in. Explicit logout
    // already triggers a hard navigation in logout() below — the double
    // clear is harmless.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const sessionLost =
          event === 'SIGNED_OUT' ||
          (event === 'TOKEN_REFRESHED' && !session) ||
          (event === 'USER_DELETED');

        if (sessionLost) {
          setUser(null);
          setIsAuthenticated(false);
          setMustChangePassword(false);
          // Pure wipe — calling clearAuthStorage() here would re-fire
          // SIGNED_OUT via supabase.auth.signOut() and stall the parent
          // logout() flow's window.location.href redirect.
          wipeAuthStorage();
          setAuthError({
            type: 'auth_required',
            message: 'Your session has expired. Please sign in again.',
          });
        } else if (session) {
          await loadAppUser(session);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Given a Supabase session, look up the application-level user record
   * from the `users` table and update context state.
   */
  const loadAppUser = async (session) => {
    try {
      const email = session.user.email;

      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (userError) throw userError;

      const userRow = users?.[0] || {};

      setUser({
        id: userRow.id || session.user.id,
        email,
        full_name:
          userRow.full_name ||
          session.user.user_metadata?.full_name ||
          '',
        role: userRow.role || 'user',
        ...userRow,
      });
      setIsAuthenticated(true);
      setAuthError(null);

      // Phase 4: route the invitee through /welcome/set-password until
      // they replace the temp password we generated for them.
      const meta = session.user.user_metadata ?? {};
      setMustChangePassword(meta.must_change_password === true);
    } catch (err) {
      console.error('Failed to load app user:', err);
      setAuthError({
        type: 'unknown',
        message: err.message || 'Failed to load user profile',
      });
    }
  };

  /**
   * Initial session check — equivalent to the old checkAppState.
   */
  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session check failed:', sessionError);
        setAuthError({
          type: 'auth_required',
          message: sessionError.message,
        });
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      if (!session) {
        // No active session — user needs to log in
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
        setIsLoadingAuth(false);
        return;
      }

      // Session exists — load the app-level user record
      await loadAppUser(session);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('Unexpected error in checkAppState:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
    }
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `/login?returnTo=${returnTo}`;
  };

  // Called by SetPassword after the user replaces their temp password —
  // clears the gate so AuthenticatedApp stops redirecting them back.
  const clearMustChangePassword = () => setMustChangePassword(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        mustChangePassword,
        logout,
        navigateToLogin,
        checkAppState,
        clearMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
