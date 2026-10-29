import { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';

/**
 * ChallengeDrawer is a slide-out drawer for switching activities.
 * It stays off-screen by default so auditorium and mobile screens remain focused 100% on leaderboard stats.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Array<object>} props.activities
 * @param {string} props.selectedActivityId
 * @param {(id: string) => void} props.onSelectActivity
 */
export function ChallengeDrawer({
  isOpen = false,
  onClose,
  activities = [],
  selectedActivityId,
  onSelectActivity,
}) {
  // Close on Escape key and prevent background scroll when open
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Select Challenge">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Neo-Brutalist Drawer Panel */}
      <div
        className={cn(
          'relative w-[310px] sm:w-[380px] max-w-[88vw] h-full bg-[#FFFBF0] text-black',
          'border-r-[3.5px] border-black shadow-[8px_0_0_0_#000] p-4 sm:p-5 flex flex-col justify-between z-10',
          'animate-in slide-in-from-left duration-200 select-none'
        )}
      >
        {/* Drawer Header */}
        <div className="pb-3 border-b-[2.5px] border-dashed border-black/20">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335] animate-pulse" />
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-black">
                Challenge Catalog
              </h2>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close challenges drawer"
              className={cn(
                'w-8 h-8 rounded-full border-[2px] border-black bg-white text-black flex items-center justify-center font-black text-sm',
                'shadow-[2px_2px_0_0_#000] hover:bg-[#EA4335] hover:text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000]',
                'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer'
              )}
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] sm:text-xs font-bold text-black/60 leading-tight">
            Select a challenge to switch the live scoreboard view.
          </p>
        </div>

        {/* Scrollable Challenges List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1" role="listbox" aria-label="Available challenges">
          {activities.map((activity) => {
            const isSelected = activity.id === selectedActivityId;

            return (
              <button
                key={activity.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectActivity(activity.id);
                  onClose?.();
                }}
                className={cn(
                  'w-full text-left p-3 rounded-[18px] border-[2.5px] transition-all flex items-start gap-3 cursor-pointer group',
                  isSelected
                    ? 'bg-[#FFF8E7] border-black shadow-[4px_4px_0_0_#000] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-white border-black/35 hover:border-black hover:bg-[#FFFBF0] shadow-[1.5px_1.5px_0_0_#000] hover:shadow-[3px_3px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                )}
              >
                {/* Icon box */}
                <span
                  className="w-10 h-10 rounded-[12px] border-[2px] border-black flex items-center justify-center text-xl shrink-0 shadow-[1.5px_1.5px_0_0_#000] bg-white group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: isSelected ? activity.accentColor + '25' : '#FFFFFF' }}
                  role="img"
                  aria-hidden="true"
                >
                  {activity.icon}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-black text-xs sm:text-sm text-black truncate">
                      {activity.title}
                    </span>
                    {activity.isPrimaryDemo ? (
                      <Badge color="yellow" size="sm" className="text-[9px] px-1.5 py-0 shrink-0">
                        Demo
                      </Badge>
                    ) : (
                      <Badge color="sand" size="sm" className="text-[9px] px-1.5 py-0 opacity-70 shrink-0">
                        Preview
                      </Badge>
                    )}
                  </div>

                  <span className="text-[10px] sm:text-[11px] font-bold text-black/60 block truncate mb-1">
                    {activity.category}
                  </span>

                  <p className="text-[10px] text-black/75 line-clamp-2 leading-tight">
                    {activity.description}
                  </p>
                </div>

                {/* Checkmark for selected */}
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-[1px_1px_0_0_#000]">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="pt-3 border-t-[2px] border-dashed border-black/20 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-black/50">
          <span>GDG Ranchi • DevFest 2026</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
            <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
          </div>
        </div>
      </div>
    </div>
  );
}
