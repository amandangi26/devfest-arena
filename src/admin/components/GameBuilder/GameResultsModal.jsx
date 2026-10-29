import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../services/api/client';
import {
  Trophy,
  X,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
  Medal,
  Award,
  Layers,
  Sparkles,
  Ban,
  HelpCircle,
} from 'lucide-react';

export function GameResultsModal({ game, isOpen, onClose, adminKey }) {
  const [isLoading, setIsLoading] = useState(true);
  const [resultsData, setResultsData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'questions'

  useEffect(() => {
    if (!isOpen || !game?.id) return;
    let ignore = false;

    async function fetchResults() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient(`/games/${game.id}/results`, {
          headers: adminKey ? { 'x-admin-key': adminKey } : {},
        });
        if (!ignore && res?.ok && res.data) {
          setResultsData(res.data);
        } else if (!ignore) {
          setError(res?.error?.message || 'Could not load match results.');
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to fetch match statistics.');
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchResults();
    return () => {
      ignore = true;
    };
  }, [isOpen, game?.id, adminKey]);

  if (!isOpen) return null;

  const session = resultsData?.session;
  const leaderboard = resultsData?.leaderboard || [];
  const questionsSummary = resultsData?.questionsSummary || [];
  const winner = leaderboard[0] || null;

  const totalQuestions = questionsSummary.length || game.totalQuestions || 0;
  const totalParticipants = session?.totalParticipants || leaderboard.length || 0;

  // Calculate overall accuracy rate
  let totalSubmissionsSum = 0;
  let correctSubmissionsSum = 0;
  questionsSummary.forEach((q) => {
    totalSubmissionsSum += q.totalAnswers || 0;
    correctSubmissionsSum += q.correctCount || 0;
  });
  const overallAccuracy = totalSubmissionsSum > 0
    ? Math.round((correctSubmissionsSum / totalSubmissionsSum) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto">
        <Card
          surface="white"
          shadow="xl"
          border="thick"
          rounded="2xl"
          className="p-5 sm:p-7 relative max-h-[92vh] flex flex-col overflow-hidden shadow-[8px_8px_0_0_#000]"
        >
          {/* Top Bar: Trophy Header & Close Button */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-black/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-[#FBBC05] shadow-[3px_3px_0_0_#000] shrink-0">
                <Trophy className="w-7 h-7 text-black fill-[#FBBC05]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge color="red" size="sm">
                    🏁 Match Ended
                  </Badge>
                  {session?.roomCode && (
                    <span className="font-mono font-black text-xs bg-black text-[#FBBC05] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0_0_#000]">
                      Room PIN: {session.roomCode}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-black/60">
                    {session?.hallName || 'Conference Hall'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight leading-none">
                  {game.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border-[2px] border-black bg-white hover:bg-[#EA4335] hover:text-white text-black flex items-center justify-center transition-all shadow-[2px_2px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer shrink-0"
              title="Close Results"
            >
              <X className="w-5 h-5 font-black" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <Trophy className="w-10 h-10 text-black/40 animate-bounce" />
                <span className="font-black text-sm text-black/70">
                  Loading authoritative tournament scores & leaderboard...
                </span>
              </div>
            ) : error ? (
              <div className="p-6 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-center space-y-2">
                <p className="font-black text-sm text-[#EA4335]">{error}</p>
                <p className="text-xs text-black/60 font-semibold">
                  This game is marked as ENDED, but session telemetry may not have been saved in this environment.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-[#FFF8E7] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                    <span className="text-[10px] font-black uppercase text-black/60 block mb-0.5">
                      🏆 Winner / Champion
                    </span>
                    <span className="font-black text-base text-black truncate block">
                      {winner ? winner.displayName : 'No Winner'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#4285F4]">
                      {winner ? `${winner.totalScore} pts (${winner.correctCount}/${totalQuestions})` : '—'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#EEF4FF] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                    <span className="text-[10px] font-black uppercase text-black/60 block mb-0.5">
                      👥 Total Battlers
                    </span>
                    <span className="font-black text-base text-black block">
                      {totalParticipants}
                    </span>
                    <span className="text-[10px] font-semibold text-black/60">Auditorium Attendees</span>
                  </div>

                  <div className="p-3.5 bg-[#EEFBF3] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                    <span className="text-[10px] font-black uppercase text-[#34A853] block mb-0.5">
                      🎯 Audience Accuracy
                    </span>
                    <span className="font-black text-base text-[#34A853] block">
                      {overallAccuracy}%
                    </span>
                    <span className="text-[10px] font-semibold text-black/60">Correct Answer Rate</span>
                  </div>

                  <div className="p-3.5 bg-[#FFFBF0] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                    <span className="text-[10px] font-black uppercase text-black/60 block mb-0.5">
                      ⚡ Questions
                    </span>
                    <span className="font-black text-base text-black block">
                      {totalQuestions}
                    </span>
                    <span className="text-[10px] font-semibold text-black/60">Server Synchronized</span>
                  </div>
                </div>

                {/* 2. Replay Blocked Notice */}
                <div className="p-3 bg-[#FFFBF0] border-[1.5px] border-black rounded-xl text-xs font-bold text-black/70 flex items-center justify-between gap-3 shadow-[1.5px_1.5px_0_0_#000]">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-[#EA4335] shrink-0" />
                    <span>
                      Game marked as <strong className="text-black">ENDED</strong>. Tournament replays are blocked to ensure fair scoring across auditorium tracks.
                    </span>
                  </div>
                  {session?.roomCode && (
                    <a
                      href={`/stage/${session.roomCode}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-[#FFF8E7] text-black border border-black rounded-lg text-[11px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#000] shrink-0 transition-all cursor-pointer"
                    >
                      <span>Stage View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* 3. Section Tabs */}
                <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('leaderboard')}
                    className={`px-4 py-2 rounded-xl border-[2px] font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'leaderboard'
                        ? 'bg-black text-[#FBBC05] border-black shadow-[2px_2px_0_0_#000]'
                        : 'bg-white text-black/70 border-black/20 hover:border-black hover:text-black'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Final Leaderboard ({leaderboard.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('questions')}
                    className={`px-4 py-2 rounded-xl border-[2px] font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'questions'
                        ? 'bg-black text-[#FBBC05] border-black shadow-[2px_2px_0_0_#000]'
                        : 'bg-white text-black/70 border-black/20 hover:border-black hover:text-black'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Question Breakdown & Options ({questionsSummary.length})</span>
                  </button>
                </div>

                {/* TAB 1: FINAL LEADERBOARD */}
                {activeTab === 'leaderboard' && (
                  <div className="space-y-4">
                    {leaderboard.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-black/20 rounded-xl bg-[#FFFBF0]">
                        <Users className="w-10 h-10 text-black/30 mx-auto mb-2" />
                        <p className="font-black text-sm text-black">No submissions recorded</p>
                        <p className="text-xs text-black/60 font-semibold mt-1">
                          No attendees submitted answers during this match session.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Top 3 Podium Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {leaderboard.slice(0, 3).map((player, idx) => {
                            const medalColor =
                              idx === 0
                                ? 'bg-[#FBBC05] border-black shadow-[3px_3px_0_0_#000]'
                                : idx === 1
                                ? 'bg-[#EEF4FF] border-black shadow-[2px_2px_0_0_#000]'
                                : 'bg-[#FFF8E7] border-black shadow-[2px_2px_0_0_#000]';

                            return (
                              <div
                                key={player.uniqueCode || idx}
                                className={`p-4 rounded-xl border-[2.5px] flex flex-col justify-between gap-3 ${medalColor}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-black text-sm bg-black text-white px-2 py-0.5 rounded-full">
                                    #{player.rank}
                                  </span>
                                  {idx === 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-black bg-white px-2 py-0.5 rounded-full border border-black">
                                      <Sparkles className="w-3 h-3 text-[#EA4335]" /> 1st Place
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h4 className="font-black text-base text-black truncate leading-tight">
                                    {player.displayName}
                                  </h4>
                                  <p className="font-mono text-xs text-black/70 font-bold truncate">
                                    {player.uniqueCode} {player.organization ? `• ${player.organization}` : ''}
                                  </p>
                                </div>

                                <div className="pt-2 border-t border-black/20 flex items-center justify-between text-xs font-black">
                                  <span className="text-[#4285F4]">{player.totalScore} pts</span>
                                  <span className="text-black/60 font-bold text-[11px]">
                                    {player.correctCount}/{totalQuestions} Correct
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Full Rankings Table */}
                        <div className="border-[2px] border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000]">
                          <div className="bg-black text-white px-4 py-2.5 font-black text-xs uppercase tracking-wider grid grid-cols-12 gap-2">
                            <span className="col-span-1">Rank</span>
                            <span className="col-span-5">Battler / Organization</span>
                            <span className="col-span-2 text-center">Correct</span>
                            <span className="col-span-2 text-right">Total Time</span>
                            <span className="col-span-2 text-right">Score</span>
                          </div>

                          <div className="divide-y divide-black/10 bg-white max-h-80 overflow-y-auto">
                            {leaderboard.map((att) => (
                              <div
                                key={att.uniqueCode || att.attendeeId}
                                className={`px-4 py-2.5 grid grid-cols-12 gap-2 items-center text-xs font-bold ${
                                  att.rank === 1 ? 'bg-[#FFFDEE]' : 'hover:bg-[#FFFBF0]'
                                }`}
                              >
                                <span className="col-span-1 font-mono font-black text-sm">
                                  #{att.rank}
                                </span>
                                <div className="col-span-5 min-w-0">
                                  <span className="font-black text-black block truncate">
                                    {att.displayName}
                                  </span>
                                  <span className="font-mono text-[10px] text-black/60 block truncate">
                                    {att.uniqueCode} {att.organization ? `• ${att.organization}` : ''}
                                  </span>
                                </div>
                                <span className="col-span-2 text-center text-black/70 font-black">
                                  {att.correctCount}/{totalQuestions}
                                </span>
                                <span className="col-span-2 text-right font-mono text-black/70">
                                  {att.totalTimeMs > 0 ? (
                                    <span title={`Reaction: ${(att.fastestTimeMs / 1000).toFixed(2)}s`}>
                                      {(att.totalTimeMs / 1000).toFixed(2)}s
                                    </span>
                                  ) : att.fastestTimeMs > 0 ? (
                                    `${(att.fastestTimeMs / 1000).toFixed(2)}s`
                                  ) : (
                                    '—'
                                  )}
                                </span>
                                <span className="col-span-2 text-right font-mono font-black text-[#4285F4]">
                                  {att.totalScore} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 2: QUESTION-BY-QUESTION BREAKDOWN */}
                {activeTab === 'questions' && (
                  <div className="space-y-4">
                    {questionsSummary.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-black/20 rounded-xl bg-[#FFFBF0]">
                        <HelpCircle className="w-10 h-10 text-black/30 mx-auto mb-2" />
                        <p className="font-black text-sm text-black">No questions in this quiz</p>
                      </div>
                    ) : (
                      questionsSummary.map((q, qIdx) => {
                        const qTotal = q.totalAnswers || 0;
                        const qAcc = qTotal > 0 ? Math.round((q.correctCount / qTotal) * 100) : 0;

                        return (
                          <div
                            key={q.questionId || qIdx}
                            className="p-4 sm:p-5 bg-[#FFFDF6] border-[2px] border-black rounded-xl shadow-[3px_3px_0_0_#000] space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-black text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                                  {qIdx + 1}
                                </span>
                                <h4 className="font-black text-sm sm:text-base text-black leading-snug">
                                  {q.prompt}
                                </h4>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                                  qAcc >= 60
                                    ? 'bg-[#EEFBF3] text-[#34A853] border-[#34A853]'
                                    : 'bg-[#FFF0F0] text-[#EA4335] border-[#EA4335]'
                                }`}
                              >
                                {qAcc}% Correct ({q.correctCount}/{qTotal})
                              </span>
                            </div>

                            {q.codeSnippet && (
                              <div className="p-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs rounded-lg overflow-x-auto border border-black">
                                <pre>{q.codeSnippet}</pre>
                              </div>
                            )}

                            {/* Options Distribution Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {(q.options || []).map((opt) => {
                                const isCorrect = opt.id === q.correctOptionId;
                                const pickedCount = q.breakdown?.[opt.id] || 0;
                                const pickedPct = qTotal > 0 ? Math.round((pickedCount / qTotal) * 100) : 0;

                                return (
                                  <div
                                    key={opt.id}
                                    className={`p-3 rounded-lg border-[2px] relative overflow-hidden transition-all ${
                                      isCorrect
                                        ? 'border-[#34A853] bg-[#F2FBF5]'
                                        : 'border-black/30 bg-white'
                                    }`}
                                  >
                                    {/* Percentage fill bar background */}
                                    <div
                                      className={`absolute top-0 bottom-0 left-0 opacity-15 pointer-events-none transition-all ${
                                        isCorrect ? 'bg-[#34A853]' : 'bg-black'
                                      }`}
                                      style={{ width: `${pickedPct}%` }}
                                    />

                                    <div className="relative z-10 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isCorrect ? (
                                          <CheckCircle2 className="w-4 h-4 text-[#34A853] shrink-0" />
                                        ) : (
                                          <span className="w-4 h-4 rounded-full border border-black/40 text-[9px] font-mono flex items-center justify-center shrink-0">
                                            {opt.id.slice(-1)}
                                          </span>
                                        )}
                                        <span
                                          className={`text-xs truncate ${
                                            isCorrect ? 'font-black text-black' : 'font-semibold text-black/80'
                                          }`}
                                        >
                                          {opt.text}
                                        </span>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <span className="font-mono font-black text-xs text-black block">
                                          {pickedPct}%
                                        </span>
                                        <span className="text-[10px] font-bold text-black/50 block">
                                          {pickedCount} picked
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {q.explanation && (
                              <div className="p-2.5 bg-[#FFFBF0] border border-black/20 rounded-lg text-xs font-semibold text-black/70">
                                <span className="font-black text-black">Explanation: </span>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Bar */}
          <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs font-bold text-black/60 hidden sm:inline">
              Authoritative DevFest 2026 Tournament Results
            </span>

            <div className="flex items-center gap-2.5 ml-auto">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
