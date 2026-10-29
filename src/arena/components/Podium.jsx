import { Trophy, Medal, Clock, Crown, Target, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Creative Arcade Championship Podium for Top 3 Leaders.
 * Renders an authentic 3-step physical podium on BOTH mobile and desktop screens.
 *
 * @param {object} props
 * @param {Array<object>} props.topThree - Array of top participants (up to 3)
 * @param {string} [props.scoreUnit='pts']
 * @param {string} [props.trackName='Track 1']
 */
export function Podium({ topThree = [], scoreUnit = 'pts', trackName = 'Track 1' }) {
  if (!topThree || topThree.length === 0) {
    return (
      <div className="w-full text-center py-6 sm:py-8">
        <p className="text-xs sm:text-sm font-bold text-black/60">
          No participants have qualified for the podium in this category yet.
        </p>
      </div>
    );
  }

  const formatPodiumTime = (p) => {
    if (!p) return '';
    if (p.totalTimeMs) return `${(p.totalTimeMs / 1000).toFixed(1)}s total`;
    if (p.fastestTimeMs) return `${(p.fastestTimeMs / 1000).toFixed(1)}s`;
    return p.time || '';
  };

  const first = topThree[0]
    ? {
        ...topThree[0],
        name: topThree[0].displayName || topThree[0].name || 'Champion',
        score: topThree[0].totalScore ?? topThree[0].score ?? 0,
        time: formatPodiumTime(topThree[0]),
      }
    : null;

  const second = topThree[1]
    ? {
        ...topThree[1],
        name: topThree[1].displayName || topThree[1].name || 'Runner Up',
        score: topThree[1].totalScore ?? topThree[1].score ?? 0,
        time: formatPodiumTime(topThree[1]),
      }
    : null;

  const third = topThree[2]
    ? {
        ...topThree[2],
        name: topThree[2].displayName || topThree[2].name || '3rd Place',
        score: topThree[2].totalScore ?? topThree[2].score ?? 0,
        time: formatPodiumTime(topThree[2]),
      }
    : null;

  return (
    <section aria-label="Top 3 Stage Leaders" className="w-full my-2.5 sm:my-5">
      {/* Unified Neo-Brutalist Podium Arena Shell */}
      <div className="w-full bg-[#FFFDF6] border-[2.5px] sm:border-[3px] border-black rounded-[20px] sm:rounded-[28px] shadow-[4px_4px_0_0_#000] sm:shadow-[6px_6px_0_0_#000] overflow-hidden">
        {/* Top Decorative Tribal Accent */}
        <div className="tribal-stripe w-full border-b-[2px] border-black" />

        {/* The 3 Stepped Pedestals Container — Side-by-Side on ALL Screens */}
        <div className="px-2 sm:px-6 pt-3 sm:pt-6 pb-0 flex items-end justify-center gap-1.5 sm:gap-4 md:gap-6">
          {/* ========================================================= */}
          {/* 2ND PLACE (Left Column, Silver / Google Blue)             */}
          {/* ========================================================= */}
          {second ? (
            <div className="flex-1 min-w-0 flex flex-col items-center justify-end z-10 group">
              {/* Runner Up Sticker */}
              <div className="mb-1 sm:mb-1.5">
                <span className="inline-flex items-center gap-1 bg-[#4285F4] text-white border-[1.5px] border-black rounded-md px-1 sm:px-2 py-0.2 sm:py-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#000]">
                  <Zap className="w-2.5 h-2.5" /> Runner Up
                </span>
              </div>

              {/* Medal Disc */}
              <div className="relative mb-1 sm:mb-1.5">
                <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-[2px] sm:border-[2.5px] border-black bg-[#EEF4FF] text-[#4285F4] flex items-center justify-center font-black text-base sm:text-2xl shadow-[2px_2px_0_0_#000] group-hover:scale-105 transition-transform">
                  2
                </div>
                <Medal className="w-4 h-4 text-slate-500 absolute -bottom-1 -right-1 drop-shadow" />
              </div>

              {/* Nameplate */}
              <div className="w-full text-center px-1 sm:px-2 py-0.5 sm:py-1 bg-white border-[1.5px] sm:border-[2px] border-black rounded-lg sm:rounded-xl shadow-[1.5px_1.5px_0_0_#000] mb-1 min-w-0">
                <h4 className="font-black text-[10px] sm:text-xs md:text-sm text-black truncate leading-tight">
                  {second.name}
                </h4>
              </div>

              {/* Score & Time */}
              <div className="text-center mb-1.5 sm:mb-2 leading-none">
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="font-black text-xs sm:text-lg md:text-2xl text-black">
                    {second.score.toLocaleString()}
                  </span>
                  <span className="text-[8px] sm:text-[10px] font-black uppercase text-[#4285F4]">
                    {scoreUnit}
                  </span>
                </div>
                <span className="text-[8px] sm:text-[10px] font-mono font-bold text-black/60 inline-flex items-center justify-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 inline" /> {second.time || '--:--'}
                </span>
              </div>

              {/* Physical Stepped Pedestal Block (Medium Height) */}
              <div
                className={cn(
                  'w-full h-16 sm:h-24 md:h-32 rounded-t-[14px] sm:rounded-t-[18px]',
                  'border-[2px] sm:border-[2.5px] border-b-0 border-black',
                  'bg-gradient-to-b from-[#FFFDF6] via-[#EEF4FF] to-[#D0E2FF]',
                  'shadow-[2px_0_0_0_#000] flex flex-col items-center justify-center relative overflow-hidden',
                  'group-hover:brightness-95 transition-all'
                )}
              >
                <span className="font-black text-lg sm:text-3xl md:text-4xl text-[#4285F4]/30 select-none">
                  #2
                </span>
                <span className="font-black text-[9px] sm:text-xs uppercase tracking-wider text-black/70 mt-0.5 hidden xs:inline sm:inline">
                  2ND PLACE
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0" />
          )}

          {/* ========================================================= */}
          {/* 1ST PLACE (Center Column, Champion / Google Yellow)       */}
          {/* ========================================================= */}
          {first && (
            <div className="flex-[1.18] sm:flex-1 min-w-0 flex flex-col items-center justify-end z-20 group -mb-[1px]">
              {/* Crown Banner */}
              <div className="flex items-center gap-1 mb-1 sm:mb-1.5">
                <Crown className="w-3.5 h-3.5 text-[#FBBC05] animate-bounce" />
                <span className="inline-block bg-[#EA4335] text-white border-[1.5px] border-black rounded-md px-1.5 sm:px-2 py-0.2 sm:py-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0_0_#000]">
                  TOP SCORE
                </span>
              </div>

              {/* Medal Disc */}
              <div className="relative mb-1 sm:mb-1.5">
                <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-[2.5px] sm:border-[3px] border-black bg-[#FBBC05] text-black flex items-center justify-center font-black text-lg sm:text-3xl shadow-[3px_3px_0_0_#000] ring-2 sm:ring-4 ring-[#FBBC05]/40 group-hover:scale-105 transition-transform">
                  1
                </div>
                <Trophy className="w-5 h-5 text-[#FBBC05] absolute -bottom-1 -right-1 drop-shadow" />
              </div>

              {/* Nameplate */}
              <div className="w-full text-center px-1 sm:px-2.5 py-0.5 sm:py-1 bg-white border-[2px] border-black rounded-lg sm:rounded-xl shadow-[2px_2px_0_0_#000] mb-1 min-w-0">
                <h4 className="font-black text-[11px] sm:text-sm md:text-base text-black truncate leading-tight">
                  {first.name}
                </h4>
              </div>

              {/* Score & Time */}
              <div className="text-center mb-1.5 sm:mb-2 leading-none">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-black text-sm sm:text-2xl md:text-3xl text-black">
                    {first.score.toLocaleString()}
                  </span>
                  <span className="text-[8px] sm:text-xs font-black uppercase text-[#FBBC05] bg-black px-1 sm:px-1.5 py-0.2 rounded">
                    {scoreUnit}
                  </span>
                </div>
                <span className="text-[8px] sm:text-[11px] font-mono font-bold text-black/75 inline-flex items-center justify-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 inline" /> {first.time || '--:--'}
                </span>
              </div>

              {/* Physical Stepped Pedestal Block (Tallest Height) */}
              <div
                className={cn(
                  'w-full h-22 sm:h-32 md:h-44 rounded-t-[16px] sm:rounded-t-[22px]',
                  'border-[2.5px] sm:border-[3px] border-b-0 border-black',
                  'bg-gradient-to-b from-[#FFFDF6] via-[#FFF4C2] to-[#FBBC05]',
                  'shadow-[3px_0_0_0_#000] flex flex-col items-center justify-center relative overflow-hidden',
                  'group-hover:brightness-95 transition-all'
                )}
              >
                <span className="font-black text-xl sm:text-4xl md:text-5xl text-[#FBBC05]/40 select-none">
                  #1
                </span>
                <span className="font-black text-[9px] sm:text-xs uppercase tracking-wider text-black mt-0.5 bg-[#FBBC05] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0_0_#000]">
                  CHAMPION
                </span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3RD PLACE (Right Column, Bronze / Google Green)           */}
          {/* ========================================================= */}
          {third ? (
            <div className="flex-1 min-w-0 flex flex-col items-center justify-end z-10 group">
              {/* Podium Sticker */}
              <div className="mb-1 sm:mb-1.5">
                <span className="inline-flex items-center gap-1 bg-[#34A853] text-white border-[1.5px] border-black rounded-md px-1 sm:px-2 py-0.2 sm:py-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#000]">
                  <Target className="w-2.5 h-2.5" /> Podium
                </span>
              </div>

              {/* Medal Disc */}
              <div className="relative mb-1 sm:mb-1.5">
                <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-[2px] sm:border-[2.5px] border-black bg-[#EEFBF3] text-[#34A853] flex items-center justify-center font-black text-base sm:text-2xl shadow-[2px_2px_0_0_#000] group-hover:scale-105 transition-transform">
                  3
                </div>
                <Medal className="w-4 h-4 text-amber-700 absolute -bottom-1 -right-1 drop-shadow" />
              </div>

              {/* Nameplate */}
              <div className="w-full text-center px-1 sm:px-2 py-0.5 sm:py-1 bg-white border-[1.5px] sm:border-[2px] border-black rounded-lg sm:rounded-xl shadow-[1.5px_1.5px_0_0_#000] mb-1 min-w-0">
                <h4 className="font-black text-[10px] sm:text-xs md:text-sm text-black truncate leading-tight">
                  {third.name}
                </h4>
              </div>

              {/* Score & Time */}
              <div className="text-center mb-1.5 sm:mb-2 leading-none">
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="font-black text-xs sm:text-lg md:text-2xl text-black">
                    {third.score.toLocaleString()}
                  </span>
                  <span className="text-[8px] sm:text-[10px] font-black uppercase text-[#34A853]">
                    {scoreUnit}
                  </span>
                </div>
                <span className="text-[8px] sm:text-[10px] font-mono font-bold text-black/60 inline-flex items-center justify-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 inline" /> {third.time || '--:--'}
                </span>
              </div>

              {/* Physical Stepped Pedestal Block (Lowest Height) */}
              <div
                className={cn(
                  'w-full h-12 sm:h-18 md:h-24 rounded-t-[14px] sm:rounded-t-[18px]',
                  'border-[2px] sm:border-[2.5px] border-b-0 border-black',
                  'bg-gradient-to-b from-[#FFFDF6] via-[#EEFBF3] to-[#C7EDD4]',
                  'shadow-[2px_0_0_0_#000] flex flex-col items-center justify-center relative overflow-hidden',
                  'group-hover:brightness-95 transition-all'
                )}
              >
                <span className="font-black text-lg sm:text-3xl md:text-4xl text-[#34A853]/30 select-none">
                  #3
                </span>
                <span className="font-black text-[9px] sm:text-xs uppercase tracking-wider text-black/70 mt-0.5 hidden xs:inline sm:inline">
                  3RD PLACE
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0" />
          )}
        </div>

        {/* Unified Physical Podium Stage Ground Platform */}
        <div className="w-full bg-[#0D2818] border-t-[2.5px] sm:border-t-[3px] border-black px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between text-white select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FBBC05] animate-pulse" />
            <span className="font-black text-[9px] sm:text-xs uppercase tracking-wider">
              Championship Stage
            </span>
          </div>
          <span className="font-bold text-[8px] sm:text-xs text-white/70">
            {trackName} • Live Finalists
          </span>
        </div>
      </div>
    </section>
  );
}
