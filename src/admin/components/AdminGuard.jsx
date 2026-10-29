import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

export function AdminGuard({ children }) {
  const { isAdmin, adminToken, adminEmail, isVerifying, loginAdmin, logoutAdmin } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated via context/storage, render immediately without any flicker or re-render!
  if (isAdmin) {
    return typeof children === 'function'
      ? children({ adminKey: adminToken, adminEmail, handleLogout: logoutAdmin })
      : children;
  }

  // Loading spinner during initial cold-start storage validation
  if (isVerifying) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-black border-t-[#FBBC05] rounded-full animate-spin mb-4" />
        <span className="font-mono font-black text-xs uppercase tracking-wider text-black/60">
          Verifying Admin Security Clearance...
        </span>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e?.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid administrator email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      await loginAdmin({ email: cleanEmail, password });
    } catch (err) {
      setErrorMsg(
        err.data?.error?.message ||
        err.message ||
        'Authentication failed. Please check your email and password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card
        surface="warmWhite"
        shadow="lg"
        border="thick"
        rounded="2xl"
        className="max-w-md w-full p-6 sm:p-8 text-center flex flex-col items-center border-[3.5px] border-black shadow-[8px_8px_0_0_#000]"
      >
        {/* Security Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-black shadow-[3px_3px_0_0_#000] mb-4">
          <Lock className="w-8 h-8 text-[#EA4335]" />
        </div>

        <div className="space-y-1 mb-6">
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-[#EA4335] text-white border-[1.5px] border-black font-black text-[10px] uppercase tracking-wider shadow-[1.5px_1.5px_0_0_#000]">
            <Lock className="w-3 h-3" /> Restricted Portal
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-black tracking-tight mt-1">
            Admin & Anchor Operations
          </h2>
          <p className="text-xs font-semibold text-black/70">
            Sign in with your administrator or stage anchor credentials to access the live cockpit.
          </p>
        </div>

        {errorMsg && (
          <div className="w-full p-3.5 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-xs font-bold text-[#EA4335] text-left shadow-[2px_2px_0_0_#EA4335] flex items-start gap-2 mb-4 animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#EA4335] mt-0.5" />
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 text-left">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#4285F4]" /> Email Address
            </label>
            <input
              type="email"
              required
              autoFocus
              placeholder="e.g. admin@devfest.in or anchor@devfest.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full px-3.5 py-3 bg-[#FFFBF0] border-[2.5px] border-black rounded-xl font-bold text-sm text-black shadow-[3px_3px_0_0_#000] focus:outline-none focus:ring-4 focus:ring-[#FBBC05]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#EA4335]" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your admin/anchor password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full pl-3.5 pr-10 py-3 bg-[#FFFBF0] border-[2.5px] border-black rounded-xl font-bold text-sm text-black shadow-[3px_3px_0_0_#000] focus:outline-none focus:ring-4 focus:ring-[#FBBC05]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50 hover:text-black cursor-pointer p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            className="w-full font-black text-sm uppercase shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] transition-all cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-white rounded-full animate-spin mr-2" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                <span>Sign In to Operations Console</span>
              </>
            )}
          </Button>
        </form>

        <div className="mt-5 pt-3 border-t border-black/10 text-[10px] font-bold text-black/50 w-full text-center">
          🔒 Protected by timing-safe credential verification and brute-force rate-limiting.
        </div>
      </Card>
    </div>
  );
}
