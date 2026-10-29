import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/feedback/EmptyState';
import { cn } from '../../lib/utils';
import { Clock, Zap, Target, Award } from 'lucide-react';

/**
 * Leaderboard component displays the ranked participant standings table.
 * Fully responsive: optimized for mobile viewports up to large auditorium projectors.
 *
 * @param {object} props
 * @param {Array<object>} props.participants
 * @param {string} [props.scoreUnit='pts']
 * @param {string} [props.activityTitle]
 * @param {string} [props.trackName]
 * @param {boolean} [props.isOverall=false]
 * @param {string} [props.highlightCode]
 */
export function Leaderboard({
  participants = [],
  scoreUnit = 'pts',
  activityTitle = 'Battle Standings',
  trackName = 'All Tracks',
  isOverall = false,
  highlightCode = null,
}) {
  if (!participants || participants.length === 0) {
    return (
      <EmptyState
        badge="Standby"
        title="No Leaderboard Entries"
        message={`No participants have submitted scores for ${activityTitle} yet. Scores will appear as answers are locked.`}
      />
    );
  }

  return (
    <Card
      surface="white"
      shadow="lg"
      border="thick"
      rounded="xl"
      className="w-full overflow-hidden"
    >
      {/* Table Title Bar */}
      <div className="bg-[#FFF8E7] px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b-[2px] sm:border-b-[2.5px] border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-black">
            {isOverall ? 'DevFest Grand Champions Roster' : 'Match Standings Roster'}
          </span>
          <span className="text-black/30 font-black">•</span>
          <span className="text-[11px] sm:text-xs font-bold text-black/70">
            {participants.length} Ranked
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Badge color="green" size="sm" className="text-[9px] sm:text-[10px]">
            Official Results
          </Badge>
          <Badge color="yellow" size="sm" className="text-[9px] sm:text-[10px]">
            {trackName}
          </Badge>
        </div>
      </div>

      {/* Responsive Table Wrapper */}
      <div className="overflow-x-auto w-full horizontal-scroll-touch">
        <table className="w-full text-left border-collapse select-none min-w-[340px]">
          <thead>
            <tr className="border-b-[2px] border-black bg-[#FFFBF0] text-[10px] sm:text-xs font-black uppercase tracking-wider text-black/75">
              <th scope="col" className="py-2.5 sm:py-3 px-2 sm:px-4 w-12 sm:w-16 text-center">
                Rank
              </th>
              <th scope="col" className="py-2.5 sm:py-3 px-2 sm:px-4">
                Participant
              </th>
              {isOverall && (
                <th scope="col" className="py-2.5 sm:py-3 px-2 sm:px-3 text-center hidden md:table-cell w-24">
                  Battles
                </th>
              )}
              <th scope="col" className="py-2.5 sm:py-3 px-2 sm:px-3 text-center hidden sm:table-cell w-24">
                Accuracy
              </th>
              <th scope="col" className="py-2.5 sm:py-3 px-2 sm:px-4 text-right w-24 sm:w-32">
                Points
              </th>
              {!isOverall && (
                <th scope="col" className="py-2.5 sm:py-3 px-2 sm:px-4 text-right w-24 sm:w-32 hidden sm:table-cell" title="Total time taken for questions in this round (Primary Tie-Breaker)">
                  Total Time
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y-[1.5px] divide-black/10">
            {participants.map((participant, idx) => {
              const rank = participant.rank || idx + 1;
              const name = participant.displayName || participant.name || 'Anonymous';
              const score = participant.totalScore ?? participant.score ?? 0;
              const uniqueCode = participant.uniqueCode || '';
              const org = participant.organization || '';
              const isHighlighted = highlightCode && uniqueCode && highlightCode.toUpperCase() === uniqueCode.toUpperCase();

              // Visual distinction for Top 3 & User Highlight
              let rowBg = 'bg-white hover:bg-[#FFFBF0]/60';
              let rankBadge = (
                <span className="font-black text-xs sm:text-sm text-black/70">
                  #{rank}
                </span>
              );

              if (rank === 1) {
                rowBg = 'bg-[#FFFDEE] hover:bg-[#FFF8D6]';
                rankBadge = (
                  <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full border-[1.5px] border-black bg-[#FBBC05] text-black font-black text-[11px] sm:text-xs shadow-[1px_1px_0_0_#000]">
                    1
                  </span>
                );
              } else if (rank === 2) {
                rowBg = 'bg-[#EEF4FF] hover:bg-[#DEEAFF]';
                rankBadge = (
                  <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full border-[1.5px] border-black bg-[#4285F4] text-white font-black text-[11px] sm:text-xs shadow-[1px_1px_0_0_#000]">
                    2
                  </span>
                );
              } else if (rank === 3) {
                rowBg = 'bg-[#EEFBF3] hover:bg-[#D9F7E4]';
                rankBadge = (
                  <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full border-[1.5px] border-black bg-[#34A853] text-white font-black text-[11px] sm:text-xs shadow-[1px_1px_0_0_#000]">
                    3
                  </span>
                );
              }

              if (isHighlighted) {
                rowBg = 'bg-[#FFF8E7] ring-2 ring-inset ring-[#FBBC05] font-black';
              }

              return (
                <tr
                  key={participant.id || participant.attendeeId || uniqueCode || idx}
                  className={cn(
                    'transition-colors text-black font-semibold text-xs sm:text-sm',
                    rowBg
                  )}
                >
                  {/* Rank Column */}
                  <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-center shrink-0">
                    {rankBadge}
                  </td>

                  {/* Participant Display Name Column */}
                  <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-black text-black text-xs sm:text-sm tracking-tight truncate max-w-[140px] sm:max-w-none">
                          {name}
                        </span>
                        {isHighlighted && (
                          <span className="px-1.5 py-0.2 bg-[#FBBC05] text-black font-black text-[9px] rounded uppercase border border-black">
                            YOU
                          </span>
                        )}
                        {rank <= 3 && (
                          <span className="text-[9px] font-black text-[#EA4335] uppercase hidden sm:inline">
                            {rank === 1 ? '👑 Grand Champion' : rank === 2 ? '⚡ Runner Up' : '🎯 2nd Runner Up'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-black/60 font-semibold mt-0.5">
                        {uniqueCode && <span className="font-mono text-black/50">{uniqueCode}</span>}
                        {uniqueCode && org && <span>•</span>}
                        {org && <span className="truncate max-w-[150px]">{org}</span>}
                      </div>
                    </div>
                  </td>

                  {/* Battles Played (Overall only) */}
                  {isOverall && (
                    <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center hidden md:table-cell text-xs font-bold text-black/80">
                      <span className="px-2 py-0.5 bg-[#FFFBF0] border border-black/20 rounded-md">
                        {participant.matchesPlayed || 1}
                      </span>
                    </td>
                  )}

                  {/* Accuracy */}
                  <td className="py-2.5 sm:py-3.5 px-2 sm:px-3 text-center hidden sm:table-cell text-xs font-bold text-black/80">
                    <span className="font-mono">
                      {participant.accuracyPct !== undefined
                        ? `${participant.accuracyPct}%`
                        : participant.correctCount !== undefined
                        ? `${participant.correctCount} correct`
                        : '--'}
                    </span>
                  </td>

                  {/* Points / Score Column */}
                  <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-right font-black text-xs sm:text-sm md:text-base text-black tracking-tight shrink-0 whitespace-nowrap">
                    <span className="font-mono text-[#4285F4]">{score.toLocaleString()}</span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-black/50 ml-0.5 sm:ml-1 uppercase">
                      {scoreUnit}
                    </span>
                  </td>

                  {/* Total Time Column (Match View) */}
                  {!isOverall && (
                    <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-right font-mono text-[11px] sm:text-xs shrink-0 whitespace-nowrap hidden sm:table-cell">
                      {participant.totalTimeMs ? (
                        <span className="font-bold text-black/80 flex items-center justify-end gap-1" title={`Total cumulative time: ${(participant.totalTimeMs / 1000).toFixed(2)}s`}>
                          <Clock className="w-3 h-3 text-[#FBBC05]" />
                          {(participant.totalTimeMs / 1000).toFixed(1)}s
                        </span>
                      ) : participant.fastestTimeMs ? (
                        <span className="font-bold text-black/80 flex items-center justify-end gap-1" title={`Reaction time: ${(participant.fastestTimeMs / 1000).toFixed(2)}s`}>
                          <Clock className="w-3 h-3 text-[#FBBC05]" />
                          {(participant.fastestTimeMs / 1000).toFixed(1)}s
                        </span>
                      ) : (
                        <span className="text-black/30 font-bold">--:--</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="bg-[#FFFBF0] px-3.5 sm:px-4 py-2 border-t-[1.5px] border-black/10 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] font-bold text-black/50 gap-1 text-center sm:text-left">
        <span>DevFest Ranchi 2026 Gaming Arena</span>
        <span>Official Real-Time Standings • Radisson Blu Ranchi</span>
      </div>
    </Card>
  );
}
