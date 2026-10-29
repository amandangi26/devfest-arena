import { cn } from '../../lib/utils';

/**
 * TrackSelector enables switching between the three conference tracks (Track 1, Track 2, Track 3).
 *
 * @param {object} props
 * @param {Array<object>} props.tracks
 * @param {string} props.selectedTrackId
 * @param {(id: string) => void} props.onSelectTrack
 */
export function TrackSelector({ tracks = [], selectedTrackId, onSelectTrack }) {
  // Google Brand palette mapping for track selections
  const trackTheme = {
    'track-1': {
      activeBg: 'bg-[#4285F4] text-white',
      dotColor: 'bg-white',
    },
    'track-2': {
      activeBg: 'bg-[#EA4335] text-white',
      dotColor: 'bg-white',
    },
    'track-3': {
      activeBg: 'bg-[#34A853] text-white',
      dotColor: 'bg-white',
    },
  };

  return (
    <div
      role="tablist"
      aria-label="Conference Track Selector"
      className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full"
    >
      {tracks.map((track) => {
        const isSelected = track.id === selectedTrackId;
        const theme = trackTheme[track.id] || trackTheme['track-1'];

        return (
          <button
            key={track.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => onSelectTrack(track.id)}
            className={cn(
              'flex items-center justify-between p-3.5 sm:p-4 rounded-[20px] border-[2.5px] border-black transition-all select-none min-h-[52px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBBC05]',
              isSelected
                ? `${theme.activeBg} shadow-[4px_4px_0_0_#000] translate-x-[-1px] translate-y-[-1px]`
                : 'bg-white text-black shadow-[2px_2px_0_0_#000] hover:bg-[#FFFBF0] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000]'
            )}
          >
            <div className="flex flex-col text-left">
              <span className="font-black text-sm sm:text-base uppercase tracking-wider leading-none">
                {track.name}
              </span>
              <span
                className={cn(
                  'text-[11px] font-bold mt-1 leading-tight',
                  isSelected ? 'text-white/85' : 'text-black/60'
                )}
              >
                {track.description}
              </span>
            </div>

            <div className="shrink-0 ml-2">
              <span
                className={cn(
                  'w-3.5 h-3.5 rounded-full border border-black inline-block',
                  isSelected ? `${theme.dotColor} shadow-[1px_1px_0_0_#000]` : 'bg-black/10'
                )}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
