import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../services/api/client';
import {
  Trophy,
  ArrowLeft,
  Download,
  RotateCcw,
  Users,
  Target,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  Building2,
  Medal,
  Radio,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Layers,
  ChevronRight,
} from 'lucide-react';

export function GameResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'questions'
  const [searchQuery, setSearchQuery] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartHall, setRestartHall] = useState('Conference Hall');

  const adminKey = sessionStorage.getItem('dfr26_admin_key') || '';

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient(`/games/${id}/results`, {
        headers: { 'x-admin-key': adminKey },
      });
      if (res?.ok && res.data) {
        setResultsData(res.data);
      } else {
        setError(res?.error?.message || 'Could not load tournament results.');
      }
    } catch (err) {
      setError(err?.message || 'Network error while fetching tournament results.');
    } finally {
      setLoading(false);
    }
  }, [id, adminKey]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const game = resultsData?.game;
  const session = resultsData?.session;
  const leaderboard = resultsData?.leaderboard || [];
  const questionsSummary = resultsData?.questionsSummary || [];

  // Filter leaderboard
  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.displayName?.toLowerCase().includes(query) ||
      entry.uniqueCode?.toLowerCase().includes(query) ||
      entry.organization?.toLowerCase().includes(query)
    );
  });

  // Calculate Metrics
  const totalBattlers = session?.totalParticipants || leaderboard.length;
  const winner = leaderboard[0] || null;

  const totalPossibleAnswers = questionsSummary.reduce((acc, q) => acc + (q.totalAnswers || 0), 0);
  const totalCorrectAnswers = questionsSummary.reduce((acc, q) => acc + (q.correctCount || 0), 0);
  const overallAccuracy =
    totalPossibleAnswers > 0 ? Math.round((totalCorrectAnswers / totalPossibleAnswers) * 100) : 0;

  const fastestOverallMs = leaderboard.reduce(
    (min, cur) => (cur.fastestTimeMs > 0 && cur.fastestTimeMs < min ? cur.fastestTimeMs : min),
    Infinity
  );
  const fastestSec = fastestOverallMs !== Infinity ? (fastestOverallMs / 1000).toFixed(2) + 's' : '—';

  // Excel (.xlsx) Export Handler
  const handleExportExcel = () => {
    if (!resultsData) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Match Summary
    const summaryData = [
      ['DEVFEST RANCHI 2026 - TOURNAMENT MATCH REPORT'],
      [''],
      ['Quiz Title', game?.title || ''],
      ['Game ID', game?.id || ''],
      ['Track Target', game?.trackTarget || 'all'],
      ['Room Code', session?.roomCode || 'N/A'],
      ['Auditorium / Hall', session?.hallName || 'Conference Hall'],
      ['Match Status', session?.status || 'ENDED'],
      ['Concluded At', session?.endedAt ? new Date(session.endedAt).toLocaleString() : 'N/A'],
      ['Total Participants', totalBattlers],
      ['Total Questions', questionsSummary.length],
      ['Audience Accuracy Rate', `${overallAccuracy}%`],
      ['Tournament Winner', winner ? `${winner.displayName} (${winner.uniqueCode || ''})` : 'None'],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tournament Summary');

    // Sheet 2: Complete Leaderboard
    const leaderboardRows = leaderboard.map((row) => ({
      Rank: row.rank,
      'Battler Name': row.displayName,
      'Ticket Code': row.uniqueCode || '',
      Organization: row.organization || '',
      'Final Score (Points)': row.totalScore,
      'Correct Answers': row.correctCount,
      'Total Questions': questionsSummary.length,
      'Accuracy %': questionsSummary.length > 0 ? `${Math.round((row.correctCount / questionsSummary.length) * 100)}%` : '0%',
      'Total Time (s)': row.totalTimeMs ? (row.totalTimeMs / 1000).toFixed(2) : 0,
      'Fastest Response (s)': row.fastestTimeMs ? (row.fastestTimeMs / 1000).toFixed(2) : 0,
    }));
    const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardRows);
    XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Final Leaderboard');

    // Sheet 3: Question Breakdown & Votes
    const questionRows = questionsSummary.map((q, idx) => {
      const correctOpt = q.options?.find((o) => o.id === q.correctOptionId);
      const optA = q.breakdown?.opt_1 ?? 0;
      const optB = q.breakdown?.opt_2 ?? 0;
      const optC = q.breakdown?.opt_3 ?? 0;
      const optD = q.breakdown?.opt_4 ?? 0;
      return {
        'Question #': idx + 1,
        Prompt: q.prompt,
        'Correct Answer Option': correctOpt?.text || q.correctOptionId,
        'Total Answers Submitted': q.totalAnswers,
        'Audience Correct Count': q.correctCount,
        'Accuracy %': q.totalAnswers > 0 ? `${Math.round((q.correctCount / q.totalAnswers) * 100)}%` : '0%',
        'Option A Votes': optA,
        'Option B Votes': optB,
        'Option C Votes': optC,
        'Option D Votes': optD,
        Explanation: q.explanation || '',
      };
    });
    const wsQuestions = XLSX.utils.json_to_sheet(questionRows);
    XLSX.utils.book_append_sheet(wb, wsQuestions, 'Question Analytics');

    const cleanTitle = (game?.title || 'Battle').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `DevFest_Results_${cleanTitle}_${session?.roomCode || 'Match'}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Re-start / Re-match Handler
  const handleRestartGame = async () => {
    setIsRestarting(true);
    try {
      const res = await apiClient(`/games/${id}/restart`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({
          hallName: restartHall,
          trackTarget: game?.trackTarget || 'all',
        }),
      });

      if (res?.ok && res.roomCode) {
        setShowRestartModal(false);
        // Navigate back to admin console with newly created room code
        navigate(`/admin?room=${res.roomCode}`);
      } else {
        alert(res?.error?.message || 'Failed to restart game session.');
      }
    } catch (err) {
      alert(err?.message || 'Network error while attempting to restart game.');
    } finally {
      setIsRestarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFBF0] flex items-center justify-center p-6">
        <div className="p-8 bg-white border-[3px] border-black rounded-2xl shadow-[6px_6px_0_0_#000] text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black border-t-[#4285F4] rounded-full animate-spin" />
          <h3 className="text-xl font-black uppercase text-black">Loading Match Results...</h3>
          <p className="text-xs font-semibold text-black/60">Fetching tournament leaderboard and option analytics</p>
        </div>
      </div>
    );
  }

  if (error || !resultsData) {
    return (
      <div className="min-h-screen bg-[#FFFBF0] p-6 lg:p-10 flex flex-col items-center justify-center">
        <Card surface="white" shadow="lg" border="thick" rounded="2xl" className="p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#EA4335]/10 border-2 border-black flex items-center justify-center mx-auto text-[#EA4335]">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black uppercase text-black">No Results Found</h2>
          <p className="text-xs font-bold text-black/70 leading-relaxed">
            {error || 'This battle session has not recorded any concluded match data yet.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/admin')} className="w-full justify-center">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Admin Console
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFBF0] text-black pb-16 font-sans">
      {/* Top Header Banner */}
      <header className="bg-white border-b-[3px] border-black sticky top-0 z-30 shadow-[0_3px_0_0_#000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin')}
              className="font-black text-xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1 inline" /> Back to Console
            </Button>

            <div className="h-6 w-[2px] bg-black/20 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#EA4335] text-white border border-black rounded shadow-[1px_1px_0_0_#000]">
                  🏁 Battle Concluded
                </span>
                {session?.roomCode && (
                  <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 bg-[#EEF4FF] text-[#4285F4] border border-black rounded shadow-[1px_1px_0_0_#000]">
                    PIN: {session.roomCode}
                  </span>
                )}
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#FFF8E7] text-black border border-black rounded shadow-[1px_1px_0_0_#000]">
                  🏛️ {session?.hallName || 'Conference Hall'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black mt-1">
                {game?.title || 'DevFest Stage Quiz'}
              </h1>
            </div>
          </div>

          {/* Action Buttons: Export Excel & Restart Game */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {session?.roomCode && (
              <Button
                variant="outline"
                size="sm"
                as="a"
                href={`/stage/${session.roomCode}`}
                target="_blank"
                rel="noreferrer"
                className="font-black text-xs"
              >
                <span>Stage Screen</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}

            <Button
              variant="success"
              size="sm"
              onClick={handleExportExcel}
              className="font-black text-xs shadow-[2px_2px_0_0_#000]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export Excel (.xlsx)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRestartModal(true)}
              className="font-black text-xs shadow-[2px_2px_0_0_#000] bg-[#FFF8E7] hover:bg-[#FBBC05]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-black" /> Re-Start Game
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* KPI Cards Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Winner Card */}
          <Card
            surface="white"
            shadow="md"
            border="thick"
            rounded="xl"
            className="p-4 border-l-[6px] border-l-[#FBBC05] flex items-center gap-3.5"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FFF8E7] border-[2px] border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
              <Trophy className="w-6 h-6 text-[#FBBC05]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-black/60 block">Grand Champion</span>
              <span className="font-black text-base text-black truncate block">
                {winner ? winner.displayName : 'No Submissions'}
              </span>
              <span className="text-[11px] font-bold text-[#4285F4]">
                {winner ? `${winner.totalScore} pts (${winner.uniqueCode || ''})` : '—'}
              </span>
            </div>
          </Card>

          {/* Total Battlers */}
          <Card
            surface="white"
            shadow="md"
            border="thick"
            rounded="xl"
            className="p-4 border-l-[6px] border-l-[#4285F4] flex items-center gap-3.5"
          >
            <div className="w-12 h-12 rounded-xl bg-[#EEF4FF] border-[2px] border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
              <Users className="w-6 h-6 text-[#4285F4]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-black/60 block">Total Battlers</span>
              <span className="font-mono font-black text-2xl text-black block">{totalBattlers}</span>
              <span className="text-[11px] font-bold text-black/60">Verified ticket holders</span>
            </div>
          </Card>

          {/* Accuracy */}
          <Card
            surface="white"
            shadow="md"
            border="thick"
            rounded="xl"
            className="p-4 border-l-[6px] border-l-[#34A853] flex items-center gap-3.5"
          >
            <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] border-[2px] border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
              <Target className="w-6 h-6 text-[#34A853]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-black/60 block">Audience Accuracy</span>
              <span className="font-mono font-black text-2xl text-[#34A853] block">{overallAccuracy}%</span>
              <span className="text-[11px] font-bold text-black/60">
                {totalCorrectAnswers} / {totalPossibleAnswers} answers
              </span>
            </div>
          </Card>

          {/* Fastest Speed */}
          <Card
            surface="white"
            shadow="md"
            border="thick"
            rounded="xl"
            className="p-4 border-l-[6px] border-l-[#EA4335] flex items-center gap-3.5"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FCE8E6] border-[2px] border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_#000]">
              <Clock className="w-6 h-6 text-[#EA4335]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-black/60 block">Fastest Answer</span>
              <span className="font-mono font-black text-2xl text-black block">{fastestSec}</span>
              <span className="text-[11px] font-bold text-black/60">Stage record speed</span>
            </div>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b-[2.5px] border-black gap-2">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-t-[2.5px] border-x-[2.5px] border-black rounded-t-xl transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-white text-black shadow-[0_3px_0_0_#fff] translate-y-[2px]'
                : 'bg-black/5 text-black/60 hover:bg-black/10'
            }`}
          >
            🏆 Full Leaderboard & Podium ({leaderboard.length})
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-5 py-3 font-black text-xs uppercase tracking-wider border-t-[2.5px] border-x-[2.5px] border-black rounded-t-xl transition-all ${
              activeTab === 'questions'
                ? 'bg-white text-black shadow-[0_3px_0_0_#fff] translate-y-[2px]'
                : 'bg-black/5 text-black/60 hover:bg-black/10'
            }`}
          >
            📊 Question Breakdown & Option Analytics ({questionsSummary.length})
          </button>
        </div>

        {/* TAB 1: LEADERBOARD & PODIUM */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Top 3 Podium (If participants exist) */}
            {leaderboard.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 2nd Place (Silver) */}
                {leaderboard[1] ? (
                  <Card
                    surface="white"
                    shadow="md"
                    border="thick"
                    rounded="xl"
                    className="p-5 border-t-[6px] border-t-[#BDC1C6] relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="w-8 h-8 rounded-full bg-[#F1F3F4] border-[2px] border-black font-black text-sm flex items-center justify-center shadow-[1.5px_1.5px_0_0_#000]">
                        🥈
                      </span>
                      <Badge color="blue" size="sm">
                        Rank #2
                      </Badge>
                    </div>
                    <h3 className="text-lg font-black text-black truncate">{leaderboard[1].displayName}</h3>
                    <p className="text-xs font-mono font-bold text-black/60 mb-3">
                      {leaderboard[1].uniqueCode || 'Ticket Verified'} • {leaderboard[1].organization || 'Audience'}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-black/10">
                      <span className="font-mono font-black text-xl text-[#4285F4]">
                        {leaderboard[1].totalScore} pts
                      </span>
                      <span className="text-xs font-bold text-[#34A853]">
                        {leaderboard[1].correctCount} / {questionsSummary.length} Correct
                      </span>
                    </div>
                  </Card>
                ) : (
                  <div className="hidden md:block" />
                )}

                {/* 1st Place (Gold / Champion) */}
                {leaderboard[0] && (
                  <Card
                    surface="warmWhite"
                    shadow="lg"
                    border="thick"
                    rounded="xl"
                    className="p-6 border-t-[8px] border-t-[#FBBC05] relative overflow-hidden md:-translate-y-2 shadow-[6px_6px_0_0_#000]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-10 h-10 rounded-full bg-[#FFF8E7] border-[2.5px] border-black font-black text-lg flex items-center justify-center shadow-[2px_2px_0_0_#000]">
                          👑
                        </span>
                        <Badge color="yellow" size="sm">
                          🥇 Champion
                        </Badge>
                      </div>
                      <span className="font-mono font-black text-2xl text-[#FBBC05] bg-black px-3 py-0.5 rounded-lg border border-black">
                        #{leaderboard[0].rank}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-black truncate">{leaderboard[0].displayName}</h3>
                    <p className="text-xs font-mono font-bold text-black/70 mb-4">
                      {leaderboard[0].uniqueCode || 'Ticket Verified'} • {leaderboard[0].organization || 'Audience Battler'}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t-2 border-black/15 bg-white/50 p-2 rounded-lg">
                      <div>
                        <span className="text-[10px] font-black uppercase text-black/60 block">Final Score</span>
                        <span className="font-mono font-black text-2xl text-[#4285F4]">
                          {leaderboard[0].totalScore} pts
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-black/60 block">Accuracy</span>
                        <span className="font-mono font-black text-sm text-[#34A853]">
                          {leaderboard[0].correctCount} / {questionsSummary.length} Correct
                        </span>
                      </div>
                    </div>
                  </Card>
                )}

                {/* 3rd Place (Bronze) */}
                {leaderboard[2] ? (
                  <Card
                    surface="white"
                    shadow="md"
                    border="thick"
                    rounded="xl"
                    className="p-5 border-t-[6px] border-t-[#E37400] relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="w-8 h-8 rounded-full bg-[#FEF7E0] border-[2px] border-black font-black text-sm flex items-center justify-center shadow-[1.5px_1.5px_0_0_#000]">
                        🥉
                      </span>
                      <Badge color="yellow" size="sm">
                        Rank #3
                      </Badge>
                    </div>
                    <h3 className="text-lg font-black text-black truncate">{leaderboard[2].displayName}</h3>
                    <p className="text-xs font-mono font-bold text-black/60 mb-3">
                      {leaderboard[2].uniqueCode || 'Ticket Verified'} • {leaderboard[2].organization || 'Audience'}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-black/10">
                      <span className="font-mono font-black text-xl text-[#4285F4]">
                        {leaderboard[2].totalScore} pts
                      </span>
                      <span className="text-xs font-bold text-[#34A853]">
                        {leaderboard[2].correctCount} / {questionsSummary.length} Correct
                      </span>
                    </div>
                  </Card>
                ) : (
                  <div className="hidden md:block" />
                )}
              </div>
            )}

            {/* Leaderboard Table Card */}
            <Card surface="white" shadow="lg" border="thick" rounded="xl" className="overflow-hidden">
              {/* Table Toolbar */}
              <div className="p-4 sm:p-5 border-b-[2px] border-black flex flex-wrap items-center justify-between gap-3 bg-[#FFFBF0]">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base uppercase text-black">Official Match Standings</h3>
                  <Badge color="blue" size="sm">
                    {filteredLeaderboard.length} Ranked
                  </Badge>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-black/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search battler or ticket code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border-[2px] border-black rounded-xl text-xs font-bold text-black placeholder:text-black/40 focus:outline-none shadow-[2px_2px_0_0_#000]"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold">
                  <thead>
                    <tr className="bg-black text-white font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Participant / Battler</th>
                      <th className="py-3 px-4">Ticket Code</th>
                      <th className="py-3 px-4">Organization</th>
                      <th className="py-3 px-4 text-center">Correct Answers</th>
                      <th className="py-3 px-4 text-center">Total Time</th>
                      <th className="py-3 px-4 text-right pr-6">Final Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black/10">
                    {filteredLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-black/60 font-bold">
                          No battlers found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredLeaderboard.map((row, idx) => (
                        <tr
                          key={row.attendeeId || idx}
                          className={`hover:bg-[#EEF4FF]/50 transition-colors ${
                            row.rank === 1
                              ? 'bg-[#FFF8E7]'
                              : row.rank === 2
                              ? 'bg-[#F8F9FA]'
                              : row.rank === 3
                              ? 'bg-[#FEF7E0]/60'
                              : 'bg-white'
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-mono font-black text-sm">
                            {row.rank === 1 ? '🥇 1' : row.rank === 2 ? '🥈 2' : row.rank === 3 ? '🥉 3' : `#${row.rank}`}
                          </td>
                          <td className="py-3.5 px-4 font-black text-black">
                            <div className="flex items-center gap-2">
                              <span>{row.displayName}</span>
                              {row.rank === 1 && (
                                <span className="text-[10px] bg-[#FBBC05] text-black px-1.5 py-0.5 rounded font-black border border-black">
                                  WINNER
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-black/70">
                            {row.uniqueCode || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-black/80 font-medium">
                            {row.organization || 'Attendee'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[#34A853]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {row.correctCount} / {questionsSummary.length}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs">
                            {row.totalTimeMs > 0 ? (
                              <span className="font-bold text-black/80" title={`Fastest single: ${(row.fastestTimeMs / 1000).toFixed(2)}s`}>
                                {(row.totalTimeMs / 1000).toFixed(2)}s
                              </span>
                            ) : row.fastestTimeMs > 0 ? (
                              <span>{(row.fastestTimeMs / 1000).toFixed(2)}s</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right pr-6 font-mono font-black text-base text-[#4285F4]">
                            {row.totalScore}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: QUESTION BREAKDOWN & OPTION ANALYTICS */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            {questionsSummary.map((q, idx) => {
              const totalAnswers = q.totalAnswers || 0;
              const correctCount = q.correctCount || 0;
              const accuracy = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
              const optColors = ['#EA4335', '#4285F4', '#FBBC05', '#34A853'];
              const optLabels = ['A', 'B', 'C', 'D'];

              return (
                <Card
                  key={q.questionId || idx}
                  surface="white"
                  shadow="lg"
                  border="thick"
                  rounded="2xl"
                  className="p-5 sm:p-6 space-y-4"
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-black/10">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-black text-white font-mono font-black text-xs flex items-center justify-center">
                        Q.{idx + 1}
                      </span>
                      <span className="font-mono text-xs font-bold text-black/60">
                        Total Submissions: {totalAnswers}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-black/60">Audience Accuracy:</span>
                      <span className="font-mono font-black text-sm px-2.5 py-1 bg-[#E6F4EA] text-[#34A853] border-[1.5px] border-black rounded-lg">
                        {accuracy}% ({correctCount}/{totalAnswers})
                      </span>
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <h4 className="text-base sm:text-lg font-black text-black leading-snug">
                    {q.prompt}
                  </h4>

                  {/* Code Snippet if present */}
                  {q.codeSnippet && (
                    <pre className="p-3 bg-black text-[#34A853] font-mono text-xs rounded-xl overflow-x-auto border-2 border-black">
                      <code>{q.codeSnippet}</code>
                    </pre>
                  )}

                  {/* Options with Audience Vote Distribution Bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {(q.options || []).map((opt, optIdx) => {
                      const isCorrect = opt.id === q.correctOptionId;
                      const votes = q.breakdown?.[opt.id] ?? 0;
                      const percentage = totalAnswers > 0 ? Math.round((votes / totalAnswers) * 100) : 0;
                      const color = optColors[optIdx % optColors.length];
                      const label = optLabels[optIdx % optLabels.length];

                      return (
                        <div
                          key={opt.id}
                          className={`p-3.5 rounded-xl border-[2px] transition-all relative overflow-hidden ${
                            isCorrect
                              ? 'bg-[#E6F4EA] border-[#34A853] shadow-[3px_3px_0_0_#34A853]'
                              : 'bg-white border-black shadow-[2px_2px_0_0_#000]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2 relative z-10">
                            <div className="flex items-start gap-2">
                              <span
                                className="w-6 h-6 rounded-md font-mono font-black text-xs flex items-center justify-center text-white shrink-0 border border-black"
                                style={{ backgroundColor: color }}
                              >
                                {label}
                              </span>
                              <span className="text-xs font-black text-black leading-tight">
                                {opt.text}
                              </span>
                            </div>

                            {isCorrect && (
                              <span className="shrink-0 text-[10px] font-black uppercase bg-[#34A853] text-white px-2 py-0.5 rounded border border-black flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Correct
                              </span>
                            )}
                          </div>

                          {/* Vote Bar */}
                          <div className="mt-2 relative z-10">
                            <div className="flex justify-between text-[11px] font-mono font-black text-black/70 mb-1">
                              <span>Audience Share</span>
                              <span>{votes} votes ({percentage}%)</span>
                            </div>
                            <div className="w-full h-3 bg-black/10 border border-black rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all duration-500 rounded-full"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: isCorrect ? '#34A853' : color,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Note */}
                  {q.explanation && (
                    <div className="p-3 bg-[#FFFBF0] border-[1.5px] border-black rounded-xl text-xs font-bold text-black/80 flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-[#4285F4] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black uppercase text-black block mb-0.5">Answer Explanation:</span>
                        <span>{q.explanation}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

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
                <option value="Conference Hall">Conference Hall</option>
                <option value="Hall-1">Hall-1</option>
                <option value="Hall-2">Hall-2</option>
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
                onClick={handleRestartGame}
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
