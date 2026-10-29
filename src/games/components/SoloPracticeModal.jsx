import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../services/api/client';
import {
  X,
  Sparkles,
  Clock,
  Lock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Code2,
  Trophy,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function SoloPracticeModal({ gameId, isOpen, onClose }) {
  const { user, isAuthenticated } = useAuth();

  const [game, setGame] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [isCompleted, setIsCompleted] = useState(false);
  const [finalReport, setFinalReport] = useState(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // Store user submissions locally: array of { questionId, selectedOptionId }
  const submissionsRef = useRef([]);
  const timerRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);

  // Initialize and load game
  useEffect(() => {
    if (!isOpen || !gameId) return;
    let ignore = false;

    async function loadGame() {
      setIsLoading(true);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setSecondsRemaining(15);
      setIsCompleted(false);
      setFinalReport(null);
      submissionsRef.current = [];

      try {
        const res = await apiClient(`/games/public/${gameId}`);
        if (!ignore && res?.ok && res.game) {
          setGame(res.game);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadGame();
    return () => {
      ignore = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, [isOpen, gameId]);

  const questions = game?.questions || [];
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;

  // Grade all answers when game finishes
  const finishGame = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsCompleted(true);

    try {
      const res = await apiClient(`/games/public/${gameId}/grade-all`, {
        method: 'POST',
        body: JSON.stringify({
          submissions: submissionsRef.current,
        }),
      });
      if (res?.ok) {
        setFinalReport(res);
      }
    } catch {
      // Fallback local calculation if offline
      setFinalReport({
        totalQuestions,
        correctCount: 0,
        totalScore: 0,
        breakdown: [],
      });
    }
  }, [gameId, totalQuestions]);

  // Advance question handler (strictly automatic)
  const advanceToNext = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);

    // Record submission for current question
    const qId = currentQ?.questionId;
    if (qId) {
      // Replace or add
      const existingIdx = submissionsRef.current.findIndex((s) => s.questionId === qId);
      if (existingIdx >= 0) {
        submissionsRef.current[existingIdx] = { questionId: qId, selectedOptionId };
      } else {
        submissionsRef.current.push({ questionId: qId, selectedOptionId });
      }
    }

    if (currentIndex + 1 < totalQuestions) {
      const nextQ = questions[currentIndex + 1];
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setSecondsRemaining(nextQ?.timeLimitSeconds || 15);
    } else {
      finishGame();
    }
  }, [currentIndex, currentQ, totalQuestions, questions, selectedOptionId, finishGame]);

  // Fixed Timer Countdown: Auto advances when timer hits 0
  useEffect(() => {
    if (!isOpen || isLoading || isCompleted || !currentQ) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          advanceToNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isLoading, isCompleted, currentQ, advanceToNext]);

  // Handle option select: lock answer without showing correct/incorrect
  const handleSelectOption = (optId) => {
    if (selectedOptionId || isCompleted) return;

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }

    setSelectedOptionId(optId);

    // Save immediate reference
    const qId = currentQ?.questionId;
    if (qId) {
      const existingIdx = submissionsRef.current.findIndex((s) => s.questionId === qId);
      if (existingIdx >= 0) {
        submissionsRef.current[existingIdx] = { questionId: qId, selectedOptionId: optId };
      } else {
        submissionsRef.current.push({ questionId: qId, selectedOptionId: optId });
      }
    }

    // Auto-advance after 1.8 seconds of lock confirmation (no manual next button!)
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      advanceToNext();
    }, 1800);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setSecondsRemaining(questions[0]?.timeLimitSeconds || 15);
    setIsCompleted(false);
    setFinalReport(null);
    submissionsRef.current = [];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#FFFBF0] border-[3px] border-black rounded-[24px] shadow-[8px_8px_0_0_#000] p-4 sm:p-7 flex flex-col max-h-[94vh] overflow-y-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black/10">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#FBBC05] border-[2px] border-black flex items-center justify-center text-black font-black shadow-[2px_2px_0_0_#000]">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black text-[#FBBC05] px-2 py-0.5 rounded-full">
                  Solo Practice Arena
                </span>
                <span className="text-xs font-bold text-black/60 truncate max-w-[150px] sm:max-w-none">
                  {game?.title || 'Loading Quiz...'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border-[2px] border-black bg-white hover:bg-[#FFF5F5] flex items-center justify-center text-black shadow-[2px_2px_0_0_#000] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CHECK 1: VERIFICATION BARRIER */}
        {!isAuthenticated ? (
          <div className="py-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#EEF4FF] border-[2.5px] border-black flex items-center justify-center text-[#4285F4] shadow-[3px_3px_0_0_#000]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <Badge color="red" size="md">
              Ticket Verification Required
            </Badge>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
              Verify Before You Battle
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-black/70 max-w-md leading-relaxed">
              To record your score and identify who played the game, please verify your official ticket code.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Button variant="primary" size="md" onClick={onClose}>
                Back to Games Hub
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          /* Loading */
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-black border-t-[#4285F4] rounded-full animate-spin" />
            <span className="text-xs font-black uppercase tracking-wider text-black/60">
              Syncing Challenge Snapshot...
            </span>
          </div>
        ) : isCompleted ? (
          /* FINISHED STATE — FINAL SCORECARD (Answers & Explanations Revealed Here) */
          <div className="py-4 text-center flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#FBBC05] border-[3px] border-black flex items-center justify-center text-black shadow-[4px_4px_0_0_#000] animate-bounce">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <Badge color="green" size="md" className="mb-2">
                Challenge Complete!
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
                {finalReport?.totalScore === totalQuestions * 100
                  ? 'Flawless Master Score!'
                  : (finalReport?.correctCount || 0) >= totalQuestions / 2
                  ? 'Outstanding Performance!'
                  : 'Practice Complete!'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-black/70 mt-1 max-w-md mx-auto">
                Attendee <span className="font-bold text-black">{user?.displayName}</span>
              </p>
            </div>

            {/* Scorecard Metrics */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
              <div className="p-3 bg-white border-[2.5px] border-black rounded-xl text-center shadow-[2.5px_2.5px_0_0_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block">Score</span>
                <span className="font-mono font-black text-xl text-[#4285F4]">
                  {finalReport?.totalScore ?? 0}
                </span>
              </div>
              <div className="p-3 bg-white border-[2.5px] border-black rounded-xl text-center shadow-[2.5px_2.5px_0_0_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block">Correct</span>
                <span className="font-mono font-black text-xl text-[#34A853]">
                  {finalReport?.correctCount ?? 0} / {totalQuestions}
                </span>
              </div>
              <div className="p-3 bg-white border-[2.5px] border-black rounded-xl text-center shadow-[2.5px_2.5px_0_0_#000]">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block">Accuracy</span>
                <span className="font-mono font-black text-xl text-[#EA4335]">
                  {totalQuestions > 0 ? Math.round(((finalReport?.correctCount || 0) / totalQuestions) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* In-Depth Review & Explanations Accordion */}
            {finalReport?.breakdown && finalReport.breakdown.length > 0 && (
              <div className="w-full text-left mt-2">
                <span className="text-xs font-black uppercase tracking-wider text-black block mb-2">
                  Detailed Answer Review & Technical Explanations:
                </span>
                <div className="flex flex-col gap-2">
                  {finalReport.breakdown.map((item, idx) => {
                    const isExpanded = expandedQuestionId === item.questionId;
                    return (
                      <div
                        key={item.questionId || idx}
                        className={`p-3 rounded-xl border-[2px] border-black shadow-[2px_2px_0_0_#000] transition-all ${
                          item.isCorrect ? 'bg-[#EEFBF3]' : 'bg-[#FFF5F5]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedQuestionId(isExpanded ? null : item.questionId)}
                          className="w-full flex items-center justify-between text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {item.isCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-[#34A853] shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-[#EA4335] shrink-0" />
                            )}
                            <span className="font-black text-xs text-black">
                              Q.{idx + 1}: {item.prompt}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-black shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-black shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 pt-2.5 border-t border-black/15 text-xs text-black/80 font-semibold space-y-1 animate-fade-in">
                            <p>
                              <span className="font-bold">Your Choice:</span> {item.selectedOptionId ? 'Selected' : 'Unanswered / Timed Out'}
                            </p>
                            <p className="text-[#0D2818] bg-black/5 p-2 rounded-lg font-medium">
                              💡 <span className="font-bold">Explanation:</span> {item.explanation || 'No explanation provided.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions: No Replay Option */}
            <div className="flex items-center gap-3 flex-wrap justify-center mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFBF0] border-[2px] border-black text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-[2px_2px_0_0_#000]">
                🏁 Match Complete
              </span>
              <Button variant="primary" size="md" onClick={onClose} className="font-black">
                Back to Arena Hub
              </Button>
            </div>
          </div>
        ) : currentQ ? (
          /* ACTIVE QUESTION RUNNING WITH FIXED COUNTDOWN */
          <div className="flex flex-col gap-4">
            {/* Countdown & Progress Bar */}
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-black">
              <span>
                Question {currentIndex + 1} of {totalQuestions}
              </span>
              <span className="font-mono text-[#EA4335] flex items-center gap-1.5 bg-[#FFF5F5] px-2.5 py-1 rounded-full border-[1.5px] border-[#EA4335]">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                00:{String(secondsRemaining).padStart(2, '0')}
              </span>
            </div>

            <div className="w-full h-2.5 bg-black/10 border-[1.5px] border-black rounded-full overflow-hidden">
              <div
                className="h-full bg-[#34A853] transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>

            {/* Prompt Card */}
            <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-4 sm:p-5 text-left">
              <h3 className="font-black text-base sm:text-lg text-black leading-snug mb-2">
                {currentQ.prompt}
              </h3>

              {currentQ.codeSnippet && (
                <div className="p-3 bg-[#0D2818] text-[#34A853] font-mono text-xs rounded-xl border-2 border-black overflow-x-auto shadow-[2px_2px_0_0_#000]">
                  <Code2 className="w-3.5 h-3.5 inline mr-1 text-white/50" />
                  <code>{currentQ.codeSnippet}</code>
                </div>
              )}
            </Card>

            {/* 4 Choices — NO REVELATION OF WRONG/RIGHT DURING QUIZ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQ.options.map((opt, idx) => {
                const colors = [
                  { bg: 'bg-[#EA4335]', border: 'border-black', letter: 'A' },
                  { bg: 'bg-[#4285F4]', border: 'border-black', letter: 'B' },
                  { bg: 'bg-[#FBBC05]', border: 'border-black', letter: 'C' },
                  { bg: 'bg-[#34A853]', border: 'border-black', letter: 'D' },
                ];
                const theme = colors[idx % 4];
                const isSelected = selectedOptionId === opt.id;

                let cardStyle = `${theme.bg} ${theme.border} text-white`;
                if (idx === 2) cardStyle = `${theme.bg} ${theme.border} text-black`;

                if (selectedOptionId) {
                  if (isSelected) {
                    cardStyle = 'bg-black text-[#FBBC05] border-black ring-4 ring-[#FBBC05] scale-[1.02] shadow-[4px_4px_0_0_#000]';
                  } else {
                    cardStyle += ' opacity-40 grayscale-[60%]';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(selectedOptionId)}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`p-3.5 rounded-xl border-[2.5px] font-black text-xs sm:text-sm text-left flex items-center gap-3 transition-all cursor-pointer shadow-[2.5px_2.5px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] ${cardStyle}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-black text-white border border-white/40 flex items-center justify-center font-black text-xs shrink-0">
                      {theme.letter}
                    </span>
                    <span className="truncate leading-tight">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Suspenseful Locked Indicator (NO ANSWER REVEALED MID-GAME) */}
            {selectedOptionId ? (
              <div className="p-3.5 bg-[#FFF8E7] border-[2px] border-black rounded-xl text-center text-xs font-black text-black shadow-[2px_2px_0_0_#000] animate-fade-in flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-[#EA4335]" />
                <span>Choice Locked! Advancing to next question automatically...</span>
              </div>
            ) : (
              <div className="text-center text-[11px] font-bold text-black/50">
                🔒 Anti-Cheating active: Results and explanations will appear on your Final Scorecard.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
