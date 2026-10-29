import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * DeleteGameModal — High-visibility confirmation modal before permanent game deletion.
 * Provides clear "Yes, Delete" and "No, Cancel" options with full audit context.
 */
export function DeleteGameModal({
  game,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) {
  if (!isOpen || !game) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <Card
        surface="white"
        shadow="xl"
        border="thick"
        rounded="xl"
        className="w-full max-w-lg p-6 sm:p-8 relative overflow-hidden bg-[#FFFBF0]"
      >
        {/* Red Warning Stripe */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-[#EA4335] border-b-2 border-black" />

        {/* Close "X" Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full border-[2px] border-black bg-white hover:bg-[#FFF5F5] flex items-center justify-center text-black shadow-[2px_2px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Danger Icon */}
        <div className="flex items-center gap-3 mb-4 mt-1">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0F0] border-[2.5px] border-[#EA4335] flex items-center justify-center text-[#EA4335] shadow-[3px_3px_0_0_#EA4335] shrink-0 animate-bounce">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <Badge color="red" size="sm" className="mb-1">
              Warning • Irreversible Action
            </Badge>
            <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight leading-tight">
              Delete Game Quiz?
            </h2>
          </div>
        </div>

        {/* Target Quiz Details Card */}
        <div className="p-4 bg-white border-[2px] border-black rounded-xl shadow-[3px_3px_0_0_#000] mb-4 text-left">
          <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block mb-0.5">
            Quiz to be deleted:
          </span>
          <h3 className="font-black text-base text-black mb-1">
            {game.title}
          </h3>
          <div className="flex items-center gap-2 text-xs font-bold text-black/60 flex-wrap">
            <span className="font-mono bg-black/5 px-2 py-0.5 rounded border border-black/20">
              ID: {game.id}
            </span>
            <span>•</span>
            <span>{game.questions?.length || 0} Questions</span>
            <span>•</span>
            <span className="uppercase text-[#EA4335] font-black">
              Status: {game.status}
            </span>
          </div>
        </div>

        {/* Warning Explanation Text */}
        <div className="p-3.5 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-xs font-semibold text-[#8B0000] leading-relaxed mb-6 shadow-[2px_2px_0_0_#EA4335]">
          ⚠️ <strong>Last Warning:</strong> This will permanently delete this quiz, all question configurations, and published versions from the live Supabase database. This action <u>cannot be undone</u>.
        </div>

        {/* YES / NO Confirmation Buttons */}
        <div className="flex items-center justify-end gap-3 flex-col-reverse sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            No, Cancel
          </Button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={() => onConfirm(game.id)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-[2.5px] border-black bg-[#EA4335] hover:bg-[#D93025] text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting Quiz...' : 'Yes, Delete Game'}</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
