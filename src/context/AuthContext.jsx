import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session on mount
  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const res = await apiClient('/auth/session');
        if (!ignore && res?.ok && res?.user) {
          setUser(res.user);
        }
      } catch {
        if (!ignore) {
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, []);

  const login = useCallback(async (uniqueCode, contact) => {
    setError(null);
    try {
      const res = await apiClient('/auth/verify-ticket', {
        method: 'POST',
        body: JSON.stringify({
          uniqueCode: uniqueCode?.trim()?.toUpperCase(),
          contact: contact?.trim(),
        }),
      });

      if (res?.ok && res?.profile) {
        setUser(res.profile);
        return { success: true, profile: res.profile };
      }
      throw new Error(res?.error?.message || 'Verification failed');
    } catch (err) {
      const msg = err.data?.error?.message || err.message || 'Invalid ticket code or contact details';
      setError(msg);
      throw new Error(msg, { cause: err });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
