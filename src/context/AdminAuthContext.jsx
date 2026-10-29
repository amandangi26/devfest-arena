import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';

const AdminAuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'dfr26_admin_key';
const STORAGE_KEY_EMAIL = 'dfr26_admin_email';

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_TOKEN) || sessionStorage.getItem(STORAGE_KEY_TOKEN) || null;
}

function getStoredEmail() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_EMAIL) || sessionStorage.getItem(STORAGE_KEY_EMAIL) || null;
}

function persistAdmin(token, email) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_EMAIL, email || 'Administrator');
    sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
    sessionStorage.setItem(STORAGE_KEY_EMAIL, email || 'Administrator');
  } catch (e) {
    console.warn('[AdminAuth] Storage write warning:', e);
  }
}

function clearAdminStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EMAIL);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_EMAIL);
  } catch (e) {
    console.warn('[AdminAuth] Storage clear warning:', e);
  }
}

export function AdminAuthProvider({ children }) {
  const [adminToken, setAdminToken] = useState(() => getStoredToken());
  const [adminEmail, setAdminEmail] = useState(() => getStoredEmail());
  const [isAdmin, setIsAdmin] = useState(() => Boolean(getStoredToken()));
  const [isVerifying, setIsVerifying] = useState(() => Boolean(getStoredToken()));

  // Validate session against server on initial startup
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsVerifying(false);
      return;
    }

    let isMounted = true;

    async function checkServerSession() {
      try {
        const res = await apiClient('/auth/admin-session', {
          headers: { 'x-admin-key': token },
        });

        if (isMounted) {
          if (res?.ok) {
            const activeEmail = res.email || getStoredEmail() || 'Administrator';
            setAdminToken(token);
            setAdminEmail(activeEmail);
            setIsAdmin(true);
            persistAdmin(token, activeEmail);
          } else {
            // Server explicitly rejected the session
            clearAdminStorage();
            setAdminToken(null);
            setAdminEmail(null);
            setIsAdmin(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          // Only clear if the server explicitly returned 401 or 403 (unauthorized)
          if (err.status === 401 || err.status === 403) {
            clearAdminStorage();
            setAdminToken(null);
            setAdminEmail(null);
            setIsAdmin(false);
          } else {
            // For network disconnects or transient errors, keep the session valid
            console.warn('[AdminAuth] Server check transient error; preserving session:', err.message);
          }
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    checkServerSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginAdmin = useCallback(async ({ email, password }) => {
    const cleanEmail = email?.trim();
    if (!cleanEmail || !password) {
      throw new Error('Please enter both email address and password.');
    }

    const res = await apiClient('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    if (res?.ok && res.token) {
      const token = res.token;
      const activeEmail = res.email || cleanEmail;
      persistAdmin(token, activeEmail);
      setAdminToken(token);
      setAdminEmail(activeEmail);
      setIsAdmin(true);
      return { success: true, email: activeEmail, token };
    }

    throw new Error(res?.error?.message || 'Authentication failed.');
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await apiClient('/auth/admin-logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      clearAdminStorage();
      setAdminToken(null);
      setAdminEmail(null);
      setIsAdmin(false);
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        adminToken,
        adminEmail,
        isAdmin,
        isVerifying,
        loginAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

