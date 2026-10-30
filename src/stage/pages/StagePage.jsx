import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CountdownLoader } from '../../components/ui/CountdownLoader';
import {
  Trophy,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  Code2,
  Radio,
  ArrowRight,
  QrCode,
  X,
} from 'lucide-react';

export function StagePage() {
  const { roomCode: pathRoomCode } = useParams();
  const [searchParams] = useSearchParams();
  const queryRoomCode = searchParams.get('room') || searchParams.get('pin');
  const roomCode = (pathRoomCode || queryRoomCode)?.toUpperCase().trim();
  const navigate = useNavigate();

  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(15);
  const [scheduledRemaining, setScheduledRemaining] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const timerRef = useRef(null);

  // If accessed via query param /stage?room=XXXX, normalize to clean /stage/XXXX
  useEffect(() => {
    if (!pathRoomCode && queryRoomCode) {
      navigate(`/stage/${queryRoomCode.toUpperCase().trim()}`, { replace: true });
    }
  }, [pathRoomCode, queryRoomCode, navigate]);

  // Auto-redirect if /stage is visited without roomCode and an active room exists
  useEffect(() => {
    if (roomCode) return;
    let ignore = false;
    async function checkActiveBattle() {
      try {
        const res = await fetch('/api/games/leaderboard/summary');
        if (!ignore && res.ok) {
          const data = await res.json();
          const active = data?.data?.activeRooms || [];
          if (active.length > 0 && active[0].roomCode) {
            navigate(`/stage/${active[0].roomCode}`, { replace: true });
          }
        }
      } catch {
        // ignore
      }
    }
    checkActiveBattle();
    return () => {
      ignore = true;
    };
  }, [roomCode, navigate]);

  // Real-time SSE listener with fallback polling
  useEffect(() => {
    if (!roomCode) return;
    let ignore = false;

    async function fetchState() {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/state`);
        if (!ignore && res.ok) {
          const data = await res.json();
          setState(data.state);
          setError(null);
        } else if (!ignore) {
          setError(`Room "${roomCode}" not found.`);
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    fetchState();

    let eventSource;
    try {
      eventSource = new EventSource(`/api/rooms/${roomCode}/stream`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setState(data);
          setError(null);
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      };
      eventSource.onerror = () => {
        // Fallback to polling on network hiccups
        eventSource.close();
      };
    } catch {
      // ignore
    }

    const pollInterval = setInterval(fetchState, 1500);

    return () => {
      ignore = true;
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [roomCode]);

  // Synchronized countdown timer
  useEffect(() => {
    if (state?.status === 'QUESTION_ACTIVE' && state?.questionDeadlineAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((state.questionDeadlineAt - Date.now()) / 1000));
        setSecondsRemaining(remaining);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 200);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [state?.status, state?.questionDeadlineAt]);

  // Synchronized scheduled auto-start timer
  useEffect(() => {
    if (state?.status === 'LOBBY' && state?.scheduledStartTime) {
      const update = () => {
        const rem = Math.max(0, Math.ceil((state.scheduledStartTime - Date.now()) / 1000));
        setScheduledRemaining(rem);
      };
      update();
      const interval = setInterval(update, 500);
      return () => clearInterval(interval);
    } else {
      setScheduledRemaining(null);
    }
  }, [state?.status, state?.scheduledStartTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  if (!roomCode) {
    const handlePinSubmit = (e) => {
      e.preventDefault();
      if (pinInput.trim()) {
        navigate(`/stage/${pinInput.trim().toUpperCase()}`);
      }
    };

    return (
      <div className="min-h-screen bg-[#FFFBF0] flex flex-col items-center justify-center p-6 select-none relative">
        <div className="tribal-stripe absolute top-0 left-0 right-0 border-b-[2.5px] border-black" />
        <Card
          surface="white"
          shadow="xl"
          border="thick"
          rounded="2xl"
          className="p-8 max-w-md w-full text-center flex flex-col items-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#EEF4FF] border-[2.5px] border-black flex items-center justify-center text-[#4285F4] shadow-[3px_3px_0_0_#4285F4]">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-[#4285F4] text-white border border-black rounded shadow-[1px_1px_0_0_#000]">
              Auditorium Display
            </span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-black mt-2">
              Stage Projector View
            </h1>
            <p className="text-xs font-semibold text-black/70 mt-1">
              Connect to an active auditorium match or enter the Battle Room PIN.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="w-full space-y-3">
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM PIN (e.g. HP3XDW)"
              maxLength={8}
              className="w-full text-center font-mono font-black text-lg py-3 px-4 border-[2.5px] border-black rounded-xl bg-[#FFFBF0] uppercase tracking-widest placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#4285F4] shadow-[2px_2px_0_0_#000]"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center font-black shadow-[2px_2px_0_0_#000]"
              disabled={!pinInput.trim()}
            >
              <span>Launch Projector View</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          <div className="w-full pt-3 border-t-2 border-black/10 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              Operator Console
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
              Games Hub
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    const handleRetryPin = (e) => {
      e.preventDefault();
      if (pinInput.trim()) {
        setError(null);
        navigate(`/stage/${pinInput.trim().toUpperCase()}`);
      }
    };

    return (
      <div className="min-h-screen bg-[#FFFBF0] flex flex-col items-center justify-center p-6 select-none relative">
        <div className="tribal-stripe absolute top-0 left-0 right-0 border-b-[2.5px] border-black" />
        <Card
          surface="white"
          shadow="xl"
          border="thick"
          rounded="2xl"
          className="p-8 max-w-md w-full text-center flex flex-col items-center gap-5 border-[3px] border-black shadow-[8px_8px_0_0_#000]"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FDE8E8] border-[2.5px] border-black flex items-center justify-center text-[#EA4335] shadow-[3px_3px_0_0_#EA4335]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-[#EA4335] text-white border border-black rounded shadow-[1px_1px_0_0_#000]">
              Connection Error
            </span>
            <h1 className="text-xl font-black uppercase tracking-tight text-black mt-2">
              {error}
            </h1>
            <p className="text-xs font-semibold text-black/70 mt-1">
              Verify the Room PIN displayed on the Operator Master Console or enter a new PIN below.
            </p>
          </div>

          <form onSubmit={handleRetryPin} className="w-full space-y-3">
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM PIN (e.g. HP3XDW)"
              maxLength={8}
              className="w-full text-center font-mono font-black text-lg py-3 px-4 border-[2.5px] border-black rounded-xl bg-[#FFFBF0] uppercase tracking-widest placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#4285F4] shadow-[2px_2px_0_0_#000]"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center font-black shadow-[2px_2px_0_0_#000]"
              disabled={!pinInput.trim()}
            >
              <span>Connect to Stage</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          <div className="w-full pt-3 border-t-2 border-black/10 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              Operator Console
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
              Games Hub
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF0]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
          <span className="font-black text-sm uppercase tracking-wider text-black">
            Connecting to Room {roomCode}...
          </span>
        </div>
      </div>
    );
  }

  const { status, activeQuestion, resultsBreakdown, leaderboard = [], attendeeCount, submissionCount } = state;
  const isQuestionActive = status === 'QUESTION_ACTIVE' || status === 'PAUSED';
  const isRevealed = status === 'QUESTION_RESULT';
  const isLeaderboard = status === 'LEADERBOARD';
  const isGameOver = status === 'GAME_OVER';

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play/${roomCode}`
    : `/play/${roomCode}`;

  return (
    <div className="min-h-screen bg-[#FFFBF0] flex flex-col justify-between p-4 sm:p-8 select-none overflow-hidden relative">
      {/* Top 4-Color Stripe Ribbon */}
      <div className="tribal-stripe absolute top-0 left-0 right-0 border-b-[2.5px] border-black" />

      {/* Header Bar */}
      <header className="flex items-center justify-between gap-4 mt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-black text-white px-4 py-1.5 rounded-full border-[2px] border-black shadow-[2px_2px_0_0_#FBBC05]">
            <span className="text-xs font-black uppercase tracking-wider">PIN:</span>
            <span className="font-mono font-black text-lg text-[#FBBC05]">{roomCode}</span>
          </div>

          <Badge color="sand" size="sm">
            {state.trackTarget?.toUpperCase() || 'ALL TRACKS'}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-[#FFF8E7] text-black px-3.5 py-1.5 rounded-full border-[2px] border-black shadow-[2px_2px_0_0_#000] text-xs font-black cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
            title="Scan to Join"
          >
            <QrCode className="w-4 h-4 text-[#4285F4]" />
            <span className="hidden sm:inline">Join QR</span>
          </button>

          <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1 rounded-full border-[2px] border-black text-xs font-black text-black shadow-[2px_2px_0_0_#000]">
            <Users className="w-4 h-4 text-[#4285F4]" />
            <span>{attendeeCount} Connected</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-white border-[2px] border-black rounded-full shadow-[2px_2px_0_0_#000] hover:bg-[#FFF8E7] cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Auditorium Projection Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center my-6 max-w-[1300px] w-full mx-auto">
        {/* VIEW 1: LOBBY */}
        {status === 'LOBBY' && (
          <div className="text-center flex flex-col items-center gap-6 animate-fade-in w-full max-w-4xl mx-auto my-auto">
            <div className="flex items-center gap-2">
              <Badge color="yellow" size="lg" className="animate-pulse">
                <Sparkles className="w-4 h-4 inline mr-1.5" /> Stage Battle Lobby
              </Badge>
              {state.hallName && (
                <Badge color="blue" size="lg">
                  🏛️ {state.hallName}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-black leading-none">
                {state.gameTitle || 'DevFest Ranchi 2026'}
              </h1>
              <p className="text-sm sm:text-base font-bold text-black/60">
                Scan the QR code with your phone camera or enter the PIN to join!
              </p>
            </div>

            {/* QR Code & Join Info Neo-Brutalist Hero Card */}
            <div className="p-6 sm:p-8 bg-white border-[3.5px] border-black rounded-[28px] shadow-[8px_8px_0_0_#000] flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 w-full max-w-3xl">
              {/* Left Column: QR Code */}
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-white border-[2.5px] border-black rounded-2xl shadow-[4px_4px_0_0_#000] flex items-center justify-center">
                  <QRCodeSVG
                    value={joinUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                    className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]"
                  />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEFBF3] border-[1.5px] border-black rounded-full text-xs font-black uppercase text-[#34A853] shadow-[1.5px_1.5px_0_0_#000]">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan to Join Instantly</span>
                </div>
              </div>

              {/* Middle Divider */}
              <div className="flex md:flex-col items-center gap-2 text-black/30 font-black text-xs uppercase">
                <span className="w-16 md:w-0.5 h-0.5 md:h-20 bg-black/20" />
                <span className="px-2.5 py-1 rounded-full bg-black text-white text-[10px] font-black shadow-[1px_1px_0_0_#000]">
                  OR
                </span>
                <span className="w-16 md:w-0.5 h-0.5 md:h-20 bg-black/20" />
              </div>

              {/* Right Column: Manual Join Details */}
              <div className="flex flex-col items-center md:items-start gap-3.5">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-black/60 block mb-1">
                    Audience Join PIN
                  </span>
                  <div className="font-mono font-black text-5xl sm:text-6xl tracking-widest text-[#4285F4] bg-[#EEF4FF] px-6 py-2 rounded-2xl border-[2.5px] border-black shadow-[3px_3px_0_0_#000]">
                    {roomCode}
                  </div>
                </div>

                <div className="text-xs font-bold text-black/70 flex items-center gap-1.5 flex-wrap justify-center md:justify-start">
                  <span>Visit:</span>
                  <span className="font-mono font-black text-black bg-[#FFF8E7] px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0_0_#000]">
                    {typeof window !== 'undefined' ? window.location.host : ''}/play
                  </span>
                </div>

                {scheduledRemaining !== null ? (
                  <div className="px-4 py-2 bg-[#FBBC05] text-black font-black text-sm uppercase rounded-xl border-[2px] border-black shadow-[2px_2px_0_0_#000] flex items-center gap-2 animate-pulse mt-1">
                    <Clock className="w-4 h-4 text-black" />
                    <span>
                      Auto-Start in {Math.floor(scheduledRemaining / 60)}:
                      {String(scheduledRemaining % 60).padStart(2, '0')} ({scheduledRemaining}s)
                    </span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 bg-[#EEFBF3] text-[#34A853] font-black text-xs uppercase rounded-xl border-[1.5px] border-black shadow-[1.5px_1.5px_0_0_#000] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-ping" />
                    <span>Lobby Open • Waiting for all to Join </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-base font-black text-black bg-white px-5 py-2.5 rounded-full border-[2.5px] border-black shadow-[3px_3px_0_0_#000]">
              <span className="w-3.5 h-3.5 rounded-full bg-[#34A853] animate-pulse" />
              <span>{attendeeCount} Builders Checked In to this Battle</span>
            </div>
          </div>
        )}

        {/* VIEW 2: COUNTDOWN */}
        {status === 'COUNTDOWN' && (
          <CountdownLoader
            countdownEndsAt={state?.countdownEndsAt}
            currentQuestionIndex={state?.currentQuestionIndex || 0}
            totalQuestions={state?.totalQuestions || 0}
            variant="stage"
          />
        )}

        {/* VIEW 3: QUESTION ACTIVE / LOCKED / REVEALED */}
        {(isQuestionActive || status === 'QUESTION_LOCKED' || isRevealed) && activeQuestion && (
          <div className="w-full flex flex-col gap-6 animate-fade-in">
            {/* Top Prompt Card */}
            <Card surface="white" shadow="xl" border="thick" rounded="xl" className="p-6 sm:p-8 relative overflow-hidden">
              <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b-2 border-black/10">
                <div className="flex items-center gap-2">
                  <Badge color="blue" size="md">
                    Question {state.currentQuestionIndex + 1} of {state.totalQuestions}
                  </Badge>
                  {status === 'PAUSED' && (
                    <Badge color="yellow" size="md">
                      ⏸️ PAUSED
                    </Badge>
                  )}
                  {status === 'QUESTION_LOCKED' && (
                    <Badge color="red" size="md">
                      🔒 TIME'S UP!
                    </Badge>
                  )}
                </div>

                {/* Big Live Countdown */}
                {isQuestionActive && (
                  <div className="inline-flex items-center gap-2 bg-[#FFF5F5] border-[2.5px] border-[#EA4335] px-4 py-1.5 rounded-full shadow-[2px_2px_0_0_#EA4335]">
                    <Clock className="w-5 h-5 text-[#EA4335] animate-spin" />
                    <span className="font-mono font-black text-xl text-[#EA4335]">
                      00:{String(secondsRemaining).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              {/* Prompt Text */}
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-black leading-tight mb-4">
                {activeQuestion.prompt}
              </h2>

              {/* Code Snippet Box */}
              {activeQuestion.codeSnippet && (
                <div className="p-4 bg-[#0D2818] border-[2.5px] border-black rounded-xl text-[#34A853] font-mono text-sm shadow-[3px_3px_0_0_#000] mb-4 overflow-x-auto">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-white/50 mb-1 border-b border-white/10 pb-1">
                    <Code2 className="w-3 h-3" /> Code Snippet
                  </div>
                  <code>{activeQuestion.codeSnippet}</code>
                </div>
              )}

              {/* Diagram / Image */}
              {activeQuestion.mediaUrl && (
                <div className="mb-4 max-h-64 flex justify-center">
                  <img
                    src={activeQuestion.mediaUrl}
                    alt="Diagram"
                    className="max-h-60 rounded-xl border-[2px] border-black object-contain shadow-[2px_2px_0_0_#000]"
                  />
                </div>
              )}

              {/* Live Answer Submissions Progress */}
              <div className="flex items-center justify-between text-xs font-bold text-black/70 pt-2 border-t border-black/10">
                <span>Auditorium Submissions:</span>
                <span className="font-mono font-black text-sm text-black">
                  {submissionCount} / {attendeeCount} Answers Submitted
                </span>
              </div>
            </Card>

            {/* 4 Colored Option Cards */}
            {activeQuestion.options.some((opt) => Boolean(opt.mediaUrl)) ? (
              /* 2 Rows x 2 Columns Grid for Image Options (Kahoot/Quizizz style) */
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {activeQuestion.options.map((opt, idx) => {
                  const colors = [
                    { bg: 'bg-[#EA4335]', text: 'text-white', letter: 'A', id: 'opt_1' },
                    { bg: 'bg-[#4285F4]', text: 'text-white', letter: 'B', id: 'opt_2' },
                    { bg: 'bg-[#FBBC05]', text: 'text-black', letter: 'C', id: 'opt_3' },
                    { bg: 'bg-[#34A853]', text: 'text-white', letter: 'D', id: 'opt_4' },
                  ];
                  const theme = colors[idx % 4];
                  const isCorrect = isRevealed && resultsBreakdown?.correctOptionId === opt.id;
                  const voteCount = isRevealed ? resultsBreakdown?.[opt.id] || 0 : null;

                  return (
                    <div
                      key={opt.id}
                      className={`p-3.5 sm:p-5 rounded-2xl border-[3px] border-black shadow-[5px_5px_0_0_#000] flex flex-col justify-between transition-all ${
                        theme.bg
                      } ${theme.text} ${
                        isRevealed && !isCorrect ? 'opacity-40 grayscale-[40%]' : ''
                      } ${isCorrect ? 'ring-4 ring-[#0D2818] scale-[1.02]' : ''}`}
                    >
                      {/* Top Header: Badge + Live Votes on reveal */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-black text-white border-[2px] border-white/60 flex items-center justify-center font-black text-lg sm:text-xl shrink-0 shadow-[1.5px_1.5px_0_0_#000]">
                          {theme.letter}
                        </span>

                        {isRevealed && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-base sm:text-lg bg-black text-white px-2.5 py-1 rounded-lg shadow-[1px_1px_0_0_#000]">
                              {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                            </span>
                            {isCorrect && (
                              <CheckCircle2 className="w-7 h-7 text-white drop-shadow-[2px_2px_0_#000]" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Prominent High-Resolution Image Container */}
                      {opt.mediaUrl ? (
                        <div className="w-full h-40 sm:h-52 md:h-64 bg-white rounded-xl border-2 border-black/40 p-2 sm:p-3 flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                          <img
                            src={opt.mediaUrl}
                            alt={opt.text || `Option ${theme.letter}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-40 sm:h-52 md:h-64 flex items-center justify-center">
                          <span className="font-black text-lg sm:text-2xl text-center leading-snug">
                            {opt.text}
                          </span>
                        </div>
                      )}

                      {/* Option Text Label below image if provided */}
                      {opt.mediaUrl && opt.text && (
                        <span className="font-black text-base sm:text-xl text-center leading-snug mt-2.5 block truncate">
                          {opt.text}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Original Text-Only Horizontal Cards Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeQuestion.options.map((opt, idx) => {
                  const colors = [
                    { bg: 'bg-[#EA4335]', text: 'text-white', letter: 'A', id: 'opt_1' },
                    { bg: 'bg-[#4285F4]', text: 'text-white', letter: 'B', id: 'opt_2' },
                    { bg: 'bg-[#FBBC05]', text: 'text-black', letter: 'C', id: 'opt_3' },
                    { bg: 'bg-[#34A853]', text: 'text-white', letter: 'D', id: 'opt_4' },
                  ];
                  const theme = colors[idx % 4];
                  const isCorrect = isRevealed && resultsBreakdown?.correctOptionId === opt.id;
                  const voteCount = isRevealed ? resultsBreakdown?.[opt.id] || 0 : null;

                  return (
                    <div
                      key={opt.id}
                      className={`p-4 sm:p-5 rounded-2xl border-[3px] border-black shadow-[4px_4px_0_0_#000] flex items-center justify-between gap-4 transition-all ${theme.bg
                        } ${theme.text} ${isRevealed && !isCorrect ? 'opacity-40 grayscale-[40%]' : ''
                        } ${isCorrect ? 'ring-4 ring-[#0D2818] scale-[1.02]' : ''
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-black text-white border-[2px] border-white/60 flex items-center justify-center font-black text-lg shrink-0 shadow-[1px_1px_0_0_#000]">
                          {theme.letter}
                        </span>
                        <span className="font-black text-base sm:text-xl leading-snug truncate">
                          {opt.text}
                        </span>
                      </div>

                      {isRevealed && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-black text-lg bg-black text-white px-2.5 py-1 rounded-lg">
                            {voteCount}
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="w-7 h-7 text-white drop-shadow-[2px_2px_0_#000]" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explanation Note on Reveal */}
            {isRevealed && activeQuestion.explanation && (
              <div className="p-4 bg-[#EEFBF3] border-[2.5px] border-[#34A853] rounded-xl text-black font-semibold text-sm shadow-[3px_3px_0_0_#34A853] flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-[#34A853] shrink-0" />
                <div>
                  <span className="font-black uppercase text-xs text-[#34A853] block">Tech Breakdown:</span>
                  <span>{activeQuestion.explanation}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: LEADERBOARD / PODIUM */}
        {(isLeaderboard || isGameOver) && (
          <div className="w-full flex flex-col items-center gap-6 animate-fade-in max-w-4xl">
            <Badge color={isGameOver ? 'red' : 'yellow'} size="lg" className="animate-pulse">
              <Trophy className="w-5 h-5 inline mr-1.5" />
              {isGameOver ? '🏆 Grand Finale Champion Podium' : 'Live Stage Standings'}
            </Badge>

            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-center text-black">
              {isGameOver ? 'DevFest 2026 Stage Winners' : `Top Scorers — Question ${state.currentQuestionIndex + 1}`}
            </h2>

            {/* Top 5 Roster Cards */}
            <div className="w-full flex flex-col gap-3">
              {leaderboard.slice(0, 5).map((entry) => {
                const isFirst = entry.rank === 1;
                return (
                  <div
                    key={entry.rank}
                    className={`p-4 sm:p-5 rounded-2xl border-[3px] border-black flex items-center justify-between gap-4 transition-all ${isFirst
                      ? 'bg-[#FBBC05] text-black shadow-[6px_6px_0_0_#000] scale-[1.02]'
                      : 'bg-white text-black shadow-[3px_3px_0_0_#000]'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-black text-xl shrink-0">
                        {entry.rank}
                      </div>
                      <div>
                        <span className="font-black text-lg sm:text-2xl text-black block leading-none">
                          {entry.displayName}
                        </span>
                        <span className="text-xs font-bold text-black/60">
                          {entry.correctCount} Correct Answers
                          {entry.totalTimeMs > 0 && ` • ${(entry.totalTimeMs / 1000).toFixed(1)}s total`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-2xl sm:text-3xl text-black">
                        {entry.totalScore?.toLocaleString()}
                      </span>
                      <span className="text-xs font-black uppercase text-black/60">PTS</span>
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <div className="p-8 text-center bg-white border-[2px] border-black rounded-xl">
                  <span className="text-sm font-bold text-black/60">
                    No scores recorded yet for this session.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="flex items-center justify-between text-[10px] sm:text-xs font-black uppercase tracking-wider text-black/50 border-t border-black/10 pt-2">
        <span>Google Developer Groups • GDG Ranchi</span>
        <span>Radisson Blu Auditorium LED Display</span>
      </footer>

      {/* Latecomer QR Code Modal (Accessible anytime via Header "Join QR" button) */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-8 bg-white border-[3.5px] border-black rounded-3xl shadow-[8px_8px_0_0_#000] flex flex-col items-center gap-4 max-w-sm w-full text-center relative"
          >
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border-[2px] border-black bg-white hover:bg-[#FFF5F5] flex items-center justify-center text-black shadow-[2px_2px_0_0_#000] cursor-pointer"
              aria-label="Close QR popup"
            >
              <X className="w-4 h-4" />
            </button>

            <Badge color="yellow" size="sm">
              <Sparkles className="w-3 h-3 inline mr-1" /> Quick Join Battle
            </Badge>

            <h2 className="text-xl font-black uppercase tracking-tight text-black">
              Scan with Phone Camera
            </h2>

            <div className="p-3 bg-white border-[2.5px] border-black rounded-2xl shadow-[4px_4px_0_0_#000]">
              <QRCodeSVG
                value={joinUrl}
                size={220}
                level="M"
                includeMargin={false}
                className="w-[200px] h-[200px]"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-black/60 block">Audience Join PIN:</span>
              <span className="font-mono font-black text-4xl text-[#4285F4] tracking-widest">{roomCode}</span>
            </div>

            <p className="text-[11px] font-bold text-black/60">
              Or visit <span className="font-mono font-black text-black underline">{typeof window !== 'undefined' ? window.location.host : ''}/play</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
