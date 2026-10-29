import { AuthProvider } from '../context/AuthContext';
import { AdminAuthProvider } from '../context/AdminAuthContext';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <AdminAuthProvider>{children}</AdminAuthProvider>
    </AuthProvider>
  );
}
