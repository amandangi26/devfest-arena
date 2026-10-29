import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DeleteGameModal } from './DeleteGameModal';
import {
  Gamepad2,
  Plus,
  Copy,
  Archive,
  Trash2,
  Edit3,
  Layers,
  Sparkles,
  HelpCircle,
  Play,
  Trophy,
  Eye,
} from 'lucide-react';

export function GameList({
  games = [],
  onCreateNew,
  onEdit,
  onStartGame,
  onViewResults,
  onDuplicate,
  onArchive,
  onDelete,
  isLoading,
}) {
  const [deleteTargetGame, setDeleteTargetGame] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async (gameId) => {
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(gameId);
      }
      setDeleteTargetGame(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const readyCount = games.filter((g) => g.status === 'READY').length;
  const draftCount = games.filter((g) => g.status === 'DRAFT').length;
  const endedCount = games.filter((g) => g.status === 'ENDED').length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-black/60 block">Total Quizzes</span>
            <span className="text-2xl font-black text-black">{games.length}</span>
          </div>
          <Gamepad2 className="w-8 h-8 text-[#4285F4]" />
        </div>

        <div className="p-4 bg-[#EEFBF3] border-[2.5px] border-[#34A853] rounded-xl shadow-[3px_3px_0_0_#34A853] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-[#34A853] block">Ready to Launch</span>
            <span className="text-2xl font-black text-[#34A853]">{readyCount}</span>
          </div>
          <Sparkles className="w-8 h-8 text-[#34A853]" />
        </div>

        <div className="p-4 bg-[#FFFDEE] border-[2.5px] border-[#FBBC05] rounded-xl shadow-[3px_3px_0_0_#FBBC05] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-black/80 block">Draft In Progress</span>
            <span className="text-2xl font-black text-black">{draftCount}</span>
          </div>
          <Edit3 className="w-8 h-8 text-[#FBBC05]" />
        </div>

        <div className="p-4 bg-[#F2F4F8] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-black/80 block">Concluded Battles</span>
            <span className="text-2xl font-black text-black">{endedCount}</span>
          </div>
          <Trophy className="w-8 h-8 text-[#FBBC05]" />
        </div>
      </div>

      {/* Main List Deck */}
      <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-black/10">
          <div>
            <h2 className="text-lg font-black text-black uppercase tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#4285F4]" />
              Configured Game Quizzes
            </h2>
            <p className="text-xs text-black/60 font-semibold mt-0.5">
              Build up to 15-question Kahoot-style stage battles with server-authoritative timer limits.
            </p>
          </div>

          <Button variant="primary" size="sm" onClick={onCreateNew}>
            <Plus className="w-4 h-4 inline mr-1" /> Create New Quiz
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <span className="font-bold text-sm text-black/60">Loading games...</span>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-black/20 rounded-xl bg-[#FFFBF0]">
            <HelpCircle className="w-8 h-8 text-black/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-black/60 mb-3">
              No game quizzes created yet.
            </p>
            <Button variant="primary" size="sm" onClick={onCreateNew}>
              <Plus className="w-4 h-4 inline mr-1" /> Create First Quiz
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((g) => {
              const isArchived = g.status === 'ARCHIVED';
              const isEnded = g.status === 'ENDED';
              const isReady = g.status === 'READY';
              const qCount = g.questions?.length || 0;

              return (
                <div
                  key={g.id}
                  className={`p-5 bg-[#FFFDF6] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000] flex flex-col justify-between gap-4 transition-all ${
                    isArchived
                      ? 'opacity-60 bg-gray-50'
                      : isEnded
                      ? 'border-black bg-[#FAFAFA]'
                      : 'hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          color={isEnded ? 'red' : isReady ? 'green' : isArchived ? 'dark' : 'yellow'}
                          size="sm"
                        >
                          {isEnded ? '🏁 ENDED' : g.status}
                        </Badge>
                        <Badge color="sand" size="sm">
                          {(g.track_target || g.trackTarget || 'all').toUpperCase()}
                        </Badge>
                        <span className="text-[10px] font-bold text-black/80 bg-[#FFF8E7] px-2 py-0.5 rounded border border-black/20">
                          🏛️ {g.hall_name || g.hallName || 'Conference Hall'}
                        </span>
                        {isEnded && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#EA4335] bg-[#FFF0F0] px-2 py-0.5 rounded border border-[#EA4335]/40">
                            Replay Blocked
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-black/50">
                        {g.id}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-black uppercase tracking-tight leading-tight mb-1">
                      {g.title}
                    </h3>

                    <p className="text-xs text-black/70 font-semibold line-clamp-2 mb-3">
                      {g.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center gap-3 text-xs font-bold text-black/60">
                      <span>{qCount} Questions</span>
                      <span>•</span>
                      <span>MCQ Stage Battle</span>
                    </div>
                  </div>

                  {/* Primary Start Game / Launch Battle Action OR View Results */}
                  {!isArchived && (
                    isEnded ? (
                      <button
                        type="button"
                        onClick={() => onViewResults && onViewResults(g)}
                        className="w-full py-2.5 px-3 rounded-xl border-[2px] border-black bg-[#4285F4] hover:bg-[#3367D6] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[2px_2px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                        title="View Final Match Leaderboard and Question Stats"
                      >
                        <Trophy className="w-4 h-4 text-[#FBBC05] fill-[#FBBC05]" />
                        <span>Game Ended • View Results & Leaderboard</span>
                      </button>
                    ) : qCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => onStartGame && onStartGame(g)}
                        className="w-full py-2.5 px-3 rounded-xl border-[2px] border-black bg-[#34A853] hover:bg-[#2D9247] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[2px_2px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Game / Launch Room</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(g)}
                        className="w-full py-2.5 px-3 rounded-xl border-[2px] border-dashed border-black/40 bg-[#FFF8E7] hover:bg-[#FFF2D0] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[1.5px_1.5px_0_0_#000] transition-all cursor-pointer"
                        title="Add questions before launching live room"
                      >
                        <Edit3 className="w-4 h-4 text-[#B07D00]" />
                        <span>✏️ Add Questions to Launch</span>
                      </button>
                    )
                  )}

                  <div className="pt-3 border-t border-black/10 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(g)}
                      disabled={isArchived}
                    >
                      {isEnded ? (
                        <>
                          <Eye className="w-3.5 h-3.5 inline mr-1" /> View Questions
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Edit Questions
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDuplicate(g.id)}
                        className="p-2 border-[1.5px] border-black rounded-lg bg-white hover:bg-[#FFF8E7] shadow-[1px_1px_0_0_#000] cursor-pointer"
                        title="Duplicate Quiz"
                      >
                        <Copy className="w-3.5 h-3.5 text-black" />
                      </button>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => onArchive(g.id)}
                          className="p-2 border-[1.5px] border-black rounded-lg bg-white hover:bg-[#FFF5F5] shadow-[1px_1px_0_0_#000] cursor-pointer"
                          title="Archive Quiz"
                        >
                          <Archive className="w-3.5 h-3.5 text-[#EA4335]" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTargetGame(g)}
                        className="p-2 border-[1.5px] border-black rounded-lg bg-white hover:bg-[#FFF0F0] text-[#EA4335] shadow-[1px_1px_0_0_#000] hover:shadow-none hover:translate-x-[0.5px] hover:translate-y-[0.5px] transition-all cursor-pointer"
                        title="Delete Quiz Permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal with Last Warning & YES/NO Buttons */}
      <DeleteGameModal
        game={deleteTargetGame}
        isOpen={Boolean(deleteTargetGame)}
        isDeleting={isDeleting}
        onClose={() => setDeleteTargetGame(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
