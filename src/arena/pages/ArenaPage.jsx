import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Podium } from '../components/Podium';
import { Leaderboard } from '../components/Leaderboard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../services/api/client';
import { cn } from '../../lib/utils';
import {
  Trophy,
  Crown,
  Medal,
  Radio,
  ExternalLink,
  Search,
  Sparkles,
  Zap,
  Target,
  Users,
  Maximize2,
  Minimize2,
  RefreshCw,
  CheckCircle,
  Clock,
  ArrowRight,
  Flame,
} from 'lucide-react';

export function ArenaPage() {
  const { user, isAuthenticated } = useAuth();

  // Mode: 'match' (Live & Match Battles) vs 'overall' (DevFest Grand Champions)
  const [viewMode, setViewMode] = useState('match');

  // Summary data from backend
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Match View state
  const [selectedGameId, setSelectedGameId] = useState(null);
  const selectedGameIdRef = useRef(null);
  const [matchResults, setMatchResults] = useState(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);

  useEffect(() => {
    selectedGameIdRef.current = selectedGameId;
  }, [selectedGameId]);

  // Live Room state (if active)
  const [liveRoomCode, setLiveRoomCode] = useState(null);
  const [liveRoomState, setLiveRoomState] = useState(null);

  // Search & Track Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('all');

  // Stage Projection Mode
  const [isProjectionMode, setIsProjectionMode] = useState(false);

  // Fetch Summary Data (Overall Standings, Games, Active Rooms)
  const loadSummaryData = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const res = await apiClient('/games/leaderboard/summary');
      if (res?.ok && res.data) {
        setSummaryData(res.data);

        // Only auto-select initially if user hasn't selected any game yet
        if (!selectedGameIdRef.current) {
          const activeRooms = res.data.activeRooms || [];
          if (activeRooms.length > 0) {
            const live = activeRooms[0];
            setLiveRoomCode(live.roomCode);
            setSelectedGameId(live.gameDefinitionId);
            selectedGameIdRef.current = live.gameDefinitionId;
          } else if (res.data.games?.length > 0) {
            // Prioritize an ended or played game, fallback to first
            const played = res.data.games.find((g) => g.status === 'ENDED') || res.data.games[0];
            setSelectedGameId(played.id);
            selectedGameIdRef.current = played.id;
          }
        } else {
          // If user has already selected a game, update liveRoomCode if their selected game is currently live
          const activeRooms = res.data.activeRooms || [];
          const currentLive = activeRooms.find((r) => r.gameDefinitionId === selectedGameIdRef.current);
          if (currentLive) {
            setLiveRoomCode(currentLive.roomCode);
          }
        }
      }
    } catch (err) {
      console.warn('Leaderboard summary fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummaryData();
    const interval = setInterval(loadSummaryData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Match Results when selectedGameId changes
  useEffect(() => {
    if (!selectedGameId) return;
    let ignore = false;

    async function loadMatch() {
      setIsLoadingMatch(true);
      try {
        const res = await apiClient(`/games/${selectedGameId}/results`);
        if (!ignore && res?.ok && res.data) {
          setMatchResults(res.data);
        }
      } catch (err) {
        console.warn('Match results fetch error:', err);
      } finally {
        if (!ignore) setIsLoadingMatch(false);
      }
    }

    loadMatch();
    return () => {
      ignore = true;
    };
  }, [selectedGameId]);

  // Stream or Poll active live room state
  useEffect(() => {
    if (!liveRoomCode) return;
    let ignore = false;

    async function fetchLiveRoomState() {
      try {
        const res = await apiClient(`/rooms/${liveRoomCode}/state`);
        if (!ignore && res?.ok && res.state) {
          setLiveRoomState(res.state);
        }
      } catch {
        // ignore
      }
    }

    fetchLiveRoomState();
    const interval = setInterval(fetchLiveRoomState, 2000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [liveRoomCode]);

  // Handle ESC key to exit projection mode
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isProjectionMode) {
        setIsProjectionMode(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectionMode]);

  // Derived datasets
  const games = summaryData?.games || [];
  const activeRooms = summaryData?.activeRooms || [];
  const overallStandings = summaryData?.overall?.standings || [];
  const isMatchLive = activeRooms.some((r) => r.gameDefinitionId === selectedGameId);
  const selectedGame = games.find((g) => g.id === selectedGameId);
  const hasGameBeenPlayed = Boolean(isMatchLive || selectedGame?.status === 'ENDED');

  // Participants for current view
  let rawParticipants = [];
  let currentTitle = 'DevFest Standings';
  let currentTrackName = 'All Tracks';

  if (viewMode === 'overall') {
    rawParticipants = overallStandings;
    currentTitle = 'DevFest Grand Champions Roster';
    currentTrackName = 'Cumulative Conference Standings';
  } else {
    // Match view: if match is live, use liveRoomState leaderboard; otherwise use matchResults
    if (isMatchLive && liveRoomState?.leaderboard) {
      rawParticipants = (liveRoomState.leaderboard || []).map((l, idx) => ({
        rank: l.rank || idx + 1,
        attendeeId: l.attendeeId || null,
        displayName: l.displayName || 'Player',
        totalScore: l.totalScore || 0,
        correctCount: l.correctCount || 0,
        totalTimeMs: l.totalTimeMs || 0,
        fastestTimeMs: l.fastestTimeMs || 0,
        organization: l.organization || '',
      }));
    } else if (matchResults?.leaderboard) {
      rawParticipants = matchResults.leaderboard;
    }
    currentTitle = selectedGame?.title || 'Match Standings';
    currentTrackName = selectedGame?.trackTarget || 'All Tracks';
  }

  // Filter participants by search query and track
  const filteredParticipants = rawParticipants.filter((p) => {
    const name = (p.displayName || p.name || '').toLowerCase();
    const org = (p.organization || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery = !query || name.includes(query) || org.includes(query);
    const matchesTrack =
      selectedTrack === 'all' ||
      !p.track ||
      p.track === 'all' ||
      p.track.toLowerCase() === selectedTrack.toLowerCase();

    return matchesQuery && matchesTrack;
  });

  const topThree = filteredParticipants.slice(0, 3);
  const hasResults = filteredParticipants.length > 0;

  // Find logged in attendee standing
  const myStanding = isAuthenticated && user
    ? rawParticipants.find(
        (p) =>
          (p.attendeeId && (p.attendeeId === user.id || p.attendeeId === user.attendeeId)) ||
          (p.displayName && p.displayName.toLowerCase() === user.displayName?.toLowerCase())
      )
    : null;

  // Podium gap calculation
  const thirdPlaceScore = topThree[2]?.totalScore ?? topThree[2]?.score ?? 0;
  const myScore = myStanding?.totalScore ?? myStanding?.score ?? 0;
  const gapToPodium = myStanding ? Math.max(0, thirdPlaceScore - myScore + 1) : null;

  return (
    <div
      className={cn(
        'w-full flex flex-col flex-1 transition-all',
        isProjectionMode
          ? 'fixed inset-0 z-50 bg-[#FFFDF6] overflow-y-auto p-4 sm:p-8'
          : 'max-w-[1360px] mx-auto px-3 sm:px-6 py-4 sm:py-8'
      )}
    >
      {/* ========================================================= */}
      {/* 1. HEADER & CONTROL DECK                                  */}
      {/* ========================================================= */}
      <header className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA4335] text-white border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000]">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Leaderboard
              </span>
              <Badge color="yellow" size="sm">
                Radisson Blu, Ranchi
              </Badge>
              <Badge color="green" size="sm">
                Official Arena Results
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-black uppercase tracking-tight">
              DevFest Ranchi 2026 <span className="text-[#4285F4]">Leaderboard</span>
            </h1>
          </div>

          {/* Action Buttons: Projection Mode + Refresh */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsProjectionMode((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[2.5px] border-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[3px_3px_0_0_#000]',
                isProjectionMode
                  ? 'bg-[#EA4335] text-white hover:bg-black'
                  : 'bg-[#FBBC05] text-black hover:bg-[#F9AB00]'
              )}
              title="Toggle Auditorium Projector Fullscreen View"
            >
              {isProjectionMode ? (
                <>
                  <Minimize2 className="w-4 h-4" /> Exit Projection (ESC)
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" /> Stage Projection Mode
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => loadSummaryData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-[2px] border-black bg-white hover:bg-[#FFF8E7] text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000] cursor-pointer transition-all"
              title="Refresh Leaderboard Data"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DUAL MODE SWITCHER (MATCH BATTLES vs GRAND CHAMPIONS)    */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between border-b-2 border-black/15 pb-3 gap-3 flex-wrap">
          <div className="inline-flex p-1.5 bg-[#FFFBF0] border-[2.5px] border-black rounded-2xl shadow-[3px_3px_0_0_#000] gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('match')}
              className={cn(
                'px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2',
                viewMode === 'match'
                  ? 'bg-black text-[#FBBC05] border-[2px] border-black shadow-[2px_2px_0_0_#FBBC05]'
                  : 'bg-transparent text-black/70 hover:text-black hover:bg-black/5'
              )}
            >
              <Flame className="w-4 h-4 text-[#EA4335]" />
              <span>Live & Match Battles</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('overall')}
              className={cn(
                'px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2',
                viewMode === 'overall'
                  ? 'bg-[#4285F4] text-white border-[2px] border-black shadow-[2px_2px_0_0_#000]'
                  : 'bg-transparent text-black/70 hover:text-black hover:bg-black/5'
              )}
            >
              <Crown className="w-4 h-4 text-[#FBBC05]" />
              <span>DevFest Grand Champions</span>
            </button>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2 text-xs font-bold text-black/70">
            <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-pulse" />
            <span>Server Authoritative • Live Sync</span>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. ATTENDEE PERSONAL SPOTLIGHT (IF AUTHENTICATED)         */}
      {/* ========================================================= */}
      {isAuthenticated && user && (
        <div className="mb-6 p-4 sm:p-5 bg-[#EEFBF3] border-[2.5px] border-[#34A853] rounded-2xl shadow-[4px_4px_0_0_#34A853] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border-[2px] border-black flex items-center justify-center text-[#34A853] font-black text-xl shadow-[2px_2px_0_0_#000] shrink-0">
              {myStanding?.rank ? `#${myStanding.rank}` : '✓'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-black">
                  {user.displayName}
                </span>
                <span className="font-mono text-xs text-[#34A853] bg-white px-2 py-0.5 rounded border border-black/30 font-bold uppercase">
                  Verified Builder
                </span>
                {myStanding?.rank && myStanding.rank <= 3 && (
                  <span className="px-2 py-0.5 bg-[#FBBC05] text-black font-black text-[10px] uppercase rounded-full border border-black shadow-[1px_1px_0_0_#000]">
                    👑 On Podium
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-black/70 mt-0.5">
                {myStanding
                  ? `Your official standing in ${viewMode === 'overall' ? 'overall tournament' : (selectedGame?.title || 'this match')}: Rank #${myStanding.rank}`
                  : 'You have not submitted accepted answers for this round yet.'}
              </p>
            </div>
          </div>

          {myStanding && (
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-black/60 block">Your Score</span>
                <span className="font-mono font-black text-lg sm:text-xl text-[#4285F4]">
                  {(myStanding.totalScore ?? myStanding.score ?? 0).toLocaleString()} pts
                </span>
              </div>
              {gapToPodium > 0 && myStanding.rank > 3 && (
                <div className="text-right pl-3 border-l-2 border-black/10">
                  <span className="text-[10px] font-black uppercase text-[#EA4335] block">To 3rd Podium</span>
                  <span className="font-mono font-black text-sm sm:text-base text-black">
                    +{gapToPodium} pts
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ACTIVE AUDITORIUM BATTLE BANNER                        */}
      {/* ========================================================= */}
      {activeRooms.length > 0 && (
        <section className="bg-[#EA4335] text-white border-[3px] border-black rounded-[22px] p-4 sm:p-5 mb-6 shadow-[5px_5px_0_0_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border-[2px] border-black flex items-center justify-center text-[#EA4335] shadow-[2px_2px_0_0_#000] shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black text-[#FBBC05] px-2.5 py-0.5 rounded-full border border-black">
                  LIVE IN MAIN AUDITORIUM
                </span>
                <span className="text-xs font-bold text-white/90">
                  Active Match In Session
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-0.5">
                {activeRooms[0].gameTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setViewMode('match');
                setSelectedGameId(activeRooms[0].gameDefinitionId);
                setLiveRoomCode(activeRooms[0].roomCode);
              }}
              className="px-3 py-1.5 bg-[#FBBC05] hover:bg-[#F9AB00] text-black border-[2px] border-black rounded-xl font-black text-xs uppercase shadow-[2px_2px_0_0_#000] transition-all cursor-pointer"
            >
              Watch Live Standings
            </button>
            <Link
              to="/games"
              className="px-3 py-1.5 bg-white hover:bg-[#FFF8E7] text-black border-[2px] border-black rounded-xl font-black text-xs uppercase shadow-[2px_2px_0_0_#000] flex items-center gap-1 transition-all"
            >
              Enter Stage PIN <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 4. VIEW MODE 1: LIVE & MATCH BATTLES                      */}
      {/* ========================================================= */}
      {viewMode === 'match' && (
        <div className="flex flex-col gap-6">
          {/* Real Match Selector Horizontal Strip */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-black/60 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#4285F4]" /> Select Tournament Quiz Round:
            </span>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 horizontal-scroll-touch">
              {games.map((g) => {
                const isSelected = selectedGameId === g.id;
                const isLiveNow = activeRooms.some((r) => r.gameDefinitionId === g.id);
                const isEnded = g.status === 'ENDED';

                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGameId(g.id);
                      selectedGameIdRef.current = g.id;
                      if (isLiveNow) {
                        const room = activeRooms.find((r) => r.gameDefinitionId === g.id);
                        if (room) setLiveRoomCode(room.roomCode);
                      } else {
                        setLiveRoomCode(null);
                      }
                    }}
                    className={cn(
                      'px-4 py-2.5 rounded-2xl border-[2.5px] border-black text-left flex flex-col gap-1 shrink-0 transition-all cursor-pointer min-w-[200px] max-w-[280px]',
                      isSelected
                        ? 'bg-black text-white shadow-[3px_3px_0_0_#FBBC05] -translate-y-0.5'
                        : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-70 truncate">
                        {g.trackTarget}
                      </span>
                      {isLiveNow ? (
                        <span className="px-1.5 py-0.2 bg-[#EA4335] text-white font-black text-[9px] rounded-full uppercase animate-pulse">
                          LIVE NOW
                        </span>
                      ) : isEnded ? (
                        <span className="px-1.5 py-0.2 bg-black text-[#FBBC05] border border-[#FBBC05]/60 text-[9px] font-black rounded uppercase">
                          ✓ RESULTS READY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 bg-[#FFF8E7] text-black/70 border border-black/30 font-bold text-[9px] rounded uppercase">
                          ⏳ UPCOMING
                        </span>
                      )}
                    </div>
                    <span className="font-black text-xs sm:text-sm truncate w-full">
                      {g.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Match Header Card */}
          {selectedGame && (
            <div className="p-4 sm:p-5 bg-white border-[2.5px] border-black rounded-2xl shadow-[4px_4px_0_0_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge color="blue" size="sm">
                    {selectedGame.trackTarget}
                  </Badge>
                  <span className="text-xs font-bold text-black/60 font-mono">
                    {selectedGame.totalQuestions} Questions • Synchronized Stage Clock
                  </span>
                  {selectedGame.status === 'ENDED' && (
                    <Badge color="green" size="sm">
                      Official Tournament Results
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-black uppercase">
                  {selectedGame.title}
                </h2>
                <p className="text-xs text-black/70 font-semibold mt-0.5">
                  {selectedGame.description}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-black/60 block">Participants</span>
                  <span className="font-mono font-black text-lg text-black">
                    {hasGameBeenPlayed ? filteredParticipants.length : '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Display: Upcoming vs Played/Results */}
          {!hasGameBeenPlayed ? (
            <div className="py-12 sm:py-16 px-6 text-center border-[3px] border-black rounded-[24px] bg-white shadow-[6px_6px_0_0_#000] flex flex-col items-center max-w-xl mx-auto my-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-[#FBBC05] shadow-[3px_3px_0_0_#000] mb-4">
                <Clock className="w-8 h-8 text-black animate-pulse" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FBBC05] text-black border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000] mb-2">
                ⏳ Round Not Started Yet
              </span>
              <h3 className="text-2xl sm:text-3xl font-black uppercase text-black tracking-tight mb-2">
                Result to be Announced Soon
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-black/70 leading-relaxed max-w-md mb-6">
                "{selectedGame?.title}" has not been played on stage yet. Once the auditorium host launches this challenge and participants submit their answers, the live podium and official standings will be published here!
              </p>
              <div className="p-3 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black/80 flex items-center gap-2 shadow-[2px_2px_0_0_#000]">
                <Radio className="w-4 h-4 text-[#EA4335] animate-pulse shrink-0" />
                <span>Auditorium stage screens will display the 6-character room PIN when this challenge begins.</span>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="py-12 px-6 text-center border-[2.5px] border-black rounded-2xl bg-[#FFFBF0] shadow-[3px_3px_0_0_#000] max-w-md mx-auto my-4">
              <Sparkles className="w-10 h-10 text-[#FBBC05] mx-auto mb-2" />
              <h4 className="text-lg font-black uppercase text-black mb-1">Results Finalizing</h4>
              <p className="text-xs font-semibold text-black/70">
                No participant answers were recorded for "{selectedGame?.title}". Official standings will refresh automatically.
              </p>
            </div>
          ) : (
            <>
              {/* 3-Step Physical Podium */}
              <Podium
                topThree={topThree}
                scoreUnit="pts"
                trackName={selectedGame?.title || 'DevFest Round'}
              />

              {/* Standings Filter Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative min-w-[240px] flex-1 max-w-md">
                  <Search className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search attendee name or ticket code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-semibold text-black placeholder:text-black/40 shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
                  />
                </div>

                {/* Track Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All Tracks' },
                    { id: 'flagship-dev', label: 'Flagship Dev' },
                    { id: 'beginner-track', label: 'Beginner' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTrack(t.id)}
                      className={cn(
                        'px-3 py-1 rounded-full border-[1.5px] border-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap',
                        selectedTrack === t.id
                          ? 'bg-black text-white shadow-[2px_2px_0_0_#4285F4]'
                          : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[1.5px_1.5px_0_0_#000]'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Standings Table */}
              <Leaderboard
                participants={filteredParticipants}
                scoreUnit="pts"
                activityTitle={selectedGame?.title || 'Match'}
                trackName={selectedGame?.trackTarget || 'All Tracks'}
                highlightId={user?.id || user?.attendeeId}
                highlightName={user?.displayName}
              />
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. VIEW MODE 2: DEVFEST GRAND CHAMPIONS (CUMULATIVE)      */}
      {/* ========================================================= */}
      {viewMode === 'overall' && (
        <div className="flex flex-col gap-6">
          {/* Grand Champions Hero Banner */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-[#FFFDF6] via-[#FFF8E7] to-[#FFF4C2] border-[3px] border-black rounded-2xl shadow-[6px_6px_0_0_#000] relative overflow-hidden">
            <div className="max-w-2xl relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBBC05] text-black border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000] mb-2">
                👑 Conference Championship Standings
              </span>
              <h2 className="text-2xl sm:text-4xl font-black uppercase text-black tracking-tight">
                DevFest Ranchi 2026 Grand Champions
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-black/70 mt-1.5 leading-relaxed">
                Cumulative tournament points aggregated across all quiz rounds and stage challenges. The ultimate leader crowned at the valedictory session will claim the DevFest 2026 Grand Championship Trophy!
              </p>
            </div>

            {/* Overall Stats Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 relative z-10 max-w-lg">
              <div className="p-3 bg-white border-[2px] border-black rounded-xl text-left shadow-[2px_2px_0_0_#000]">
                <span className="text-[10px] font-black uppercase text-black/60 block">Ranked Builders</span>
                <span className="font-mono font-black text-xl text-black">
                  {overallStandings.length}
                </span>
              </div>
              <div className="p-3 bg-white border-[2px] border-black rounded-xl text-left shadow-[2px_2px_0_0_#000]">
                <span className="text-[10px] font-black uppercase text-black/60 block">Rounds Counted</span>
                <span className="font-mono font-black text-xl text-[#4285F4]">
                  {games.filter((g) => g.status === 'ENDED').length || 1}
                </span>
              </div>
              <div className="p-3 bg-white border-[2px] border-black rounded-xl text-left shadow-[2px_2px_0_0_#000] col-span-2 sm:col-span-1">
                <span className="text-[10px] font-black uppercase text-black/60 block">Top Score</span>
                <span className="font-mono font-black text-xl text-[#34A853]">
                  {overallStandings[0]?.totalScore?.toLocaleString() || '0'} pts
                </span>
              </div>
            </div>
          </div>

          {/* Grand Champions 3-Step Podium */}
          <Podium
            topThree={topThree}
            scoreUnit="pts"
            trackName="DevFest Grand Championship"
          />

          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search builders by name, college, or ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-semibold text-black placeholder:text-black/40 shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-black/70">
              <Trophy className="w-4 h-4 text-[#FBBC05]" />
              <span>{filteredParticipants.length} builders competing for podium</span>
            </div>
          </div>

          {/* Cumulative Grand Champions Table */}
          <Leaderboard
            participants={filteredParticipants}
            scoreUnit="pts"
            activityTitle="DevFest Grand Champions"
            trackName="Cumulative Roster"
            isOverall={true}
            highlightId={user?.id || user?.attendeeId}
            highlightName={user?.displayName}
          />
        </div>
      )}
    </div>
  );
}
