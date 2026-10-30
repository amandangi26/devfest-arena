import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { GameList } from '../components/GameBuilder/GameList';
import { GameEditor } from '../components/GameBuilder/GameEditor';
import { GameResultsModal } from '../components/GameBuilder/GameResultsModal';
import { LiveControlRoom } from '../components/LiveControlRoom/LiveControlRoom';
import { CsvImportSection } from '../components/CsvImportSection';
import { apiClient } from '../../services/api/client';
import {
  Upload,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Search,
  Lock,
  RefreshCw,
  Sparkles,
  Gamepad2,
  Radio,
  Mail,
  Phone,
  UserPlus,
  Trash2,
  CheckSquare,
  Square,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowDown,
} from 'lucide-react';

export function AdminPage({ adminKey: propAdminKey, adminEmail: propAdminEmail, propAdminEmail: propAdminEmailAlt, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

  const resolvedEmail = propAdminEmail || propAdminEmailAlt || sessionStorage.getItem('dfr26_admin_email') || '';
  const [adminKey, setAdminKey] = useState(() => propAdminKey || sessionStorage.getItem('dfr26_admin_key') || '');
  const [adminEmail, setAdminEmail] = useState(() => resolvedEmail);
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(propAdminKey || sessionStorage.getItem('dfr26_admin_key')));
  const [activeTab, setActiveTab] = useState(() => (initialRoom ? 'control' : 'builder')); // 'builder' | 'control' | 'import' | 'attendees'
  const [selectedLiveRoomCode, setSelectedLiveRoomCode] = useState(initialRoom);

  // Sync prop changes
  useEffect(() => {
    if (propAdminKey) {
      setAdminKey(propAdminKey);
      setIsAuthenticated(true);
    }
    const nextEmail = propAdminEmail || propAdminEmailAlt;
    if (nextEmail) {
      setAdminEmail(nextEmail);
    }
  }, [propAdminKey, propAdminEmail, propAdminEmailAlt]);

  // Game Builder state
  const [games, setGames] = useState([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [resultsModalGame, setResultsModalGame] = useState(null);
  const [isSavingGame, setIsSavingGame] = useState(false);
  const [gameSuccessMsg, setGameSuccessMsg] = useState(null);

  // Attendees list, Pagination & Manual Registration state
  const [attendees, setAttendees] = useState([]);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkInSuccess, setCheckInSuccess] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [manualForm, setManualForm] = useState({
    uniqueCode: '',
    name: '',
    email: '',
    phone: '',
    organization: '',
    track: 'all',
  });

  const handleLockConsole = () => {
    if (onLogout) {
      onLogout();
    } else {
      sessionStorage.removeItem('dfr26_admin_key');
      sessionStorage.removeItem('dfr26_admin_email');
      setIsAuthenticated(false);
      setAdminKey('');
    }
  };

  const loadGames = useCallback(async () => {
    if (!adminKey) return;
    setIsLoadingGames(true);
    try {
      const res = await apiClient('/games', {
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        setGames(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingGames(false);
    }
  }, [adminKey]);

  const loadAttendees = useCallback(
    async (targetPage = 1, targetSearch = '', targetSize = 50, append = false) => {
      if (!adminKey) return;
      setIsLoadingAttendees(true);
      try {
        const offset = Math.max(0, (targetPage - 1) * targetSize);
        const searchParam = targetSearch && targetSearch.trim() ? `&search=${encodeURIComponent(targetSearch.trim())}` : '';
        const res = await apiClient(`/attendees?limit=${targetSize}&offset=${offset}${searchParam}`, {
          headers: { 'x-admin-key': adminKey },
        });
        if (res?.ok) {
          if (append) {
            setAttendees((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const newItems = (res.data || []).filter((a) => !existingIds.has(a.id));
              return [...prev, ...newItems];
            });
          } else {
            setAttendees(res.data || []);
          }
          setTotalAttendees(res.total || 0);
        }
      } catch (err) {
        console.error('Failed to load attendees:', err);
      } finally {
        setIsLoadingAttendees(false);
      }
    },
    [adminKey]
  );

  // Debounced search trigger across all attendees
  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;
    const timer = setTimeout(() => {
      setPage(1);
      loadAttendees(1, searchTerm, pageSize, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, pageSize, adminKey, isAuthenticated, loadAttendees]);

  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;
    let ignore = false;

    async function initialFetch() {
      try {
        const [gamesRes, attRes] = await Promise.allSettled([
          apiClient('/games', { headers: { 'x-admin-key': adminKey } }),
          apiClient('/attendees?limit=50&offset=0', { headers: { 'x-admin-key': adminKey } }),
        ]);

        if (!ignore) {
          if (gamesRes.status === 'fulfilled' && gamesRes.value?.ok) {
            setGames(gamesRes.value.data || []);
          }
          if (attRes.status === 'fulfilled' && attRes.value?.ok) {
            setAttendees(attRes.value.data || []);
            setTotalAttendees(attRes.value.total || 0);
          }
        }
      } catch {
        // ignore
      }
    }

    initialFetch();

    return () => {
      ignore = true;
    };
  }, [isAuthenticated, adminKey]);

  // Game Builder Handlers
  const handleSaveGame = async (gamePayload) => {
    setIsSavingGame(true);
    try {
      let res;
      if (selectedGame?.id) {
        res = await apiClient(`/games/${selectedGame.id}`, {
          method: 'PUT',
          headers: { 'x-admin-key': adminKey },
          body: JSON.stringify(gamePayload),
        });
      } else {
        res = await apiClient('/games', {
          method: 'POST',
          headers: { 'x-admin-key': adminKey },
          body: JSON.stringify(gamePayload),
        });
      }

      if (res?.ok) {
        setGameSuccessMsg(`Quiz "${res.game.title}" saved successfully!`);
        setTimeout(() => setGameSuccessMsg(null), 3000);
        setSelectedGame(res.game);
        loadGames();
      } else {
        throw new Error(res?.error?.message || 'Save failed');
      }
    } finally {
      setIsSavingGame(false);
    }
  };

  const handlePublishGame = async (gamePayload) => {
    setIsSavingGame(true);
    try {
      let gameId = selectedGame?.id;

      // New Game: Create and Publish atomically in 1 single fast call
      if (!gameId) {
        const createRes = await apiClient('/games?publish=true', {
          method: 'POST',
          headers: { 'x-admin-key': adminKey },
          body: JSON.stringify(gamePayload),
        });
        if (!createRes?.ok) throw new Error(createRes?.error?.message || 'Create and publish failed');

        const vNum = createRes.version?.version_number || 1;
        const qCount = createRes.version?.total_questions || createRes.game?.questions?.length || 0;
        setGameSuccessMsg(`Version ${vNum} Published! Snapshot with ${qCount} questions locked into Live Arena.`);
        setTimeout(() => setGameSuccessMsg(null), 4000);
        setSelectedGame(null);
        loadGames();
        return;
      }

      // Existing Game: Update draft and publish snapshot in 1 single atomic call
      const pubRes = await apiClient(`/games/${gameId}/publish`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify(gamePayload),
      });

      if (pubRes?.ok) {
        setGameSuccessMsg(
          `Version ${pubRes.version.version_number} Published! Snapshot with ${pubRes.version.total_questions} questions locked.`
        );
        setTimeout(() => setGameSuccessMsg(null), 4000);
        setSelectedGame(null);
        loadGames();
      } else {
        throw new Error(pubRes?.error?.message || 'Publish failed');
      }
    } finally {
      setIsSavingGame(false);
    }
  };

  const handleDuplicateGame = async (gameId) => {
    try {
      const res = await apiClient(`/games/${gameId}/duplicate`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        setGameSuccessMsg(`Duplicated: ${res.game.title}`);
        setTimeout(() => setGameSuccessMsg(null), 3000);
        loadGames();
      }
    } catch (err) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  const handleArchiveGame = async (gameId) => {
    if (!confirm('Are you sure you want to archive this quiz?')) return;
    try {
      const res = await apiClient(`/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        loadGames();
      }
    } catch (err) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  const handleDeleteGame = async (gameId) => {
    try {
      const res = await apiClient(`/games/${gameId}?permanent=true`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        setGameSuccessMsg(`Quiz permanently deleted from database.`);
        setTimeout(() => setGameSuccessMsg(null), 4000);
        setSelectedGame(null);
        await loadGames();
      } else {
        throw new Error(res?.error?.message || 'Delete failed');
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleStartGameFromBuilder = async (game) => {
    if (game.status === 'ENDED') {
      navigate(`/admin/games/${game.id}/results`);
      return;
    }

    const qCount = game.questions?.length || game.totalQuestions || 0;
    if (qCount === 0) {
      alert(`Cannot launch "${game.title}": This quiz has 0 questions. Please add questions in the editor before starting a live battle.`);
      setSelectedGame(game);
      return;
    }

    try {
      setIsLoadingGames(true);
      const res = await apiClient('/rooms/get-or-create', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({
          gameDefinitionId: game.id,
          trackTarget: game.track_target || game.trackTarget || 'all',
          hallName: game.hall_name || game.hallName || 'Conference Hall',
        }),
      });

      if (res?.ok && res.roomCode) {
        setSelectedLiveRoomCode(res.roomCode);
        setActiveTab('control');
        setGameSuccessMsg(`🚀 Stage Battle Room ${res.roomCode} ready for "${game.title}"!`);
        setTimeout(() => setGameSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(`Failed to launch battle room: ${err.message}`);
    } finally {
      setIsLoadingGames(false);
    }
  };

  const handleCheckIn = async (uniqueCode) => {
    try {
      const res = await apiClient(`/attendees/${uniqueCode}/check-in`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        setCheckInSuccess(`Checked in: ${res.attendee.name} (${res.attendee.uniqueCode})`);
        setTimeout(() => setCheckInSuccess(null), 3000);
        loadAttendees(page, searchTerm, pageSize, false);
      }
    } catch (err) {
      alert(`Check-in failed: ${err.message}`);
    }
  };

  const handleDeleteSingle = async (att) => {
    const identifier = att.id || att.unique_code || att.uniqueCode;
    const name = att.name || 'Attendee';
    const code = att.unique_code || att.uniqueCode || '';

    if (
      !window.confirm(
        `Are you sure you want to permanently delete attendee "${name}" (${code})?\n\nThis will remove their ticket, track affiliations, and admission status.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await apiClient(`/attendees/${identifier}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok) {
        setCheckInSuccess(`🗑️ Successfully deleted: ${name}`);
        setTimeout(() => setCheckInSuccess(null), 3500);
        setSelectedAttendeeIds((prev) => {
          const next = new Set(prev);
          next.delete(identifier);
          return next;
        });
        loadAttendees(page, searchTerm, pageSize, false);
      } else {
        alert(res?.error?.message || 'Failed to delete attendee.');
      }
    } catch (err) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAttendeeIds.size === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to permanently delete the ${selectedAttendeeIds.size} selected attendee(s)?\n\nThis action will erase their tickets, tracks, and session records and cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await apiClient('/attendees/bulk-delete', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ ids: Array.from(selectedAttendeeIds) }),
      });

      if (res?.ok) {
        setCheckInSuccess(`🗑️ Successfully deleted ${res.deletedCount} attendee(s).`);
        setTimeout(() => setCheckInSuccess(null), 4000);
        setSelectedAttendeeIds(new Set());
        loadAttendees(page, searchTerm, pageSize, false);
      } else {
        alert(res?.error?.message || 'Failed to bulk delete attendees.');
      }
    } catch (err) {
      alert(`Bulk deletion failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateCode = () => {
    const randomCode = `DFR26-W${Math.floor(100 + Math.random() * 900)}`;
    setManualForm((prev) => ({ ...prev, uniqueCode: randomCode }));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualError(null);

    const cleanName = manualForm.name.trim();
    const cleanEmail = manualForm.email.trim();
    const cleanPhone = manualForm.phone.trim();
    const cleanOrg = manualForm.organization.trim();
    const cleanCode = manualForm.uniqueCode.trim().toUpperCase();

    if (!cleanName || !cleanEmail) {
      setManualError('Please provide at least Full Name and Email address.');
      return;
    }

    if (cleanName.length < 2) {
      setManualError('Full name must be at least 2 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setManualError('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    if (cleanPhone) {
      const phoneDigits = cleanPhone.replace(/[\s\-]/g, '');
      const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneDigits)) {
        setManualError('Please enter a valid 10-digit mobile number (starting with 6, 7, 8, or 9).');
        return;
      }
    }

    setIsSubmittingManual(true);
    try {
      const payload = {
        ...manualForm,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        organization: cleanOrg,
        uniqueCode: cleanCode || undefined,
      };

      const res = await apiClient('/attendees', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify(payload),
      });

      if (res?.ok) {
        setCheckInSuccess(`🎉 Registered & Admitted: ${res.attendee.name} (${res.attendee.unique_code || res.attendee.uniqueCode})`);
        setTimeout(() => setCheckInSuccess(null), 4000);
        setShowManualModal(false);
        setManualForm({
          uniqueCode: '',
          name: '',
          email: '',
          phone: '',
          organization: '',
          track: 'all',
        });
        setPage(1);
        loadAttendees(1, searchTerm, pageSize, false);
      } else {
        throw new Error(res?.error?.message || 'Failed to register attendee.');
      }
    } catch (err) {
      setManualError(err.data?.error?.message || err.message || 'Registration failed.');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // If not authenticated, prompt to sign in via AdminGuard
  if (!isAuthenticated) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-16 flex-1 flex flex-col items-center justify-center">
        <Card
          surface="white"
          shadow="xl"
          border="thick"
          rounded="xl"
          className="p-8 sm:p-12 max-w-md w-full text-center flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-full bg-[#FFF5F5] border-[2.5px] border-black flex items-center justify-center text-[#EA4335] shadow-[3px_3px_0_0_#000]">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <Badge color="red" size="md" className="mb-2">
              Operator Deck
            </Badge>
            <h1 className="text-2xl font-black text-black uppercase tracking-tight">
              Authentication Required
            </h1>
            <p className="text-xs font-semibold text-black/70 mt-2">
              Please sign in with your administrator email and password to access the console.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Go to Admin Sign In
          </Button>
        </Card>
      </div>
    );
  }

  // Comprehensive filter across all fields with phone digit & multi-word support
  const filteredAttendees = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return attendees;
    const clean = searchTerm.trim().toLowerCase();
    const digits = clean.replace(/\D/g, '');
    const nonPhone = clean.replace(/[\d\s+\-()]/g, '');

    // Pure phone / numeric search
    if (nonPhone.length === 0 && digits.length >= 4) {
      let phoneTerm = digits;
      if (digits.startsWith('91') && digits.length === 12) phoneTerm = digits.slice(2);
      else if (digits.startsWith('0') && digits.length === 11) phoneTerm = digits.slice(1);
      else if (digits.length > 10) phoneTerm = digits.slice(-10);

      return attendees.filter((a) => {
        const p = (a.phone_normalized || a.phone || '').replace(/\D/g, '');
        const code = (a.unique_code || a.uniqueCode || '').toLowerCase();
        return p.includes(phoneTerm) || code.includes(clean);
      });
    }

    const words = clean
      .replace(/[,()"'\\%_]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    return attendees.filter((a) => {
      const p = (a.phone_normalized || a.phone || '').replace(/\D/g, '');
      const combined = [
        a.name || '',
        a.display_name || a.displayName || '',
        a.unique_code || a.uniqueCode || '',
        a.email_normalized || a.email || '',
        a.organization || '',
        a.designation || '',
        p,
      ]
        .join(' ')
        .toLowerCase();

      return words.every((word) => combined.includes(word));
    });
  }, [attendees, searchTerm]);

  const allFilteredIds = filteredAttendees.map((a) => a.id || a.unique_code);
  const areAllSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedAttendeeIds.has(id));

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(totalAttendees / pageSize));
  const isAppended = attendees.length > pageSize;
  const startItem = totalAttendees === 0 ? 0 : isAppended ? 1 : (page - 1) * pageSize + 1;
  const endItem = isAppended ? attendees.length : Math.min(totalAttendees, (page - 1) * pageSize + attendees.length);
  const hasMoreToLoad = attendees.length < totalAttendees;

  return (
    <div className="max-w-[1360px] mx-auto px-3 sm:px-6 py-6 w-full flex flex-col flex-1 gap-6">
      {/* Header Deck */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-[2.5px] border-black rounded-[20px] p-4 sm:p-6 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#FBBC05] border-[2px] border-black flex items-center justify-center text-black shadow-[2px_2px_0_0_#000]">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">
                Operator Master Console
              </h1>
              <Badge color="green" size="sm">
                Active
              </Badge>
            </div>
            <p className="text-xs font-semibold text-black/60 flex items-center gap-2 flex-wrap">
              <span>DevFest Ranchi 2026 • Radisson Blu Live Operations</span>
              {adminEmail && (
                <span className="font-bold text-black bg-[#FFF8E7] px-2 py-0.5 rounded-md border border-black/20 text-[11px]">
                  👤 {adminEmail}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded-full border-[2px] border-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'control'
                ? 'bg-[#EA4335] text-white shadow-[2px_2px_0_0_#000]'
                : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 inline mr-1.5 animate-pulse" /> Live Arena Cockpit
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('builder');
              setSelectedGame(null);
            }}
            className={`px-4 py-2 rounded-full border-[2px] border-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'builder'
                ? 'bg-black text-white shadow-[2px_2px_0_0_#4285F4]'
                : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 inline mr-1.5" /> Game Builder ({games.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-full border-[2px] border-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-black text-white shadow-[2px_2px_0_0_#FBBC05]'
                : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
            }`}
          >
            <Upload className="w-3.5 h-3.5 inline mr-1.5" /> CSV Ingestion
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendees')}
            className={`px-4 py-2 rounded-full border-[2px] border-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'attendees'
                ? 'bg-black text-white shadow-[2px_2px_0_0_#34A853]'
                : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5" /> Attendees ({totalAttendees})
          </button>
        </div>
      </header>

      {/* Notifications Toast */}
      {gameSuccessMsg && (
        <div className="p-4 bg-[#EEFBF3] border-[2.5px] border-[#34A853] rounded-xl flex items-center gap-3 text-sm font-black text-[#0D2818] shadow-[3px_3px_0_0_#34A853]">
          <CheckCircle className="w-5 h-5 text-[#34A853]" />
          <span>{gameSuccessMsg}</span>
        </div>
      )}

      {checkInSuccess && (
        <div className="p-4 bg-[#EEFBF3] border-[2.5px] border-[#34A853] rounded-xl flex items-center gap-3 text-sm font-black text-[#0D2818] shadow-[3px_3px_0_0_#34A853]">
          <CheckCircle className="w-5 h-5 text-[#34A853]" />
          <span>{checkInSuccess}</span>
        </div>
      )}

      {/* TAB 0: LIVE ARENA COCKPIT */}
      {activeTab === 'control' && (
        <LiveControlRoom
          adminKey={adminKey}
          games={games}
          initialRoomCode={selectedLiveRoomCode}
        />
      )}

      {/* TAB 1: GAME BUILDER */}
      {activeTab === 'builder' && (
        selectedGame ? (
          <GameEditor
            game={selectedGame}
            adminKey={adminKey}
            isSaving={isSavingGame}
            onSave={handleSaveGame}
            onPublish={handlePublishGame}
            onDelete={handleDeleteGame}
            onBack={() => setSelectedGame(null)}
          />
        ) : (
          <GameList
            games={games}
            isLoading={isLoadingGames}
            onCreateNew={() => setSelectedGame({})}
            onEdit={(g) => setSelectedGame(g)}
            onStartGame={handleStartGameFromBuilder}
            onViewResults={(g) => navigate(`/admin/games/${g.id}/results`)}
            onDuplicate={handleDuplicateGame}
            onArchive={handleArchiveGame}
            onDelete={handleDeleteGame}
          />
        )
      )}

      {/* TAB 2: CSV INGESTION & TARGETED IMPORT */}
      {activeTab === 'import' && (
        <CsvImportSection
          adminKey={adminKey}
          apiClient={apiClient}
          onImportSuccess={() => {
            setPage(1);
            loadAttendees(1, '', pageSize, false);
          }}
          onSwitchToAttendees={() => setActiveTab('attendees')}
        />
      )}

      {/* TAB 3: ATTENDEES DIRECTORY & MANUAL ENTRY */}
      {activeTab === 'attendees' && (
        <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#4285F4]" />
                <h2 className="text-lg font-black text-black uppercase tracking-tight">
                  Attendees Directory ({totalAttendees})
                </h2>
              </div>
              <p className="text-xs font-semibold text-black/60 mt-0.5">
                Manage registered attendees, live ticket verification, and ground walk-in registrations.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  handleGenerateCode();
                  setShowManualModal(true);
                }}
                className="font-black text-xs shadow-[2px_2px_0_0_#000] flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Manual Entry</span>
              </Button>

              <div className="relative">
                <Search className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, code, org..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3.5 py-1.5 bg-[#FFFBF0] border-[2px] border-black rounded-full text-xs font-semibold text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAttendees(page, searchTerm, pageSize, false)}
                disabled={isLoadingAttendees}
                title="Refresh Attendees"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAttendees ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* BULK ACTION BAR */}
          {selectedAttendeeIds.size > 0 && (
            <div className="mb-4 p-3.5 bg-[#FFF5F5] border-[2px] border-black rounded-xl shadow-[3px_3px_0_0_#000] flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#EA4335] text-white flex items-center justify-center font-black text-xs shadow-[1px_1px_0_0_#000]">
                  {selectedAttendeeIds.size}
                </span>
                <span className="font-black text-xs uppercase tracking-tight text-black">
                  Attendee(s) Selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setSelectedAttendeeIds(new Set())}
                  disabled={isDeleting}
                >
                  Deselect All
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="font-black shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Deleting...' : `Delete Selected (${selectedAttendeeIds.size})`}</span>
                </Button>
              </div>
            </div>
          )}

          {filteredAttendees.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-black/20 rounded-xl bg-[#FFFBF0] flex flex-col items-center gap-3">
              <p className="text-sm font-bold text-black/60">
                {searchTerm
                  ? 'No attendees match your search query.'
                  : 'No attendees registered yet. Ingest CSV data or add walk-ins manually.'}
              </p>
              {!searchTerm && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleGenerateCode();
                    setShowManualModal(true);
                  }}
                  className="font-black text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add First Attendee Manually
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border-[2.5px] border-black rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8E7] border-b-[2.5px] border-black font-black uppercase text-[10px] tracking-wider text-black">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (areAllSelected) {
                            setSelectedAttendeeIds(new Set());
                          } else {
                            setSelectedAttendeeIds(new Set(allFilteredIds));
                          }
                        }}
                        title={areAllSelected ? 'Deselect all' : 'Select all visible attendees'}
                        className="flex items-center justify-center cursor-pointer text-black hover:text-[#4285F4] mx-auto"
                      >
                        {areAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#4285F4]" />
                        ) : (
                          <Square className="w-4 h-4 text-black/40" />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Ticket Code</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Phone Number</th>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Verified At</th>
                    <th className="p-3">Venue Status</th>
                    <th className="p-3 text-right">Entrance / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 bg-white">
                  {filteredAttendees.map((att) => {
                    const identifier = att.id || att.unique_code;
                    const isSelected = selectedAttendeeIds.has(identifier);
                    const isCheckedIn = att.attendance_status === 'checked_in';
                    const isVerified = Boolean(att.ticket_verified_at);
                    const email = att.email_normalized || att.email || '—';
                    const phone = att.phone_normalized || att.phone || '—';

                    return (
                      <tr
                        key={att.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#EEF4FF]/70' : 'hover:bg-[#FFFBF0]/60'
                        }`}
                      >
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttendeeIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(identifier)) next.delete(identifier);
                                else next.add(identifier);
                                return next;
                              });
                            }}
                            className="flex items-center justify-center cursor-pointer mx-auto text-black hover:text-[#4285F4]"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#4285F4]" />
                            ) : (
                              <Square className="w-4 h-4 text-black/40" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 font-mono font-black text-black">
                          {att.unique_code}
                        </td>
                        <td className="p-3 font-bold text-black">
                          <div>{att.name}</div>
                          <span className="text-[10px] font-semibold text-black/50">
                            Public: {att.display_name}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-black">
                          {email !== '—' ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#EEF4FF] border border-[#4285F4]/40 rounded-lg px-2.5 py-1 font-mono text-black font-semibold shadow-[1px_1px_0_0_#4285F4]">
                              <Mail className="w-3.5 h-3.5 text-[#4285F4]" />
                              {email}
                            </span>
                          ) : (
                            <span className="text-black/40 font-mono">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-black">
                          {phone !== '—' ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#FFF8E7] border border-[#FBBC05]/60 rounded-lg px-2.5 py-1 font-mono text-black font-semibold shadow-[1px_1px_0_0_#FBBC05]">
                              <Phone className="w-3.5 h-3.5 text-[#E37400]" />
                              {phone}
                            </span>
                          ) : (
                            <span className="text-black/40 font-mono">—</span>
                          )}
                        </td>
                        <td className="p-3 text-black/70 font-medium">
                          {att.organization || '—'}
                        </td>
                        <td className="p-3">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 text-[#34A853] font-bold text-[10px]">
                              <CheckCircle className="w-3.5 h-3.5" /> Live
                            </span>
                          ) : (
                            <span className="text-black/40 text-[10px] font-medium">Not verified</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isCheckedIn ? (
                            <span className="inline-block bg-[#EEFBF3] text-[#34A853] border border-[#34A853] rounded-md px-2 py-0.5 text-[9px] font-black uppercase">
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-block bg-black/5 text-black/60 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase">
                              Expected
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant={isCheckedIn ? 'outline' : 'success'}
                              size="sm"
                              disabled={isCheckedIn}
                              onClick={() => handleCheckIn(att.unique_code || att.uniqueCode)}
                            >
                              {isCheckedIn ? 'Admitted' : 'Admit Entrance'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(att)}
                              title={`Delete ${att.name}`}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg border-[1.5px] border-black/30 hover:border-black bg-white hover:bg-[#EA4335] text-black hover:text-white shadow-[1px_1px_0_0_#000] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION AND LOAD MORE CONTROLS */}
            <div className="mt-4 pt-4 border-t-[2px] border-black/10 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Range info & Per-page switcher */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-black/70">
                  Showing <span className="font-mono font-black text-black">{startItem}</span> -{' '}
                  <span className="font-mono font-black text-black">{endItem}</span> of{' '}
                  <span className="font-mono font-black text-[#4285F4]">{totalAttendees}</span> Attendees
                </span>

                <div className="flex items-center gap-1.5 text-xs font-bold text-black/60 pl-3 border-l-[1.5px] border-black/20">
                  <span>Per page:</span>
                  {[25, 50, 100].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                        loadAttendees(1, searchTerm, size, false);
                      }}
                      className={`px-2 py-0.5 rounded-md text-xs font-black transition-colors cursor-pointer ${
                        pageSize === size
                          ? 'bg-black text-white shadow-[1px_1px_0_0_#000]'
                          : 'bg-[#FFFBF0] text-black border border-black/30 hover:bg-[#FBBC05]/30'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Lazy Load "Load Next" & Page Navigation */}
              <div className="flex flex-wrap items-center gap-2">
                {hasMoreToLoad && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const nextPage = Math.floor(attendees.length / pageSize) + 1;
                      setPage(nextPage);
                      loadAttendees(nextPage, searchTerm, pageSize, true);
                    }}
                    disabled={isLoadingAttendees}
                    className="font-black text-xs flex items-center gap-1.5 bg-[#FFF8E7] hover:bg-[#FBBC05]/30 border-[1.5px] border-black text-black shadow-[1.5px_1.5px_0_0_#000]"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-[#E37400]" />
                    <span>
                      {isLoadingAttendees
                        ? 'Loading...'
                        : `Load Next ${Math.min(pageSize, totalAttendees - attendees.length)}`}
                    </span>
                  </Button>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (page > 1) {
                        setPage(1);
                        loadAttendees(1, searchTerm, pageSize, false);
                      }
                    }}
                    disabled={page <= 1 || isLoadingAttendees}
                    title="First Page"
                    className="p-1.5 rounded-lg border-[1.5px] border-black/30 bg-white hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5 text-black" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (page > 1) {
                        const prevPage = page - 1;
                        setPage(prevPage);
                        loadAttendees(prevPage, searchTerm, pageSize, false);
                      }
                    }}
                    disabled={page <= 1 || isLoadingAttendees}
                    title="Previous Page"
                    className="p-1.5 rounded-lg border-[1.5px] border-black/30 bg-white hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-black" />
                  </button>

                  <span className="px-2 text-xs font-black text-black whitespace-nowrap">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (page < totalPages) {
                        const nextPage = page + 1;
                        setPage(nextPage);
                        loadAttendees(nextPage, searchTerm, pageSize, false);
                      }
                    }}
                    disabled={page >= totalPages || isLoadingAttendees}
                    title="Next Page"
                    className="p-1.5 rounded-lg border-[1.5px] border-black/30 bg-white hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-black" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (page < totalPages) {
                        setPage(totalPages);
                        loadAttendees(totalPages, searchTerm, pageSize, false);
                      }
                    }}
                    disabled={page >= totalPages || isLoadingAttendees}
                    title="Last Page"
                    className="p-1.5 rounded-lg border-[1.5px] border-black/30 bg-white hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ChevronsRight className="w-3.5 h-3.5 text-black" />
                  </button>
                </div>
              </div>
            </div>
            </>
          )}
        </Card>
      )}

      {/* SPOT REGISTRATION / MANUAL ENTRY MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <Card
            surface="white"
            shadow="xl"
            border="thick"
            rounded="2xl"
            className="w-full max-w-lg p-6 sm:p-7 relative border-[3.5px] border-black shadow-[8px_8px_0_0_#000]"
          >
            <button
              type="button"
              onClick={() => setShowManualModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-black/10 rounded-full transition-colors cursor-pointer text-black/60 hover:text-black"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#EEFBF3] border-[2px] border-black flex items-center justify-center text-[#34A853] shadow-[2px_2px_0_0_#000]">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-black uppercase tracking-tight">
                  Spot Attendee Registration
                </h3>
                <p className="text-[11px] font-semibold text-black/60">
                  Register a walk-in attendee on the ground so they can instantly join live battles.
                </p>
              </div>
            </div>

            {manualError && (
              <div className="my-3 p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-xs font-bold text-[#EA4335] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#EA4335]" />
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-3.5 mt-4 text-left">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-black">
                    Unique Ticket Code
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[10px] font-black uppercase text-[#4285F4] hover:underline cursor-pointer"
                  >
                    🎲 Generate Code
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. DFR26-W101"
                  value={manualForm.uniqueCode}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, uniqueCode: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-mono text-xs font-bold text-black uppercase focus:outline-none focus:ring-2 focus:ring-[#FBBC05] shadow-[2px_2px_0_0_#000]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                    Full Name <span className="text-[#EA4335]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Singh"
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FBBC05] shadow-[2px_2px_0_0_#000]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                    Email Address <span className="text-[#EA4335]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikram@example.com"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FBBC05] shadow-[2px_2px_0_0_#000]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FBBC05] shadow-[2px_2px_0_0_#000]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                    College / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BIT Mesra"
                    value={manualForm.organization}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, organization: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FBBC05] shadow-[2px_2px_0_0_#000]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                  Track Target
                </label>
                <select
                  value={manualForm.track}
                  onChange={(e) => setManualForm({ ...manualForm, track: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#FBBC05] shadow-[2px_2px_0_0_#000] cursor-pointer"
                >
                  <option value="all">All Tracks (General Audience)</option>
                  <option value="flagship-dev">Flagship Dev Track</option>
                  <option value="beginner-track">Beginner Track</option>
                  <option value="conference-only">Conference Only</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  size="sm"
                  disabled={isSubmittingManual}
                  className="font-black text-xs shadow-[2px_2px_0_0_#000]"
                >
                  {isSubmittingManual ? 'Registering...' : 'Register & Admit Attendee'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* GAME RESULTS & TOURNAMENT LEADERBOARD MODAL */}
      <GameResultsModal
        game={resultsModalGame}
        isOpen={Boolean(resultsModalGame)}
        onClose={() => setResultsModalGame(null)}
        adminKey={adminKey}
      />
    </div>
  );
}
