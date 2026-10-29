import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { KeyRound, X, AlertCircle, ArrowRight } from 'lucide-react';

export function GamePinModal({ isOpen, onClose, game, room, onJoinSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const cleanPin = pin.trim().toUpperCase();
    if (!cleanPin) {
      setError('Please enter the Game PIN to join.');
      return;
    }

    if (cleanPin.length < 4) {
      setError('Game PIN must be at least 4 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onJoinSuccess(cleanPin);
    } catch (err) {
      setError(err?.data?.error?.message || err?.message || 'Incorrect PIN. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md">
        <Card surface="white" shadow="xl" border="thick" rounded="2xl" className="p-6 sm:p-7 relative">
          {/* Close Cut Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full border-[2px] border-black bg-[#FFFBF0] hover:bg-[#EA4335] hover:text-white flex items-center justify-center font-black transition-colors cursor-pointer shadow-[2px_2px_0_0_#000]"
            aria-label="Close PIN modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF8E7] border-[2px] border-black flex items-center justify-center text-[#FBBC05] shadow-[2px_2px_0_0_#000]">
              <KeyRound className="w-5 h-5 text-black" />
            </div>
            <div>
              <Badge color="yellow" size="sm">
                Stage Battle Security
              </Badge>
              <h2 className="text-xl font-black uppercase tracking-tight text-black">
                Enter Game PIN
              </h2>
            </div>
          </div>

          <p className="text-xs font-semibold text-black/70 mb-4">
            The host has secured <span className="font-bold text-black">{game?.title || 'this game'}</span> with a PIN.
            Look at the stage screen or check with the operator for the PIN.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl flex items-center gap-2 text-xs font-bold text-[#EA4335] shadow-[2px_2px_0_0_#EA4335]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="gamePinInput" className="block text-[11px] font-black uppercase tracking-wider text-black/80 mb-1.5">
                Game / Room PIN
              </label>
              <input
                id="gamePinInput"
                type="text"
                autoFocus
                required
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                placeholder="e.g. 849201"
                className="w-full text-center tracking-widest font-mono font-black text-3xl py-3 bg-[#FFFBF0] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05] text-black"
              />
            </div>

            <div className="flex items-center gap-3 mt-1">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="flex-1 flex items-center justify-center gap-1.5 font-black"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Join Battle'} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
