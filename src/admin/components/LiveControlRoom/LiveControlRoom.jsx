import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../services/api/client';
import {
  Radio,
  Play,
  Pause,
  Lock,
  BarChart3,
  Trophy,
  ArrowRight,
  ExternalLink,
  Users,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Timer,
  UserCheck,
  AlertCircle,
  Ban,
  Building2,
  Search,
  Filter,
  RotateCcw,
  AlertTriangle,
  Copy,
  Trash2,
  X,
} from 'lucide-react';

import { DEVFEST_HALLS, DEFAULT_HALL } from '../../../constants/eventConfig';
export { DEVFEST_HALLS };

export function LiveControlRoom({ adminKey, games = [], initialRoomCode = '' }) {
  const [activeRooms, setActiveRooms] = useState([]);
  const [selectedRoomCode, setSelectedRoomCode] = useState(
    () => initialRoomCode || new URLSearchParams(window.location.search).get('room') || ''
  );
  const [roomState, setRoomState] = useState(null);
  const [roomAttendees, setRoomAttendees] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryFilter, setTelemetryFilter] = useState('all');
  const [telemetrySearch, setTelemetrySearch] = useState('');
  const [hallFilter, setHallFilter] = useState('all');
  const [scheduledTimeRemaining, setScheduledTimeRemaining] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartHall, setRestartHall] = useState('Conference Hall');

  const navigate = useNavigate();

  const handleRestartRoomGame = async () => {
    if (!roomState?.gameDefinitionId) return;
    setIsRestarting(true);
    try {
      const res = await apiClient(`/games/${roomState.gameDefinitionId}/restart`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({
          hallName: restartHall || roomState.hallName || 'Conference Hall',
          trackTarget: roomState.trackTarget || 'all',
        }),
      });

      if (res?.ok && res.roomCode) {
        setShowRestartModal(false);
        setSelectedRoomCode(res.roomCode);
        await fetchRooms();
      } else {
        alert(res?.error?.message || 'Failed to restart battle match.');
      }
    } catch (err) {
      alert(err?.message || 'Network error while attempting to restart match.');
    } finally {
      setIsRestarting(false);
    }
  };

  // Available games ready for launch
  const readyGames = games.filter((g) => g.status === 'READY');

  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setSelectedRoomCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  // Sync selected room to URL query param so multi-anchors can bookmark or refresh on their room
  useEffect(() => {
    if (selectedRoomCode) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('room') !== selectedRoomCode) {
        url.searchParams.set('room', selectedRoomCode);
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, [selectedRoomCode]);

  const handleCopyAnchorLink = () => {
    if (!roomState?.roomCode) return;
    const url = `${window.location.origin}/admin?room=${roomState.roomCode}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };
  const copyRoomLink = handleCopyAnchorLink;

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiClient('/rooms', {
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        const rooms = res.data || [];
        setActiveRooms(rooms);
        setSelectedRoomCode((curr) => {
          if (rooms.length === 0) {
            setRoomState(null);
            try {
              const url = new URL(window.location.href);
              if (url.searchParams.has('room')) {
                url.searchParams.delete('room');
                window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
              }
            } catch {
              // ignore
            }
            return '';
          }
          if (!curr && rooms.length > 0) return rooms[0].roomCode;
          if (curr && !rooms.some((r) => r.roomCode === curr)) {
            return rooms[0].roomCode;
          }
          return curr;
        });
      }
    } catch {
      // ignore
    }
  }, [adminKey]);

  // Periodic active rooms polling for multi-admin sync across different machines
  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 4000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCloseRoom = async (roomCode, gameTitle) => {
    if (
      !window.confirm(
        `Are you sure you want to discard / close room "${roomCode}" (${gameTitle || 'Quiz'})?\n\nThis will remove it from active stage battles and close stage connections.`
      )
    ) {
      return;
    }
    try {
      await apiClient(`/rooms/${roomCode}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      }).catch(() => ({ ok: true }));

      setActionMsg(`Room ${roomCode} closed successfully.`);
      setTimeout(() => setActionMsg(null), 3000);

      setActiveRooms((prev) => {
        const remaining = prev.filter((r) => r.roomCode !== roomCode);
        const nextCode = remaining.length > 0 ? remaining[0].roomCode : '';
        setSelectedRoomCode(nextCode);
        if (!nextCode) setRoomState(null);
        return remaining;
      });

      // Clear ?room from URL so refresh does not reload this closed room
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('room') === roomCode) {
          url.searchParams.delete('room');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch {
        // ignore
      }
    } catch (err) {
      alert(`Failed to close room: ${err.message}`);
    }
  };

  const fetchRoomState = useCallback(async () => {
    if (!selectedRoomCode) return;
    try {
      const res = await apiClient(`/rooms/${selectedRoomCode}/state`);
      if (res?.ok && res?.state) {
        setRoomState(res.state);
      }
      const attRes = await apiClient(`/rooms/${selectedRoomCode}/attendees`, {
        headers: { 'x-admin-key': adminKey },
      });
      if (attRes?.ok && attRes.data) {
        setRoomAttendees(attRes.data);
      }
      const teleRes = await apiClient(`/rooms/${selectedRoomCode}/telemetry`, {
        headers: { 'x-admin-key': adminKey },
      });
      if (teleRes?.ok && teleRes.data) {
        setTelemetry(teleRes.data);
      }
    } catch {
      // ignore
    }
  }, [adminKey, selectedRoomCode]);

  useEffect(() => {
    if (!selectedRoomCode) return;
    let ignore = false;

    async function pollState() {
      try {
        const res = await apiClient(`/rooms/${selectedRoomCode}/state`);
        if (!ignore && res?.ok && res.state) {
          setRoomState(res.state);
        }
        const attRes = await apiClient(`/rooms/${selectedRoomCode}/attendees`, {
          headers: { 'x-admin-key': adminKey },
        });
        if (!ignore && attRes?.ok && attRes.data) {
          setRoomAttendees(attRes.data);
        }
        const teleRes = await apiClient(`/rooms/${selectedRoomCode}/telemetry`, {
          headers: { 'x-admin-key': adminKey },
        });
        if (!ignore && teleRes?.ok && teleRes.data) {
          setTelemetry(teleRes.data);
        }
      } catch {
        // ignore
      }
    }

    pollState();
    const interval = setInterval(pollState, 1500);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [adminKey, selectedRoomCode]);

  // Scheduled Start Countdown Calculation
  useEffect(() => {
    if (!roomState?.scheduledStartTime || roomState.status !== 'LOBBY') {
      setScheduledTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((roomState.scheduledStartTime - Date.now()) / 1000));
      setScheduledTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [roomState?.scheduledStartTime, roomState?.status]);

  const handleCreateRoom = async () => {
    if (!selectedGameId) {
      alert('Please select a published quiz to create a battle room.');
      return;
    }

    const selectedGame = readyGames.find((g) => g.id === selectedGameId);
    const gameHall = selectedGame?.hall_name || selectedGame?.hallName || 'Conference Hall';
    const gameTrack = selectedGame?.track_target || selectedGame?.trackTarget || 'all';

    // Check if an active room already exists for this quiz
    const existing = activeRooms.find(
      (r) =>
        r.gameDefinitionId === selectedGameId &&
        r.status !== 'GAME_OVER' &&
        r.status !== 'ARCHIVED'
    );
    if (existing) {
      setSelectedRoomCode(existing.roomCode);
      setActionMsg(`Switched to active room ${existing.roomCode} for "${existing.gameTitle}".`);
      setTimeout(() => setActionMsg(null), 3500);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient('/rooms', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({
          gameDefinitionId: selectedGameId,
          trackTarget: gameTrack,
          hallName: gameHall,
        }),
      });

      if (res?.ok) {
        setActionMsg(`Room ${res.roomCode} launched for "${selectedGame?.title || 'Quiz'}" in ${gameHall}!`);
        setTimeout(() => setActionMsg(null), 3000);
        setSelectedRoomCode(res.roomCode);
        fetchRooms();
      }
    } catch (err) {
      alert(`Room creation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransition = async (targetState, questionIndex) => {
    if (!selectedRoomCode) return;
    try {
      const res = await apiClient(`/rooms/${selectedRoomCode}/transition`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ targetState, questionIndex }),
      });
      if (res?.ok) {
        fetchRoomState();
      }
    } catch (err) {
      alert(`Transition error: ${err.message}`);
    }
  };

  const handlePause = async () => {
    try {
      await apiClient(`/rooms/${selectedRoomCode}/pause`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      fetchRoomState();
    } catch (err) {
      alert(`Pause error: ${err.message}`);
    }
  };

  const handleResume = async () => {
    try {
      await apiClient(`/rooms/${selectedRoomCode}/resume`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      fetchRoomState();
    } catch (err) {
      alert(`Resume error: ${err.message}`);
    }
  };

  const handleAdvance = async () => {
    try {
      await apiClient(`/rooms/${selectedRoomCode}/advance`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      fetchRoomState();
    } catch (err) {
      alert(`Advance error: ${err.message}`);
    }
  };

  const handleFinishMatch = async () => {
    if (!selectedRoomCode) return;
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to FINISH the match now?\n\nThis will lock submissions and calculate final podium standings.'
    );
    if (!confirmed) return;
    handleTransition('GAME_OVER');
  };

  const handleStartBattleNow = async () => {
    if (!selectedRoomCode) return;
    try {
      setIsLoading(true);
      const res = await apiClient(`/rooms/${selectedRoomCode}/transition`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ targetState: 'COUNTDOWN' }),
      });
      if (res?.ok) {
        setActionMsg('🚀 Battle launched! Countdown started across all devices.');
        setTimeout(() => setActionMsg(null), 3000);
        fetchRoomState();
      }
    } catch (err) {
      alert(`Start error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleStart = async (minutes) => {
    if (!selectedRoomCode) return;
    try {
      const scheduledStartTime = minutes ? Date.now() + minutes * 60 * 1000 : null;
      const res = await apiClient(`/rooms/${selectedRoomCode}/schedule`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ scheduledStartTime }),
      });
      if (res?.ok) {
        setActionMsg(
          minutes
            ? `⏰ Auto-start scheduled for +${minutes} minute${minutes > 1 ? 's' : ''}`
            : 'Scheduled auto-start timer cancelled'
        );
        setTimeout(() => setActionMsg(null), 3000);
        fetchRoomState();
      }
    } catch (err) {
      alert(`Schedule error: ${err.message}`);
    }
  };

  const handleKickAttendee = async (uniqueCode) => {
    if (!selectedRoomCode || !uniqueCode) return;
    try {
      await apiClient(`/rooms/${selectedRoomCode}/attendees/${uniqueCode}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      setRoomAttendees((prev) => prev.filter((a) => a.uniqueCode !== uniqueCode));
    } catch (err) {
      alert(`Failed to remove attendee: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Notification */}
      {actionMsg && (
        <div className="p-3 bg-[#EEFBF3] border-[2px] border-[#34A853] rounded-xl text-xs font-black text-[#0D2818] shadow-[2px_2px_0_0_#34A853]">
          ✓ {actionMsg}
        </div>
      )}

      {/* Room Launcher & Selector Bar */}
      <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-5 flex flex-col gap-4">
        {/* Top: Active Room Switcher & Multi-Hall Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#EA4335] animate-pulse" />
            <span className="font-black text-xs uppercase tracking-wider text-black">
              Active Stage Battles ({activeRooms.length}):
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-black/60 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Hall Filter:
            </span>
            <select
              value={hallFilter}
              onChange={(e) => setHallFilter(e.target.value)}
              className="px-2.5 py-1 bg-[#FFFBF0] border-[1.5px] border-black rounded-lg text-xs font-bold text-black focus:outline-none"
            >
              <option value="all">All Halls</option>
              {DEVFEST_HALLS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Room Switcher Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeRooms.filter((r) => hallFilter === 'all' || r.hallName === hallFilter).length === 0 ? (
            <div className="w-full p-4 bg-[#FFFBF0] border-[2px] border-dashed border-black/20 rounded-xl text-center">
              <span className="text-xs font-bold text-black/60 italic">
                No active battles in {hallFilter === 'all' ? 'any hall' : hallFilter}. Go to the "Game Builder" tab to launch a quiz!
              </span>
            </div>
          ) : (
            activeRooms
              .filter((r) => hallFilter === 'all' || r.hallName === hallFilter)
              .map((r) => {
                const isSelected = selectedRoomCode === r.roomCode;
                return (
                  <div key={r.roomCode} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedRoomCode(r.roomCode)}
                      className={`px-3 py-2 rounded-xl border-[2px] border-black text-xs font-black cursor-pointer transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-black text-[#FBBC05] shadow-[2.5px_2.5px_0_0_#FBBC05]'
                          : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
                      }`}
                    >
                      <span className={`font-black text-xs truncate max-w-[140px] sm:max-w-[200px] ${isSelected ? 'text-[#FBBC05]' : 'text-[#EA4335]'}`}>
                        🎮 {r.gameTitle || 'Quiz'}
                      </span>
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-black'}`}>
                        {r.roomCode}
                      </span>
                      <span className="text-[10px] font-semibold opacity-70 hidden sm:inline">
                        • {r.hallName?.replace(/ \(.+\)/, '') || 'Conference Hall'}
                      </span>
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-[#FBBC05]/20 text-[#FBBC05] border border-[#FBBC05]/30' : 'bg-black/10 text-black'
                      }`}>
                        {r.status}
                      </span>
                      {typeof r.attendeeCount === 'number' && (
                        <span className="text-[10px] font-bold opacity-75 flex items-center gap-0.5">
                          <Users className="w-3 h-3 text-[#4285F4]" /> {r.attendeeCount}
                        </span>
                      )}
                    </button>
                    {/* Quick Close / Discard Room Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseRoom(r.roomCode, r.gameTitle);
                      }}
                      title={`Close and remove room ${r.roomCode} (${r.gameTitle})`}
                      className="ml-1 p-1.5 rounded-lg border-[1.5px] border-black/20 hover:border-black bg-white hover:bg-[#EA4335] text-black hover:text-white transition-all text-xs shadow-[1px_1px_0_0_#000] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </Card>

      {/* Prominent Active Session Banner for Multi-Admin Clarity */}
      {roomState && (
        <div className="p-4 bg-[#FFF8E7] border-[2.5px] border-black rounded-2xl shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#4285F4] text-white flex items-center justify-center font-black text-2xl border-[2px] border-black shadow-[2px_2px_0_0_#000] shrink-0">
              🎮
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/60">
                  Currently Controlling Battle
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 bg-[#34A853] text-white rounded-md border border-black shadow-[1px_1px_0_0_#000]">
                  ● {roomState.status}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-black tracking-tight flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-[#EA4335]">{roomState.gameTitle || 'DevFest Tech Quiz'}</span>
                <span className="font-mono text-xs px-2.5 py-0.5 bg-black text-[#FBBC05] rounded-lg border border-black shadow-[1px_1px_0_0_#000]">
                  PIN: {roomState.roomCode}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 bg-white border border-black rounded-lg text-black/80">
                  🏛️ {roomState.hallName || 'Conference Hall'}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 bg-[#4285F4]/10 text-[#4285F4] border border-[#4285F4]/30 rounded-lg">
                  👥 {roomState.attendeeCount || 0} Connected
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Action buttons */}
            <button
              type="button"
              onClick={() => window.open(`/stage/${roomState.roomCode}`, '_blank')}
              className="px-3.5 py-2 bg-white hover:bg-[#FFFBF0] text-black border-[2px] border-black rounded-xl text-xs font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#4285F4]" /> Stage Screen ↗
            </button>
            <button
              type="button"
              onClick={copyRoomLink}
              className="px-3.5 py-2 bg-white hover:bg-[#FFFBF0] text-black border-[2px] border-black rounded-xl text-xs font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#34A853]" /> {copiedLink ? 'Copied Link!' : 'Share Room'}
            </button>
            {roomState.status === 'GAME_OVER' || roomState.isEnded || roomState.status === 'ARCHIVED' ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomCode('');
                  setRoomState(null);
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('room');
                    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
                  } catch {}
                }}
                className="px-3.5 py-2 bg-white hover:bg-gray-100 text-black border-[2px] border-black rounded-xl text-xs font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-black/60" /> Dismiss Concluded Match
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => handleCloseRoom(roomState.roomCode, roomState.gameTitle)}
              className="px-3.5 py-2 bg-[#FDE8E8] hover:bg-[#EA4335] text-[#EA4335] hover:text-white border-[2px] border-black rounded-xl text-xs font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Discard / Close
            </button>
          </div>
        </div>
      )}

      {/* Main Room Cockpit Deck */}
      {roomState ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Live Status & Fast Links (Sticky pinned, no giant empty gap) */}
          <div className="lg:col-span-1">
            <Card surface="white" shadow="lg" border="thick" rounded="xl" className="p-5 flex flex-col gap-4 sticky top-6">
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <Badge color="red" withDot dotColor="red" size="md">
                    LIVE SESSION
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 bg-[#FFF8E7] text-black rounded-lg border border-black shadow-[1px_1px_0_0_#000] truncate max-w-[150px]">
                    🏛️ {roomState.hallName || 'Conference Hall'}
                  </span>
                </div>

                <div className="text-center p-5 bg-[#EEF4FF] border-[2.5px] border-black rounded-2xl shadow-[3px_3px_0_0_#000] mb-3">
                  <span className="text-[10px] font-black uppercase text-black/60 block mb-1">
                    ROOM PIN CODE
                  </span>
                  <span className="font-mono font-black text-5xl tracking-widest text-[#4285F4]">
                    {roomState.roomCode}
                  </span>
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 bg-[#FFF8E7] text-black rounded-lg border border-black shadow-[1px_1px_0_0_#000]">
                      📱 Audience Join Code: {roomState.roomCode}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="p-2 bg-[#FFFBF0] border-[1.5px] border-black rounded-xl text-center">
                    <span className="text-[9px] font-black uppercase text-black/50 block">Connected</span>
                    <span className="font-black text-base text-black flex items-center justify-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#4285F4]" /> {roomState.attendeeCount ?? 0}
                    </span>
                  </div>

                  <div className="p-2 bg-[#FFFBF0] border-[1.5px] border-black rounded-xl text-center">
                    <span className="text-[9px] font-black uppercase text-black/50 block">Answers</span>
                    <span className="font-black text-base text-black flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#34A853]" /> {roomState.submissionCount ?? 0}
                    </span>
                  </div>

                  <div className="p-2 bg-[#FFFBF0] border-[1.5px] border-black rounded-xl text-center">
                    <span className="text-[9px] font-black uppercase text-black/50 block">Pending</span>
                    <span className="font-black text-base text-black flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#FBBC05]" />{' '}
                      {Math.max(0, (roomState.attendeeCount || 0) - (roomState.submissionCount || 0))}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-bold text-black/70 flex flex-col gap-1.5 p-3 bg-black/5 rounded-xl border border-black/10">
                  <div className="flex justify-between">
                    <span>Quiz Title:</span>
                    <span className="font-black text-black truncate max-w-[130px]">
                      {roomState.gameTitle || 'Tech Stage Battle'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phase:</span>
                    <span className="font-black uppercase text-[#4285F4]">{roomState.status || 'UNKNOWN'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Question:</span>
                    <span className="font-black text-black">
                      Q.{(roomState.currentQuestionIndex ?? 0) + 1} of {roomState.totalQuestions ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fast Links & Match Controls */}
              <div className="pt-3 border-t-2 border-black/10 flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  as="a"
                  href={`/stage/${roomState.roomCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full justify-center font-black text-xs shadow-[2px_2px_0_0_#000]"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  <span>Open 16:9 Stage Screen</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyAnchorLink}
                  className="w-full justify-center font-black text-xs bg-white hover:bg-[#FFF8E7] shadow-[1px_1px_0_0_#000]"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-[#4285F4]" />
                  <span>{copiedLink ? '✓ Anchor Direct Link Copied!' : 'Copy Anchor Control Link'}</span>
                </Button>

                {roomState.gameDefinitionId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/games/${roomState.gameDefinitionId}/results`)}
                    className="w-full justify-center font-black text-xs"
                  >
                    <Trophy className="w-3.5 h-3.5 mr-1.5 text-[#FBBC05]" />
                    <span>View Match Results & Leaderboard</span>
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRestartModal(true)}
                  className="w-full justify-center font-black text-xs bg-[#FFF8E7] hover:bg-[#FBBC05]"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  <span>Re-Start / Reset Battle</span>
                </Button>
              </div>
            </Card>
          </div>

          {/* Column 2 & 3: Stage Controls Deck (Dynamic by Room State) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* VIEW A: LOBBY & JOINED MEMBERS WINDOW (BEFORE START) */}
            {roomState.status === 'LOBBY' && (
              <div className="flex flex-col gap-6">
                <Card surface="warmWhite" shadow="lg" border="thick" rounded="xl" className="p-6">
                  <div className="flex items-center justify-between pb-4 mb-5 border-b-2 border-black/10">
                    <div>
                      <h3 className="text-base font-black text-black uppercase tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#4285F4]" />
                        Stage Anchor Lobby & Join Control
                      </h3>
                      <p className="text-xs text-black/60 font-semibold mt-0.5">
                        Attendees are waiting in the lobby on their devices. Launch whenever you are ready!
                      </p>
                    </div>

                    <Button variant="outline" size="sm" onClick={fetchRoomState}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Scheduled Auto-Start Countdown Banner */}
                  {scheduledTimeRemaining !== null && (
                    <div className="mb-5 p-4 bg-[#EEF4FF] border-[2.5px] border-[#4285F4] rounded-2xl flex items-center justify-between shadow-[3px_3px_0_0_#4285F4]">
                      <div className="flex items-center gap-3">
                        <Timer className="w-7 h-7 text-[#4285F4] animate-spin" style={{ animationDuration: '4s' }} />
                        <div>
                          <span className="text-[10px] font-black uppercase text-[#4285F4] block">
                            Auto-Start Timer Active
                          </span>
                          <span className="font-mono font-black text-2xl text-black">
                            T-minus {Math.floor(scheduledTimeRemaining / 60)}:
                            {String(scheduledTimeRemaining % 60).padStart(2, '0')}{' '}
                            <span className="text-xs font-bold text-black/60">({scheduledTimeRemaining}s)</span>
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleScheduleStart(null)}
                        className="bg-white hover:bg-neutral-100"
                      >
                        Cancel Timer
                      </Button>
                    </div>
                  )}

                  {/* Master Anchor Start Button */}
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleStartBattleNow}
                      className="w-full py-5 px-6 rounded-2xl border-[3px] border-black bg-[#34A853] hover:bg-[#2D9247] text-white font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 shadow-[4px_4px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                    >
                      <Play className="w-6 h-6 fill-current" />
                      <span>Start Game Now (Launch All Devices)</span>
                    </button>

                    {/* Auto-Start Schedule Selector */}
                    <div className="p-4 bg-white border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#FBBC05]" /> Schedule Auto-Start Time:
                        </span>
                        <span className="text-[11px] font-bold text-black/50">
                          Counts down on all devices and starts automatically
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleScheduleStart(1)}
                        >
                          +1 Min
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleScheduleStart(2)}
                        >
                          +2 Min
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleScheduleStart(5)}
                        >
                          +5 Min
                        </Button>
                        {roomState.scheduledStartTime && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleScheduleStart(null)}
                            className="text-[#EA4335]"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* JOINED MEMBERS WINDOW / LOBBY ROSTER */}
                <Card surface="white" shadow="lg" border="thick" rounded="xl" className="p-6">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black/10">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#34A853] animate-ping" />
                      <h4 className="text-sm font-black text-black uppercase tracking-tight">
                        Joined Members in Lobby ({roomAttendees.length})
                      </h4>
                    </div>
                    <Badge color="green" size="sm">
                      {roomAttendees.length} Ready to Play
                    </Badge>
                  </div>

                  {roomAttendees.length === 0 ? (
                    <div className="py-12 px-4 text-center border-2 border-dashed border-black/20 rounded-xl bg-[#FFFBF0]">
                      <Users className="w-10 h-10 text-black/30 mx-auto mb-2 animate-bounce" />
                      <p className="font-black text-sm text-black">Waiting for Attendees to Join</p>
                      <p className="text-xs text-black/60 font-semibold max-w-sm mx-auto mt-1">
                        Tell the audience to visit <span className="font-mono font-bold text-black">/play</span> on their phones and enter room PIN{' '}
                        <span className="font-mono font-black text-[#4285F4] bg-[#EEF4FF] px-2 py-0.5 rounded border border-black">
                          {roomState.roomCode}
                        </span>.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {roomAttendees.map((att) => (
                          <div
                            key={att.uniqueCode}
                            className="p-3 bg-[#FFFBF0] border-[2px] border-black rounded-xl flex items-center justify-between shadow-[2px_2px_0_0_#000]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-black text-[#FBBC05] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                                <UserCheck className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 truncate">
                                <span className="font-black text-xs text-black block truncate">
                                  {att.displayName}
                                </span>
                                <span className="font-mono text-[10px] text-black/60 block truncate">
                                  {att.uniqueCode} {att.organization ? `• ${att.organization}` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-black uppercase text-[#34A853] bg-[#EEFBF3] px-2 py-0.5 rounded border border-[#34A853]">
                                Connected
                              </span>
                              <button
                                type="button"
                                onClick={() => handleKickAttendee(att.uniqueCode)}
                                title={`Remove ${att.displayName} from lobby`}
                                className="w-5 h-5 rounded flex items-center justify-center bg-white hover:bg-[#EA4335] hover:text-white text-black/50 border border-black/40 hover:border-black transition-colors cursor-pointer text-[10px] font-black"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* VIEW B: BATTLE CONCLUDED / GAME OVER (WITH RE-START OPTION & RESULTS LINK) */}
            {roomState.status === 'GAME_OVER' && (
              <Card surface="white" shadow="lg" border="thick" rounded="xl" className="p-8 text-center flex flex-col items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-[#FFF8E7] border-[3px] border-black flex items-center justify-center text-[#FBBC05] shadow-[4px_4px_0_0_#000]">
                  <Trophy className="w-10 h-10 text-black" />
                </div>

                <div className="space-y-1">
                  <Badge color="red" size="md">
                    🏁 Battle Concluded
                  </Badge>
                  <h3 className="text-2xl font-black uppercase text-black">
                    Game Marked as Ended
                  </h3>
                  <p className="text-xs font-semibold text-black/70 max-w-md mx-auto leading-relaxed">
                    This battle session has completed. All participant scores and question distribution analytics have been recorded.
                  </p>
                </div>

                {/* Top 5 Leaderboard Snapshot */}
                {roomState.leaderboard && roomState.leaderboard.length > 0 && (
                  <div className="w-full max-w-md border-[2px] border-black rounded-xl overflow-hidden shadow-[3px_3px_0_0_#000] text-left">
                    <div className="bg-black text-white px-4 py-2 font-black text-xs uppercase flex justify-between">
                      <span>Final Champion Podium</span>
                      <span>Score</span>
                    </div>
                    {roomState.leaderboard.slice(0, 5).map((entry, idx) => (
                      <div
                        key={idx}
                        className={`p-3 border-b border-black/10 flex items-center justify-between text-xs font-bold ${
                          idx === 0 ? 'bg-[#FBBC05]' : 'bg-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm">#{entry.rank}</span>
                          <span className="text-black font-black">{entry.displayName}</span>
                        </span>
                        <span className="font-mono font-black text-[#4285F4]">
                          {entry.totalScore} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons: View Full Results Page & Restart Match */}
                <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                  {roomState.gameDefinitionId && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => navigate(`/admin/games/${roomState.gameDefinitionId}/results`)}
                      className="font-black text-xs shadow-[3px_3px_0_0_#000]"
                    >
                      <Trophy className="w-4 h-4 mr-2 text-[#FBBC05]" />
                      Open Full Results & Export Excel (.xlsx)
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowRestartModal(true)}
                    className="font-black text-xs shadow-[3px_3px_0_0_#000] bg-[#FFF8E7] hover:bg-[#FBBC05]"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Re-Start Game (Wipe & Re-play)
                  </Button>
                </div>
              </Card>
            )}

            {/* VIEW C: IN-FLIGHT STAGE DIRECTOR CONSOLE (DURING ACTIVE MATCH) */}
            {roomState.status !== 'LOBBY' && roomState.status !== 'GAME_OVER' && (
              <>
                <Card surface="warmWhite" shadow="lg" border="thick" rounded="xl" className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-[#4285F4] animate-pulse" />
                      <div>
                        <h3 className="text-base font-black text-black uppercase tracking-tight">
                          Stage Director Console
                        </h3>
                        <span className="text-xs font-semibold text-black/60">
                          Live Auditorium Orchestration • Q.{roomState.currentQuestionIndex + 1} of {roomState.totalQuestions}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge color={roomState.status === 'QUESTION_ACTIVE' ? 'green' : roomState.status === 'PAUSED' ? 'yellow' : 'blue'} size="md">
                        ● {roomState.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={fetchRoomState} title="Sync Live Room">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Visual Stage Stepper Pipeline */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { step: 'COUNTDOWN', label: '1. Countdown', icon: Play },
                      { step: 'QUESTION_ACTIVE', label: '2. Live Answers', icon: Radio },
                      { step: 'QUESTION_LOCKED', label: '3. Lock Time', icon: Lock },
                      { step: 'QUESTION_RESULT', label: '4. Reveal Ans', icon: BarChart3 },
                      { step: 'LEADERBOARD', label: '5. Leaderboard', icon: Trophy },
                    ].map((st) => {
                      const isActive = roomState.status === st.step || (st.step === 'QUESTION_ACTIVE' && roomState.status === 'PAUSED');
                      const Icon = st.icon;
                      return (
                        <div
                          key={st.step}
                          className={`p-2.5 rounded-xl border-[2px] border-black text-center transition-all ${
                            isActive
                              ? 'bg-[#4285F4] text-white shadow-[2px_2px_0_0_#000] scale-[1.02]'
                              : 'bg-white text-black/70 shadow-[1px_1px_0_0_#000]'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mx-auto mb-1 ${isActive ? 'text-[#FBBC05]' : 'text-black/50'}`} />
                          <span className="text-[11px] font-black uppercase block tracking-wider">
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* SMART PRIMARY ACTION HERO CARD */}
                  <div className="p-4 bg-white border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#4285F4] block">
                        Recommended Next Step
                      </span>
                      <h4 className="text-base font-black uppercase text-black">
                        {roomState.status === 'COUNTDOWN' && 'Push Question Live on Stage & Phones'}
                        {roomState.status === 'QUESTION_ACTIVE' && 'Accepting Submissions (Time Running)'}
                        {roomState.status === 'PAUSED' && 'Clock Paused for Explanation'}
                        {roomState.status === 'QUESTION_LOCKED' && 'Answers Locked — Reveal Results'}
                        {roomState.status === 'QUESTION_RESULT' && 'Answers Revealed — Auto-advancing to Leaderboard (5s)'}
                        {roomState.status === 'LEADERBOARD' && (
                          roomState.currentQuestionIndex + 1 < roomState.totalQuestions
                            ? `Stage Standings Live — Auto-advancing to Question ${roomState.currentQuestionIndex + 2} (5s)`
                            : 'Battle Concluded — Awarding Final Podium'
                        )}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      {/* COUNTDOWN PHASE */}
                      {roomState.status === 'COUNTDOWN' && (
                        <Button
                          variant="success"
                          size="lg"
                          onClick={() => handleTransition('QUESTION_ACTIVE')}
                          className="w-full sm:w-auto font-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                        >
                          <Play className="w-4 h-4 mr-2" /> Push Question Live
                        </Button>
                      )}

                      {/* QUESTION ACTIVE PHASE */}
                      {roomState.status === 'QUESTION_ACTIVE' && (
                        <>
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={handlePause}
                            className="font-black text-xs"
                          >
                            <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause Clock
                          </Button>
                          <Button
                            variant="danger"
                            size="lg"
                            onClick={() => handleTransition('QUESTION_LOCKED')}
                            className="font-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                          >
                            <Lock className="w-4 h-4 mr-2" /> Lock Submissions (Time's Up)
                          </Button>
                        </>
                      )}

                      {/* PAUSED PHASE */}
                      {roomState.status === 'PAUSED' && (
                        <Button
                          variant="success"
                          size="lg"
                          onClick={handleResume}
                          className="w-full sm:w-auto font-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                        >
                          <Play className="w-4 h-4 mr-2" /> Resume Stage Clock
                        </Button>
                      )}

                      {/* QUESTION LOCKED PHASE */}
                      {roomState.status === 'QUESTION_LOCKED' && (
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => handleTransition('QUESTION_RESULT')}
                          className="w-full sm:w-auto font-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                        >
                          <BarChart3 className="w-4 h-4 mr-2" /> Reveal Audience Results
                        </Button>
                      )}

                      {/* QUESTION RESULT PHASE */}
                      {roomState.status === 'QUESTION_RESULT' && (
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => handleTransition('LEADERBOARD')}
                          className="w-full sm:w-auto font-black text-xs uppercase shadow-[3px_3px_0_0_#000] bg-[#FFF8E7] hover:bg-[#FBBC05]"
                        >
                          <Trophy className="w-4 h-4 mr-2 text-black" /> Show Stage Leaderboard
                        </Button>
                      )}

                      {/* LEADERBOARD PHASE */}
                      {roomState.status === 'LEADERBOARD' && (
                        roomState.currentQuestionIndex + 1 < roomState.totalQuestions ? (
                          <Button
                            variant="primary"
                            size="lg"
                            onClick={handleAdvance}
                            className="w-full sm:w-auto font-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" /> Next Question (Q.{roomState.currentQuestionIndex + 2})
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="lg"
                            onClick={() => handleTransition('GAME_OVER')}
                            className="w-full sm:w-auto font-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                          >
                            <Trophy className="w-4 h-4 mr-2" /> Finish Battle & Award Podium
                          </Button>
                        )
                      )}
                    </div>
                  </div>

                  {/* QUICK MANUAL OVERRIDES ROW */}
                  <div className="pt-3 border-t-2 border-black/10">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                      <span className="text-[10px] font-black uppercase text-black/60 tracking-wider flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-[#4285F4]" /> Anchor Quick Manual Overrides:
                      </span>
                      <span className="text-[10px] font-bold text-black/40">
                        Instant stage jumps & fallbacks
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 1. Countdown */}
                      <button
                        type="button"
                        onClick={() => handleTransition('COUNTDOWN')}
                        className={`px-3 py-2 border-[2px] border-black rounded-lg text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                          roomState.status === 'COUNTDOWN'
                            ? 'bg-[#FFF8E7] text-[#B07D00] ring-2 ring-[#FBBC05]'
                            : 'bg-white hover:bg-black/5 text-black'
                        }`}
                        title="Start 3-second animated countdown for current question"
                      >
                        <Play className="w-3.5 h-3.5 text-[#FBBC05] fill-current" />
                        <span>3-2-1 Countdown</span>
                        {roomState.status === 'COUNTDOWN' && (
                          <span className="w-2 h-2 rounded-full bg-[#FBBC05] animate-ping ml-1" />
                        )}
                      </button>

                      {/* 2. Push Live Now */}
                      <button
                        type="button"
                        onClick={() => handleTransition('QUESTION_ACTIVE')}
                        className={`px-3 py-2 border-[2px] border-black rounded-lg text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                          roomState.status === 'QUESTION_ACTIVE'
                            ? 'bg-[#E6F4EA] text-[#137333] ring-2 ring-[#34A853]'
                            : 'bg-white hover:bg-black/5 text-black'
                        }`}
                        title="Skip countdown & push question live for submissions"
                      >
                        <Play className="w-3.5 h-3.5 text-[#34A853] fill-current" />
                        <span>Push Live Now</span>
                        {roomState.status === 'QUESTION_ACTIVE' && (
                          <span className="w-2 h-2 rounded-full bg-[#34A853] animate-ping ml-1" />
                        )}
                      </button>

                      {/* 3. Lock Answers */}
                      <button
                        type="button"
                        onClick={() => handleTransition('QUESTION_LOCKED')}
                        className={`px-3 py-2 border-[2px] border-black rounded-lg text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                          roomState.status === 'QUESTION_LOCKED'
                            ? 'bg-[#FCE8E6] text-[#C5221F] ring-2 ring-[#EA4335]'
                            : 'bg-white hover:bg-black/5 text-black'
                        }`}
                        title="Cut off submissions immediately"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#EA4335]" />
                        <span>Lock Answers</span>
                        {roomState.status === 'QUESTION_LOCKED' && (
                          <span className="w-2 h-2 rounded-full bg-[#EA4335] animate-ping ml-1" />
                        )}
                      </button>

                      {/* 4. Reveal Results */}
                      <button
                        type="button"
                        onClick={() => handleTransition('QUESTION_RESULT')}
                        className={`px-3 py-2 border-[2px] border-black rounded-lg text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                          roomState.status === 'QUESTION_RESULT'
                            ? 'bg-[#E8F0FE] text-[#1A73E8] ring-2 ring-[#4285F4]'
                            : 'bg-white hover:bg-black/5 text-black'
                        }`}
                        title="Reveal audience distribution and correct answer"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-[#4285F4]" />
                        <span>Reveal Results</span>
                        {roomState.status === 'QUESTION_RESULT' && (
                          <span className="w-2 h-2 rounded-full bg-[#4285F4] animate-ping ml-1" />
                        )}
                      </button>

                      {/* 5. Stage Leaderboard */}
                      <button
                        type="button"
                        onClick={() => handleTransition('LEADERBOARD')}
                        className={`px-3 py-2 border-[2px] border-black rounded-lg text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                          roomState.status === 'LEADERBOARD'
                            ? 'bg-[#FEF7E0] text-[#B07D00] ring-2 ring-[#FBBC05]'
                            : 'bg-white hover:bg-black/5 text-black'
                        }`}
                        title="Show live leaderboard on stage"
                      >
                        <Trophy className="w-3.5 h-3.5 text-[#FBBC05]" />
                        <span>Stage Leaderboard</span>
                        {roomState.status === 'LEADERBOARD' && (
                          <span className="w-2 h-2 rounded-full bg-[#FBBC05] animate-ping ml-1" />
                        )}
                      </button>

                      {/* 6. Next Question */}
                      <button
                        type="button"
                        disabled={roomState.currentQuestionIndex + 1 >= roomState.totalQuestions}
                        onClick={handleAdvance}
                        className={`px-3 py-2 border-[2px] border-black rounded-lg text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                          roomState.currentQuestionIndex + 1 >= roomState.totalQuestions
                            ? 'bg-neutral-100 text-black/40 border-black/30 cursor-not-allowed shadow-none'
                            : 'bg-white hover:bg-black/5 text-black cursor-pointer'
                        }`}
                        title={
                          roomState.currentQuestionIndex + 1 < roomState.totalQuestions
                            ? `Advance to Question ${roomState.currentQuestionIndex + 2}`
                            : 'All questions have concluded'
                        }
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-[#4285F4]" />
                        <span>
                          {roomState.currentQuestionIndex + 1 < roomState.totalQuestions
                            ? `Next Question (Q.${roomState.currentQuestionIndex + 2})`
                            : 'Last Question Reached'}
                        </span>
                      </button>

                      {/* 7. Finish Match */}
                      <button
                        type="button"
                        onClick={handleFinishMatch}
                        className="px-3 py-2 bg-[#FCE8E6] hover:bg-[#FAD2CF] border-[2px] border-black rounded-lg text-xs font-black text-[#EA4335] flex items-center gap-1.5 shadow-[2px_2px_0_0_#000] ml-auto cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                        title="Safely conclude battle and show final podium"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Finish Match</span>
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Current Active Question Preview Card */}
                {roomState.activeQuestion && (
                  <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-[#4285F4] block">
                        Active Question Preview (Q.{roomState.currentQuestionIndex + 1} of {roomState.totalQuestions})
                      </span>
                      <span className="text-[11px] font-bold text-black/60">
                        {roomState.hallName || 'Conference Hall'}
                      </span>
                    </div>
                    <p className="font-black text-sm text-black mb-3">
                      {roomState.activeQuestion.prompt}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {(roomState.activeQuestion?.options || []).map((opt, idx) => {
                        const optionLabels = ['A', 'B', 'C', 'D'];
                        const colorThemes = [
                          'border-[#EA4335] bg-[#FFEBEE] text-[#EA4335]',
                          'border-[#4285F4] bg-[#EEF4FF] text-[#4285F4]',
                          'border-[#FBBC05] bg-[#FFF8E7] text-[#B07D00]',
                          'border-[#34A853] bg-[#EEFBF3] text-[#34A853]',
                        ];
                        const isCorrect = telemetry?.activeQuestion?.correctOptionId === opt.id;

                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 border-[2px] rounded-xl font-bold flex items-center justify-between shadow-[1.5px_1.5px_0_0_#000] ${
                              colorThemes[idx % 4]
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-black text-white flex items-center justify-center font-mono font-black text-[10px] shrink-0">
                                {optionLabels[idx] || idx + 1}
                              </span>
                              <span className="text-black font-extrabold truncate">{opt.text}</span>
                            </div>
                            {isCorrect && (
                              <span className="text-[10px] font-black uppercase bg-[#34A853] text-white px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0_0_#000] shrink-0">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* AUDITORIUM LIVE TELEMETRY & ATTENDEE RESPONSES DECK */}
                <Card surface="white" shadow="lg" border="thick" rounded="xl" className="p-6">
                  {/* Telemetry Header */}
                  <div className="flex items-center justify-between pb-4 mb-5 border-b-2 border-black/10 flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#EA4335] animate-ping" />
                        <h3 className="text-base font-black text-black uppercase tracking-tight flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-[#4285F4]" />
                          Live Auditorium Telemetry & Audience Choices
                        </h3>
                      </div>
                      <p className="text-xs text-black/60 font-semibold mt-0.5">
                        Real-time stream of attendee answers for Q.{roomState.currentQuestionIndex + 1} in{' '}
                        <span className="font-bold text-black">{roomState.hallName || 'Conference Hall'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={fetchRoomState}>
                        <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Refresh
                      </Button>
                    </div>
                  </div>

                  {/* 3 Metrics & Response Progress */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                    <div className="p-3 bg-[#EEF4FF] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                      <span className="text-[10px] font-black uppercase text-[#4285F4] block">
                        Connected Audience
                      </span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-mono font-black text-2xl text-black">
                          {telemetry?.totalConnected ?? roomState.attendeeCount ?? 0}
                        </span>
                        <span className="text-xs font-bold text-black/50">in hall</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#EEFBF3] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                      <span className="text-[10px] font-black uppercase text-[#34A853] block">
                        Answers Received
                      </span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-mono font-black text-2xl text-[#34A853]">
                          {telemetry?.submissionCount ?? roomState.submissionCount ?? 0}
                        </span>
                        <span className="text-xs font-bold text-black/50">
                          {telemetry?.totalConnected
                            ? `${Math.round(((telemetry.submissionCount || 0) / telemetry.totalConnected) * 100)}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#FFF8E7] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                      <span className="text-[10px] font-black uppercase text-[#FBBC05] block">
                        Thinking / Pending
                      </span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-mono font-black text-2xl text-[#B07D00]">
                          {telemetry?.pendingCount ??
                            Math.max(
                              0,
                              (telemetry?.totalConnected ?? roomState.attendeeCount ?? 0) -
                                (telemetry?.submissionCount ?? roomState.submissionCount ?? 0)
                            )}
                        </span>
                        <span className="text-xs font-bold text-black/50">waiting</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Response Progress Bar */}
                  {(() => {
                    const total = telemetry?.totalConnected || roomState.attendeeCount || 0;
                    const answers = telemetry?.submissionCount || roomState.submissionCount || 0;
                    const pct = total > 0 ? Math.min(100, Math.round((answers / total) * 100)) : 0;
                    return (
                      <div className="mb-6 p-3 bg-[#FFFBF0] border-[2px] border-black rounded-xl shadow-[2px_2px_0_0_#000]">
                        <div className="flex justify-between items-center text-xs font-black uppercase mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#4285F4]" /> Real-time Participation Velocity
                          </span>
                          <span>{answers} / {total} Answered ({pct}%)</span>
                        </div>
                        <div className="w-full h-4 bg-white border-[2px] border-black rounded-full overflow-hidden p-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4-Option Live Selection Distribution Breakdown */}
                  {roomState.activeQuestion && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-[#4285F4]" />
                          Option Selection Breakdown (Who Voted What)
                        </h4>
                        <span className="text-[11px] font-bold text-black/50">
                          Live Vote Count & Percentage
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(roomState.activeQuestion?.options || []).map((opt, idx) => {
                          const optionLabels = ['A', 'B', 'C', 'D'];
                          const optLabel = optionLabels[idx] || String(idx + 1);
                          const counts = telemetry?.breakdown?.[opt.id] || 0;
                          const totalAnswers = telemetry?.submissionCount || 0;
                          const pct = totalAnswers > 0 ? Math.round((counts / totalAnswers) * 100) : 0;

                          const optStyles = [
                            { border: 'border-[#EA4335]', bg: 'bg-[#FFEBEE]', bar: 'bg-[#EA4335]', tag: 'bg-[#EA4335]' },
                            { border: 'border-[#4285F4]', bg: 'bg-[#EEF4FF]', bar: 'bg-[#4285F4]', tag: 'bg-[#4285F4]' },
                            { border: 'border-[#FBBC05]', bg: 'bg-[#FFF8E7]', bar: 'bg-[#FBBC05]', tag: 'bg-[#FBBC05]' },
                            { border: 'border-[#34A853]', bg: 'bg-[#EEFBF3]', bar: 'bg-[#34A853]', tag: 'bg-[#34A853]' },
                          ][idx % 4];

                          const isCorrect = telemetry?.activeQuestion?.correctOptionId === opt.id;

                          return (
                            <div
                              key={opt.id}
                              className={`p-3 border-[2.5px] rounded-2xl flex flex-col justify-between shadow-[3px_3px_0_0_#000] ${
                                optStyles.border
                              } ${optStyles.bg}`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span
                                    className={`w-6 h-6 rounded-lg text-white flex items-center justify-center font-mono font-black text-xs border border-black shadow-[1px_1px_0_0_#000] ${
                                      optStyles.tag
                                    }`}
                                  >
                                    {optLabel}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {isCorrect && (
                                      <span className="text-[9px] font-black uppercase bg-[#34A853] text-white px-1.5 py-0.5 rounded border border-black">
                                        Correct
                                      </span>
                                    )}
                                    <span className="font-mono font-black text-sm text-black">
                                      {counts} votes
                                    </span>
                                  </div>
                                </div>
                                <p className="font-extrabold text-xs text-black line-clamp-2 mb-2">
                                  {opt.text}
                                </p>
                              </div>

                              <div>
                                <div className="flex justify-between items-center text-[10px] font-black mb-1">
                                  <span>Audience Share</span>
                                  <span className="font-mono text-xs">{pct}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-white border-[1.5px] border-black rounded-full overflow-hidden p-0.5">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${optStyles.bar}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Filter and Attendee Response Roster */}
                  <div className="pt-5 border-t-2 border-black/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black uppercase text-black flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-[#4285F4]" />
                          Live Attendee Response Roster
                        </h4>
                        <p className="text-[11px] font-semibold text-black/60">
                          Individual choices, timestamps, and reaction speed for every audience member in this auditorium.
                        </p>
                      </div>

                      {/* Search Bar */}
                      <div className="relative min-w-[220px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-black/50" />
                        <input
                          type="text"
                          placeholder="Search attendee or ticket..."
                          value={telemetrySearch}
                          onChange={(e) => setTelemetrySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black focus:outline-none placeholder:text-black/40 shadow-[1.5px_1.5px_0_0_#000]"
                        />
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    {(() => {
                      const responses = telemetry?.responses || [];
                      const pending = telemetry?.pendingAttendees || [];
                      const optA = responses.filter((r) => r.selectedOptionId === 'opt_1').length;
                      const optB = responses.filter((r) => r.selectedOptionId === 'opt_2').length;
                      const optC = responses.filter((r) => r.selectedOptionId === 'opt_3').length;
                      const optD = responses.filter((r) => r.selectedOptionId === 'opt_4').length;

                      const filterButtons = [
                        { id: 'all', label: `All Attendees (${responses.length + pending.length})` },
                        { id: 'answered', label: `Answered (${responses.length})` },
                        { id: 'pending', label: `Thinking (${pending.length})` },
                        { id: 'opt_1', label: `Opt A (${optA})` },
                        { id: 'opt_2', label: `Opt B (${optB})` },
                        { id: 'opt_3', label: `Opt C (${optC})` },
                        { id: 'opt_4', label: `Opt D (${optD})` },
                      ];

                      return (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
                          {filterButtons.map((btn) => (
                            <button
                              key={btn.id}
                              onClick={() => setTelemetryFilter(btn.id)}
                              className={`px-3 py-1 rounded-lg border-[1.5px] border-black text-xs font-black transition-all shrink-0 cursor-pointer ${
                                telemetryFilter === btn.id
                                  ? 'bg-black text-white shadow-[2px_2px_0_0_#FBBC05]'
                                  : 'bg-[#FFFBF0] text-black hover:bg-neutral-100'
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Attendee Response Table */}
                    {(() => {
                      const responses = (telemetry?.responses || []).map((r) => ({
                        ...r,
                        status: 'ANSWERED',
                      }));
                      const pending = (telemetry?.pendingAttendees || []).map((p) => ({
                        uniqueCode: p.uniqueCode,
                        displayName: p.displayName,
                        organization: p.organization,
                        selectedOptionId: null,
                        selectedOptionText: null,
                        timeElapsedMs: null,
                        pointsAwarded: null,
                        status: 'PENDING',
                      }));

                      const combined = [...responses, ...pending];

                      const filtered = combined.filter((item) => {
                        if (telemetrySearch) {
                          const q = telemetrySearch.toLowerCase();
                          const matchName = item.displayName?.toLowerCase().includes(q);
                          const matchCode = item.uniqueCode?.toLowerCase().includes(q);
                          if (!matchName && !matchCode) return false;
                        }
                        if (telemetryFilter === 'all') return true;
                        if (telemetryFilter === 'answered') return item.status === 'ANSWERED';
                        if (telemetryFilter === 'pending') return item.status === 'PENDING';
                        if (telemetryFilter.startsWith('opt_')) return item.selectedOptionId === telemetryFilter;
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="py-10 text-center border-2 border-dashed border-black/20 rounded-xl bg-[#FFFBF0]">
                            <Users className="w-8 h-8 text-black/30 mx-auto mb-2" />
                            <p className="font-bold text-xs text-black">No attendees matching this filter</p>
                          </div>
                        );
                      }

                      return (
                        <div className="max-h-80 overflow-y-auto border-[2px] border-black rounded-xl overflow-hidden shadow-[2px_2px_0_0_#000]">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-black text-white uppercase text-[10px] font-black sticky top-0 z-10">
                              <tr>
                                <th className="p-2.5">Attendee / Ticket</th>
                                <th className="p-2.5">Hall Track</th>
                                <th className="p-2.5">Selected Choice</th>
                                <th className="p-2.5 text-center">Reaction Time</th>
                                <th className="p-2.5 text-right">Points</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10 font-bold">
                              {filtered.map((att) => {
                                const optionLabels = { opt_1: 'A', opt_2: 'B', opt_3: 'C', opt_4: 'D' };
                                const optionLabel = optionLabels[att.selectedOptionId] || '?';

                                const optColors = {
                                  opt_1: 'bg-[#FFEBEE] text-[#EA4335] border-[#EA4335]',
                                  opt_2: 'bg-[#EEF4FF] text-[#4285F4] border-[#4285F4]',
                                  opt_3: 'bg-[#FFF8E7] text-[#B07D00] border-[#FBBC05]',
                                  opt_4: 'bg-[#EEFBF3] text-[#34A853] border-[#34A853]',
                                };
                                const colorClass = optColors[att.selectedOptionId] || 'bg-neutral-100 text-black border-black';

                                return (
                                  <tr
                                    key={att.uniqueCode}
                                    className="hover:bg-[#FFFBF0] transition-colors"
                                  >
                                    <td className="p-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-[#4285F4]/10 text-[#4285F4] flex items-center justify-center font-bold text-xs shrink-0">
                                          <UserCheck className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                          <span className="font-black text-black block">
                                            {att.displayName}
                                          </span>
                                          <span className="font-mono text-[10px] text-black/50 block">
                                            {att.uniqueCode}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-black/70 text-[11px] truncate max-w-[120px]">
                                      {att.organization || 'General Attendee'}
                                    </td>
                                    <td className="p-2.5">
                                      {att.status === 'ANSWERED' ? (
                                        <span
                                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-black text-xs ${colorClass}`}
                                        >
                                          <span className="font-black">[{optionLabel}]</span>
                                          <span className="truncate max-w-[160px]">
                                            {att.selectedOptionText || 'Option selected'}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/20 bg-[#FFF8E7] text-[#B07D00] font-bold text-[11px] animate-pulse">
                                          <Clock className="w-3 h-3" /> Still Thinking...
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center font-mono text-xs">
                                      {att.timeElapsedMs !== null
                                        ? `${(att.timeElapsedMs / 1000).toFixed(2)}s`
                                        : '—'}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-black text-sm">
                                      {att.pointsAwarded !== null ? (
                                        <span className="text-[#34A853]">+{att.pointsAwarded}</span>
                                      ) : (
                                        <span className="text-black/30">0</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      ) : (
        <Card surface="warmWhite" shadow="md" border="thick" rounded="xl" className="p-12 text-center">
          <HelpCircle className="w-10 h-10 text-black/40 mx-auto mb-2" />
          <h3 className="font-black text-base uppercase text-black mb-1">
            No Active Battle Running
          </h3>
          <p className="text-xs text-black/60 font-semibold">
            Go to the "Game Builder" tab to launch a live battle room onto the auditorium stage screen.
          </p>
        </Card>
      )}

      {/* CONFIRMATION MODAL FOR RE-START GAME */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <Card
            surface="white"
            shadow="lg"
            border="thick"
            rounded="2xl"
            className="p-6 max-w-lg w-full space-y-5 border-[3px] border-black shadow-[8px_8px_0_0_#000]"
          >
            <div className="flex items-center gap-3 pb-3 border-b-2 border-black/10">
              <div className="w-10 h-10 rounded-xl bg-[#FFF8E7] border-2 border-black flex items-center justify-center text-[#EA4335] shadow-[2px_2px_0_0_#000]">
                <RotateCcw className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase text-black">Re-Start Battle Match?</h3>
                <span className="text-xs font-bold text-black/60">Reset match & launch a new room</span>
              </div>
            </div>

            <div className="p-4 bg-[#FFF8E7] border-2 border-black rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-[#EA4335]">
                <AlertTriangle className="w-4 h-4" />
                Tournament Reset Warning
              </div>
              <p className="text-xs font-semibold text-black/80 leading-relaxed">
                Re-starting will <strong>wipe the previous match sessions & submitted answers</strong> from the database. A fresh live battle room will be launched for this game definition, allowing audience members to join again.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-black block">Auditorium / Hall</label>
              <select
                value={restartHall}
                onChange={(e) => setRestartHall(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none shadow-[2px_2px_0_0_#000]"
              >
                {DEVFEST_HALLS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRestartModal(false)}
                disabled={isRestarting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRestartRoomGame}
                disabled={isRestarting}
                className="shadow-[2px_2px_0_0_#000]"
              >
                {isRestarting ? 'Resetting & Launching...' : 'Yes, Re-Start Battle'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
