import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AttendeeVerificationModal } from '../../components/auth/AttendeeVerificationModal';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CountdownLoader } from '../../components/ui/CountdownLoader';
import { apiClient } from '../../services/api/client';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  ArrowRight,
  LogOut,
  Code2,
  Radio,
  Gamepad2,
} from 'lucide-react';

export function PlayerPage() {
  const { roomCode: paramRoomCode } = useParams();
  const [searchParams] = useSearchParams();
  const queryRoomCode = searchParams.get('room') || searchParams.get('pin');
  const initialRoomCode = (paramRoomCode || queryRoomCode || '')?.toUpperCase().trim();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode);
  const [activeRoomCode, setActiveRoomCode] = useState(initialRoomCode);
  const [roomState, setRoomState] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [scheduledSecondsRemaining, setScheduledSecondsRemaining] = useState(null);
  const timerRef = useRef(null);

  // If visited via /play?room=XXXX, sync activeRoomCode
  useEffect(() => {
    if (!paramRoomCode && queryRoomCode) {
      const clean = queryRoomCode.toUpperCase().trim();
      setActiveRoomCode(clean);
      setRoomCodeInput(clean);
    }
  }, [paramRoomCode, queryRoomCode]);

  // Track question index for clean React 19 state resets without cascading render
  const [prevQuestionIndex, setPrevQuestionIndex] = useState(roomState?.currentQuestionIndex);
  if (roomState?.currentQuestionIndex !== prevQuestionIndex) {
    setPrevQuestionIndex(roomState?.currentQuestionIndex);
    setSelectedOptionId(null);
    setSubmissionResult(null);
  }

  // Real-time SSE listener and polling
  useEffect(() => {
    if (!activeRoomCode) return;
    let ignore = false;

    async function loadState() {
      try {
        const res = await apiClient(`/rooms/${activeRoomCode}/state`);
        if (!ignore && res?.ok && res.state) {
          setRoomState(res.state);
          setJoinError(null);
        }
      } catch (err) {
        if (!ignore) setJoinError(err.message || 'Room not found.');
      }
    }

    loadState();

    let eventSource;
    try {
      eventSource = new EventSource(`/api/rooms/${activeRoomCode}/stream`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setRoomState(data);
        } catch {
          // ignore
        }
      };
      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch {
      // ignore
    }

    const poll = setInterval(loadState, 1500);

    return () => {
      ignore = true;
      if (eventSource) eventSource.close();
      clearInterval(poll);
    };
  }, [activeRoomCode]);

  // Synchronized countdown timer
  useEffect(() => {
    if (roomState?.status === 'QUESTION_ACTIVE' && roomState?.questionDeadlineAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((roomState.questionDeadlineAt - Date.now()) / 1000));
        setSecondsRemaining(remaining);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 250);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [roomState?.status, roomState?.questionDeadlineAt]);

  // Synchronized scheduled auto-start timer
  useEffect(() => {
    if (roomState?.status === 'LOBBY' && roomState?.scheduledStartTime) {
      const updateScheduled = () => {
        const rem = Math.max(0, Math.ceil((roomState.scheduledStartTime - Date.now()) / 1000));
        setScheduledSecondsRemaining(rem);
      };
      updateScheduled();
      const interval = setInterval(updateScheduled, 500);
      return () => clearInterval(interval);
    } else {
      setScheduledSecondsRemaining(null);
    }
  }, [roomState?.status, roomState?.scheduledStartTime]);



  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const joinedRoomCodeRef = useRef(null);

  // Auto-join room lobby when authenticated and activeRoomCode is present
  useEffect(() => {
    if (!activeRoomCode || !isAuthenticated) return;
    if (joinedRoomCodeRef.current === activeRoomCode) return;

    let ignore = false;
    async function autoJoinLobby() {
      try {
        const res = await apiClient(`/rooms/${activeRoomCode}/join`, {
          method: 'POST',
          body: JSON.stringify({ pin: activeRoomCode }),
        });
        if (!ignore && res?.ok) {
          joinedRoomCodeRef.current = activeRoomCode;
          setJoinError(null);
        }
      } catch (err) {
        if (!ignore) {
          console.warn('Lobby auto-join warning:', err.message);
          if (err.data?.error?.code === 'PIN_REQUIRED' || err.data?.error?.code === 'INVALID_PIN') {
            setJoinError(err.data?.error?.message || 'Room PIN required.');
          } else if (err.data?.error?.code === 'TRACK_INELIGIBLE') {
            setJoinError(err.data?.error?.message);
          }
        }
      }
    }

    autoJoinLobby();
    return () => {
      ignore = true;
    };
  }, [activeRoomCode, isAuthenticated]);

  const doJoin = async (clean, pin) => {
    setJoinError(null);
    try {
      const res = await apiClient(`/rooms/${clean}/join`, {
        method: 'POST',
        body: JSON.stringify({ pin: pin || clean }),
      });
      if (res?.ok) {
        joinedRoomCodeRef.current = clean;
        setActiveRoomCode(clean);
        navigate(`/play/${clean}`, { replace: true });
      }
    } catch (err) {
      setJoinError(err.data?.error?.message || err.message || 'Failed to join room.');
    }
  };

  const handleJoinRoom = async (e, overrideCode) => {
    e?.preventDefault();
    const clean = (overrideCode || roomCodeInput).trim().toUpperCase();
    if (clean.length !== 6) {
      setJoinError('Room PIN must be a 6-character code.');
      return;
    }

    if (!isAuthenticated) {
      setPendingCode(clean);
      setShowAuthModal(true);
      return;
    }

    await doJoin(clean);
  };

  const handleOptionSelect = useCallback(async (optId) => {
    if (selectedOptionId || isSubmitting || roomState?.status !== 'QUESTION_ACTIVE') return;

    setSelectedOptionId(optId);
    setIsSubmitting(true);

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }

    try {
      const res = await apiClient(`/rooms/${activeRoomCode}/submit-answer`, {
        method: 'POST',
        body: JSON.stringify({
          selectedOptionId: optId,
          idempotencyKey: `sub_q${roomState?.currentQuestionIndex ?? 0}_${optId}`,
        }),
      });

      if (res?.ok) {
        setSubmissionResult(res);
      }
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedOptionId, isSubmitting, roomState, activeRoomCode]);

  // If user navigated directly to a room URL (/play/:roomCode) without being verified, prompt with closeable modal
  if (paramRoomCode && !isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 flex flex-col items-center">
        <AttendeeVerificationModal
          isOpen={true}
          onClose={() => navigate('/games')}
          onSuccess={() => {
            doJoin(paramRoomCode);
          }}
        />
      </div>
    );
  }

  // Condition 2: Enter Room PIN
  if (!activeRoomCode) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center flex-1 w-full gap-5">
        <Card surface="white" shadow="xl" border="thick" rounded="xl" className="p-6 sm:p-8 w-full text-center">
          <Badge color="yellow" size="md" className="mb-3">
            <Sparkles className="w-3.5 h-3.5 inline mr-1" /> DevFest Stage Battle
          </Badge>

          <h1 className="text-2xl font-black uppercase tracking-tight text-black mb-1">
            Enter Room PIN
          </h1>
          <p className="text-xs text-black/70 font-semibold mb-6">
            Look at the auditorium screen for the 6-character room code.
          </p>

          {joinError && (
            <div className="mb-4 p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-xs font-bold text-[#EA4335]">
              {joinError}
            </div>
          )}

          <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
            <input
              type="text"
              required
              maxLength={6}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. RNC26A"
              className="w-full text-center tracking-widest font-mono font-black text-3xl py-3 bg-[#FFFBF0] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
            />

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Enter Battle Arena <ArrowRight className="w-4 h-4 inline ml-1.5" />
            </Button>
          </form>



          <div className="mt-5 pt-3 border-t border-black/10 text-xs font-semibold text-black/60">
            {isAuthenticated && user ? (
              <>
                Playing as <span className="font-bold text-black">{user.displayName}</span>
              </>
            ) : (
              <span className="text-black/50">Ticket verification required upon joining match</span>
            )}
          </div>
        </Card>

        {/* Link to Games Hub */}
        <Link
          to="/games"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#FFF8E7] border-[2px] border-black rounded-full font-black text-xs uppercase tracking-wider text-black shadow-[2px_2px_0_0_#000] transition-all cursor-pointer"
        >
          <Gamepad2 className="w-4 h-4 text-[#4285F4]" />
          <span>Browse All Games & Solo Practice Mode</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>

        {/* Verification Modal with cut/close button */}
        <AttendeeVerificationModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            if (pendingCode) {
              doJoin(pendingCode);
            }
          }}
        />
      </div>
    );
  }

  // Guard for Concluded/Ended Matches
  const isMatchEnded =
    roomState?.isEnded ||
    roomState?.status === 'GAME_OVER' ||
    roomState?.status === 'ARCHIVED' ||
    joinError?.includes('ended') ||
    joinError?.includes('concluded');

  if (isMatchEnded) {
    const userScore =
      roomState?.leaderboard?.find((l) => l.displayName === user?.displayName)?.totalScore || 0;

    return (
      <div className="max-w-md mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center flex-1 w-full gap-5">
        <Card surface="white" shadow="xl" border="thick" rounded="2xl" className="p-6 sm:p-8 w-full text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-black shadow-[3px_3px_0_0_#FBBC05]">
            <Trophy className="w-8 h-8 text-[#FBBC05]" />
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34A853] text-white border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000]">
              🎉 Battle Concluded
            </span>
            <h1 className="text-2xl font-black uppercase text-black tracking-tight mt-2">
              Great Playing!
            </h1>
          </div>

          <p className="text-xs sm:text-sm font-semibold text-black/70 leading-relaxed max-w-xs">
            Your points are locked in! Keep an eye on the main stage screen — our anchors will reveal the official podium winners and live leaderboard!
          </p>

          <div className="w-full bg-[#EEF4FF] border-[2.5px] border-black rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[3px_3px_0_0_#000]">
            <span className="text-[11px] font-black uppercase tracking-wider text-black/60">
              Your Locked Score
            </span>
            <span className="font-mono font-black text-3xl sm:text-4xl text-[#4285F4]">
              {userScore} pts
            </span>
            <span className="text-[10px] font-bold text-black/50 mt-1">
              Official podium & ranks will be announced live on stage
            </span>
          </div>

          <div className="w-full pt-2">
            <Link
              to="/games"
              className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider rounded-xl border-[2px] border-black shadow-[3px_3px_0_0_#FBBC05] text-center inline-block cursor-pointer transition-all"
            >
              ← Return to Games Hub
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Condition 3: Active Room In Flight
  const status = roomState?.status || 'LOBBY';
  const activeQ = roomState?.activeQuestion;
  const isQuestionActive = status === 'QUESTION_ACTIVE' || status === 'PAUSED';
  const isRevealed = status === 'QUESTION_RESULT';
  const isLeaderboard = status === 'LEADERBOARD';
  const isGameOver = status === 'GAME_OVER';

  return (
    <div className="max-w-md mx-auto px-4 py-4 flex flex-col flex-1 w-full justify-between gap-4 select-none">
      {/* Mobile Header Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-2 border-[2px] border-black rounded-full shadow-[2px_2px_0_0_#000]">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-xs bg-black text-[#FBBC05] px-2 py-0.5 rounded-full">
            {activeRoomCode}
          </span>
          <span className="font-black text-xs text-black truncate max-w-[120px]">
            {user?.displayName || 'Player'}
          </span>
        </div>

        <button
          type="button"
          onClick={async () => {
            const currentCode = activeRoomCode;
            joinedRoomCodeRef.current = null;
            setActiveRoomCode('');
            if (currentCode) {
              try {
                await apiClient(`/rooms/${currentCode}/leave`, { method: 'POST' });
              } catch {
                // ignore
              }
            }
            navigate('/games');
          }}
          className="text-[10px] font-black uppercase text-black/60 hover:text-black flex items-center gap-1 cursor-pointer"
        >
          <LogOut className="w-3 h-3" /> Leave
        </button>
      </div>

      {/* STATE 1: LOBBY (WAITING FOR HOST TO START THE GAME) */}
      {status === 'LOBBY' && (
        <Card surface="white" shadow="xl" border="thick" rounded="2xl" className="p-6 sm:p-8 text-center my-auto flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#FFF8E7] border-[3px] border-black flex items-center justify-center text-[#FBBC05] shadow-[4px_4px_0_0_#000]">
              <Sparkles className="w-10 h-10 text-black animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34A853] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-[#34A853] border-[2px] border-black"></span>
            </span>
          </div>

          <Badge color="green" size="md">
            ✓ You're in the Battle!
          </Badge>

          {scheduledSecondsRemaining !== null && (
            <div className="w-full p-3.5 bg-[#EEF4FF] border-[2.5px] border-[#4285F4] rounded-2xl flex items-center justify-center gap-3 shadow-[3px_3px_0_0_#4285F4] animate-pulse">
              <Clock className="w-6 h-6 text-[#4285F4] animate-spin" style={{ animationDuration: '3s' }} />
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-[#4285F4] block leading-none mb-1">
                  Auto-Start Scheduled by Host
                </span>
                <span className="font-mono font-black text-xl text-black leading-none">
                  Starting in {Math.floor(scheduledSecondsRemaining / 60)}:
                  {String(scheduledSecondsRemaining % 60).padStart(2, '0')}{' '}
                  <span className="text-xs font-bold text-black/60">({scheduledSecondsRemaining}s)</span>
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-black">
              {scheduledSecondsRemaining !== null ? 'Starting Soon...' : 'Waiting for Host to start the game...'}
            </h2>
            <p className="text-xs font-semibold text-black/70 leading-relaxed max-w-xs mx-auto">
              You are connected! Keep this screen open on your phone. As soon as the host triggers the launch, the battle starts automatically.
            </p>
          </div>

          <div className="w-full p-3.5 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-left shadow-[2px_2px_0_0_#000] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-black/70 border-b border-black/10 pb-2">
              <span>Attendee</span>
              <span className="text-black font-black">{user?.displayName || 'Verified Attendee'}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-black/70 border-b border-black/10 pb-2">
              <span>Room PIN</span>
              <span className="font-mono font-black text-black bg-[#FBBC05] px-2 py-0.5 rounded border border-black">
                {activeRoomCode}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-black/70">
              <span>Live Arena Status</span>
              <span className="inline-flex items-center gap-1.5 text-[#34A853] font-black">
                <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse"></span>
                {roomState?.attendeeCount || 1} Builders in Lobby
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* STATE 2: COUNTDOWN */}
      {status === 'COUNTDOWN' && (
        <CountdownLoader
          countdownEndsAt={roomState?.countdownEndsAt}
          currentQuestionIndex={roomState?.currentQuestionIndex || 0}
          totalQuestions={roomState?.totalQuestions || 0}
          variant="mobile"
        />
      )}

      {/* STATE 3: QUESTION ACTIVE */}
      {isQuestionActive && activeQ && (
        <div className="flex flex-col gap-3 my-auto">
          {/* Progress Timer */}
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
            <span>Q.{roomState.currentQuestionIndex + 1} of {roomState.totalQuestions}</span>
            <span className="font-mono text-[#EA4335] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 00:{String(secondsRemaining).padStart(2, '0')}
            </span>
          </div>

          {/* Question Prompt */}
          <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-4 text-left">
            <h3 className="font-black text-base text-black leading-snug mb-2">
              {activeQ.prompt}
            </h3>

            {activeQ.codeSnippet && (
              <div className="p-2.5 bg-[#0D2818] text-[#34A853] font-mono text-xs rounded-lg border border-black mb-2 overflow-x-auto">
                <Code2 className="w-3 h-3 inline mr-1 text-white/50" />
                <code>{activeQ.codeSnippet}</code>
              </div>
            )}
          </Card>

          {/* 4 Large Tactile Mobile Choice Buttons */}
          <div className="grid grid-cols-1 gap-2.5">
            {activeQ.options.map((opt, idx) => {
              const colors = [
                { bg: 'bg-[#EA4335]', border: 'border-black', letter: 'A' },
                { bg: 'bg-[#4285F4]', border: 'border-black', letter: 'B' },
                { bg: 'bg-[#FBBC05]', border: 'border-black', letter: 'C' },
                { bg: 'bg-[#34A853]', border: 'border-black', letter: 'D' },
              ];
              const theme = colors[idx % 4];
              const isSelected = selectedOptionId === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={Boolean(selectedOptionId)}
                  onClick={() => handleOptionSelect(opt.id)}
                  className={`w-full p-4 rounded-2xl border-[3px] ${theme.border} ${theme.bg} text-white font-black text-base text-left flex items-center gap-3 transition-all cursor-pointer shadow-[3px_3px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                    idx === 2 ? 'text-black' : 'text-white'
                  } ${
                    selectedOptionId && !isSelected ? 'opacity-40 grayscale-[50%]' : ''
                  } ${
                    isSelected ? 'ring-4 ring-black scale-[1.02] shadow-[5px_5px_0_0_#000]' : ''
                  }`}
                >
                  <span className="w-8 h-8 rounded-xl bg-black text-white border border-white/50 flex items-center justify-center font-black text-sm shrink-0">
                    {theme.letter}
                  </span>
                  {opt.mediaUrl && (
                    <img
                      src={opt.mediaUrl}
                      alt=""
                      className="w-11 h-11 object-cover rounded-lg border-2 border-black/30 bg-white/20 shrink-0 shadow-[1px_1px_0_0_#000]"
                    />
                  )}
                  <span className="truncate leading-tight">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {selectedOptionId && (
            <div className="p-3 bg-[#EEFBF3] border-[2px] border-[#34A853] rounded-xl text-center text-xs font-black text-[#0D2818] shadow-[2px_2px_0_0_#34A853] animate-fade-in">
              ✓ Choice Locked! Waiting for timer to expire...
            </div>
          )}
        </div>
      )}

      {/* STATE 4: QUESTION LOCKED */}
      {status === 'QUESTION_LOCKED' && (
        <Card surface="warmWhite" shadow="lg" border="thick" rounded="xl" className="p-6 text-center my-auto flex flex-col items-center gap-3">
          <Clock className="w-10 h-10 text-[#EA4335] animate-spin" />
          <h2 className="text-xl font-black uppercase text-black">
            Time's Up!
          </h2>
          <p className="text-xs font-semibold text-black/70">
            Calculating points and auditorium distribution...
          </p>
        </Card>
      )}

      {/* STATE 5: QUESTION RESULT (ANTI-CHEATING: No mid-game answer revelation) */}
      {isRevealed && (
        <Card surface="white" shadow="lg" border="thick" rounded="xl" className="p-6 text-center my-auto flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-black shadow-[3px_3px_0_0_#000]">
            <Sparkles className="w-8 h-8 text-[#FBBC05]" />
          </div>

          <Badge color="yellow" size="md">
            🔒 Submission Recorded
          </Badge>

          <h2 className="text-xl font-black uppercase text-black">
            Answers Sealed on Server
          </h2>

          <p className="text-xs font-semibold text-black/70 leading-relaxed max-w-xs mx-auto">
            Look at the auditorium screen! To prevent audience cheating, your total score and podium standing will be revealed at the end of the battle.
          </p>

          <div className="w-full pt-3 border-t border-black/10 text-[11px] font-bold text-black/60">
            Waiting for Stage Host to launch next question...
          </div>
        </Card>
      )}

      {/* STATE 6: LEADERBOARD / GAME OVER */}
      {(isLeaderboard || isGameOver) && (
        <Card surface="white" shadow="lg" border="thick" rounded="2xl" className="p-6 text-center my-auto flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-black shadow-[3px_3px_0_0_#FBBC05]">
            <Trophy className="w-8 h-8 text-[#FBBC05]" />
          </div>
          
          <div className="space-y-1">
            <Badge color={isGameOver ? 'green' : 'yellow'} size="md">
              {isGameOver ? '🎉 BATTLE CONCLUDED' : '⚡ ROUND COMPLETE'}
            </Badge>
            <h2 className="text-2xl font-black uppercase text-black">
              {isGameOver ? 'Great Playing!' : 'Round Points Recorded'}
            </h2>
          </div>

          <div className="w-full bg-[#EEF4FF] border-[2.5px] border-black rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[3px_3px_0_0_#000]">
            <span className="text-[11px] font-black uppercase tracking-wider text-black/60">
              Your Total Score
            </span>
            <span className="font-mono font-black text-3xl sm:text-4xl text-[#4285F4]">
              {roomState.leaderboard?.find((l) => l.displayName === user?.displayName)?.totalScore || 0} pts
            </span>
            <span className="text-[10px] font-bold text-black/50 mt-1">
              {isGameOver
                ? 'Official podium & ranks will be announced live on stage!'
                : 'Look at the auditorium screen for live standings!'}
            </span>
          </div>

          <p className="text-xs font-semibold text-black/70 leading-relaxed max-w-xs">
            {isGameOver
              ? 'Your score is locked in. Watch the stage projector screen to see the anchor reveal the winners!'
              : 'Look up at the main stage screen for the top leaders on the live board!'}
          </p>

          {isGameOver && (
            <div className="w-full pt-2">
              <Link
                to="/games"
                className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider rounded-xl border-[2px] border-black shadow-[3px_3px_0_0_#FBBC05] text-center inline-block cursor-pointer transition-all"
              >
                ← Return to Games Hub
              </Link>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
