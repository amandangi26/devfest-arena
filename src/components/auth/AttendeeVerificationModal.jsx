import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Ticket, Mail, Phone, AlertCircle, Sparkles, CheckCircle2, X } from 'lucide-react';

export function AttendeeVerificationModal({ isOpen = true, onClose, onSuccess }) {
  const { login } = useAuth();
  const [uniqueCode, setUniqueCode] = useState('');
  const [contact, setContact] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanCode = uniqueCode.trim().toUpperCase();
    const cleanContact = contact.trim();

    if (!cleanCode || !cleanContact) {
      setError('Please provide both your Ticket Code and Email/Phone.');
      return;
    }

    if (cleanCode.length < 3) {
      setError('Ticket code must be at least 3 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
    const isEmail = emailRegex.test(cleanContact);
    const isPhone = phoneRegex.test(cleanContact.replace(/[\s\-]/g, ''));

    if (!isEmail && !isPhone) {
      setError('Please enter a valid email address or 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await login(cleanCode, cleanContact);
      setIsSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.profile);
        if (onClose) onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Invalid ticket code or contact details.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <Card
        surface="white"
        shadow="xl"
        border="thick"
        rounded="xl"
        className="w-full max-w-md p-6 sm:p-8 relative overflow-hidden"
      >
        {/* Top Tribal Stripe */}
        <div className="tribal-stripe absolute top-0 left-0 right-0 border-b-2 border-black" />

        {/* Close Button ("Cut" the popup) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full border-[2px] border-black bg-white hover:bg-[#FFF5F5] flex items-center justify-center text-black shadow-[2px_2px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
            aria-label="Close verification popup"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#EEFBF3] border-[2.5px] border-black flex items-center justify-center text-[#34A853] shadow-[3px_3px_0_0_#000]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-black uppercase tracking-tight">
              Ticket Verified!
            </h2>
            <p className="text-sm font-semibold text-black/70">
              Welcome to DevFest Ranchi 2026 Gaming Arena. Launching session...
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-4 mt-2">
              <Badge color="yellow" size="sm">
                <Sparkles className="w-3 h-3 inline mr-1" /> DevFest Pass
              </Badge>
              <span className="text-[10px] font-mono font-bold text-black/50 uppercase tracking-widest">
                Radisson Blu • Oct 31
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight leading-tight mb-2">
              Attendee Verification
            </h2>

            <p className="text-xs text-black/70 font-semibold mb-6 leading-relaxed">
              Enter your Commudle unique ticket code and registered contact info to unlock live challenges & leaderboards.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl flex items-center gap-2.5 text-xs font-bold text-[#EA4335] shadow-[2px_2px_0_0_#EA4335]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-[#4285F4]" />
                  Unique Ticket Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DFR26-A9X2B"
                  value={uniqueCode}
                  onChange={(e) => setUniqueCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-mono font-bold text-sm text-black placeholder:text-black/40 shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#EA4335]" />
                  <Phone className="w-3.5 h-3.5 text-[#34A853]" />
                  Registered Email or Phone
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. attendee@example.com or 9876543210"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-semibold text-sm text-black placeholder:text-black/40 shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                {onClose && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Verifying...' : 'Verify Ticket'}
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
