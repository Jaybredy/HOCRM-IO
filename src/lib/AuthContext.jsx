import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false); // No Base44 public settings — always false
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({}); // Not used in Supabase migration

  useEffect(() => {
    checkAppState();

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
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
