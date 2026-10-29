import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DeleteGameModal } from './DeleteGameModal';
import { DEVFEST_HALLS, DEVFEST_TRACKS, DEFAULT_HALL } from '../../../constants/eventConfig';
import {
  Plus,
  Trash2,
  Save,
  Clock,
  Sparkles,
  Code2,
  ArrowLeft,
  UploadCloud,
  HelpCircle,
} from 'lucide-react';

const DEFAULT_OPTIONS = [
  { id: 'opt_1', text: '' },
  { id: 'opt_2', text: '' },
  { id: 'opt_3', text: '' },
  { id: 'opt_4', text: '' },
];

const TIME_LIMIT_PRESETS = [10, 15, 20, 30, 45, 60];

const SAMPLE_QUIZ = {
  title: 'Google Cloud & AI Architecture Battle',
  description: 'Fastest fingers first for DevFest 2026 Cloud & Android experts',
  trackTarget: 'flagship-dev',
  questions: [
    {
      questionId: 'q-1',
      order: 1,
      prompt: 'Which Google Cloud service provides fully managed serverless containers with automatic scale-to-zero?',
      codeSnippet: 'gcloud run deploy my-api --image gcr.io/devfest/app:latest',
      icon: 'Cloud',
      options: [
        { id: 'opt_1', text: 'Google Compute Engine (GCE)' },
        { id: 'opt_2', text: 'Cloud Run' },
        { id: 'opt_3', text: 'Google Cloud Functions (2nd Gen)' },
        { id: 'opt_4', text: 'Google Kubernetes Engine (Standard)' },
      ],
      correctOptionId: 'opt_2',
      timeLimitSeconds: 15,
      explanation: 'Cloud Run abstracts infrastructure completely and automatically scales container instances up or to zero.',
    },
    {
      questionId: 'q-2',
      order: 2,
      prompt: 'What is the primary architectural difference between Gemini 1.5 Pro and Gemini 1.5 Flash?',
      icon: 'Sparkles',
      options: [
        { id: 'opt_1', text: 'Pro is open-source; Flash is proprietary' },
        { id: 'opt_2', text: 'Flash is optimized for low-latency & high-frequency developer workloads' },
        { id: 'opt_3', text: 'Flash only accepts raw text inputs' },
        { id: 'opt_4', text: 'Pro does not support multimodality' },
      ],
      correctOptionId: 'opt_2',
      timeLimitSeconds: 20,
      explanation: 'Gemini 1.5 Flash is lightweight and cost-effective, fine-tuned for fast inference speed.',
    },
    {
      questionId: 'q-3',
      order: 3,
      prompt: 'In modern Android Jetpack Compose, which keyword preserves state across recompositions?',
      codeSnippet: 'val count by rememberSaveable { mutableStateOf(0) }',
      icon: 'Code2',
      options: [
        { id: 'opt_1', text: 'mutableLiveDataOf()' },
        { id: 'opt_2', text: 'rememberSaveable {}' },
        { id: 'opt_3', text: 'rememberCoroutineScope()' },
        { id: 'opt_4', text: 'derivedStateOf {}' },
      ],
      correctOptionId: 'opt_2',
      timeLimitSeconds: 15,
      explanation: 'rememberSaveable survives configuration changes like screen rotations by bundling state into Android SavedState.',
    },
  ],
};

const normalizeHallName = (val) => {
  if (!val || val === 'Main Auditorium' || val.toLowerCase().includes('confrance') || val.toLowerCase().includes('conference')) {
    return 'Conference Hall';
  }
  if (val.includes('1')) return 'Hall-1';
  if (val.includes('2')) return 'Hall-2';
  return 'Conference Hall';
};

export function GameEditor({ game, onSave, onPublish, onBack, onDelete, isSaving }) {
  const [title, setTitle] = useState(game?.title || '');
  const [description, setDescription] = useState(game?.description || '');
  const [trackTarget, setTrackTarget] = useState(game?.track_target || game?.trackTarget || 'all');
  const [hallName, setHallName] = useState(() => normalizeHallName(game?.hall_name || game?.hallName));
  const [questions, setQuestions] = useState(game?.questions?.length ? game.questions : [
    {
      questionId: 'q-1',
      order: 1,
      prompt: '',
      codeSnippet: '',
      mediaUrl: '',
      icon: 'HelpCircle',
      options: DEFAULT_OPTIONS.map((o) => ({ ...o })),
      correctOptionId: 'opt_1',
      timeLimitSeconds: 15,
      explanation: '',
    },
  ]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [error, setError] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async (gameId) => {
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(gameId);
      }
      setIsDeleteModalOpen(false);
      onBack();
    } finally {
      setIsDeleting(false);
    }
  };

  const currentQ = questions[activeQuestionIdx] || questions[0];

  const handleUpdateCurrentQ = (field, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[activeQuestionIdx] = {
        ...copy[activeQuestionIdx],
        [field]: value,
      };
      return copy;
    });
  };

  const handleUpdateOption = (optIdx, text) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[activeQuestionIdx] };
      const options = [...q.options];
      options[optIdx] = { ...options[optIdx], text };
      q.options = options;
      copy[activeQuestionIdx] = q;
      return copy;
    });
  };

  const handleAddQuestion = () => {
    if (questions.length >= 15) {
      alert('Maximum of 15 questions reached per quiz.');
      return;
    }
    const newQ = {
      questionId: `q-${questions.length + 1}`,
      order: questions.length + 1,
      prompt: '',
      codeSnippet: '',
      mediaUrl: '',
      icon: 'HelpCircle',
      options: DEFAULT_OPTIONS.map((o) => ({ ...o })),
      correctOptionId: 'opt_1',
      timeLimitSeconds: 15,
      explanation: '',
    };
    setQuestions((prev) => [...prev, newQ]);
    setActiveQuestionIdx(questions.length);
  };

  const handleDeleteQuestion = (idx) => {
    if (questions.length <= 1) {
      alert('A quiz must have at least 1 question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i + 1 }));
    setQuestions(updated);
    setActiveQuestionIdx(Math.max(0, idx - 1));
  };

  const handleLoadSample = () => {
    setTitle(SAMPLE_QUIZ.title);
    setDescription(SAMPLE_QUIZ.description);
    setTrackTarget(SAMPLE_QUIZ.trackTarget);
    setHallName('Conference Hall');
    setQuestions(SAMPLE_QUIZ.questions);
    setActiveQuestionIdx(0);
  };

  const validateQuizForm = (isPublish = false) => {
    if (!title.trim() || title.trim().length < 3) {
      return 'Quiz Title must be at least 3 characters long.';
    }
    if (isPublish) {
      if (!questions || questions.length === 0) {
        return 'Cannot publish a quiz with 0 questions. Please add at least 1 question.';
      }
      if (questions.length > 15) {
        return 'Maximum question limit is 15 questions per quiz session.';
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.prompt?.trim() || q.prompt.trim().length < 5) {
          setActiveQuestionIdx(i);
          return `Question #${i + 1}: Prompt must be at least 5 characters long.`;
        }
        if (!q.options || q.options.length !== 4) {
          setActiveQuestionIdx(i);
          return `Question #${i + 1}: Must contain exactly 4 choices (A, B, C, D).`;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].text?.trim()) {
            const labels = ['A', 'B', 'C', 'D'];
            setActiveQuestionIdx(i);
            return `Question #${i + 1}: Choice [${labels[j]}] text cannot be empty.`;
          }
        }
        if (!q.correctOptionId) {
          setActiveQuestionIdx(i);
          return `Question #${i + 1}: Please mark the correct option.`;
        }
      }
    }
    return null;
  };

  const handleSaveDraft = async () => {
    const validationError = validateQuizForm(false);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        trackTarget,
        hallName,
        questions,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePublishClick = async () => {
    const validationError = validateQuizForm(true);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await onPublish({
        title: title.trim(),
        description: description.trim(),
        trackTarget,
        hallName,
        questions,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border-[2.5px] border-black rounded-xl shadow-[3px_3px_0_0_#000]">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
          </Button>
          <div>
            <span className="font-black text-sm uppercase tracking-wider text-black block">
              Quiz Editor: {title || 'Untitled Quiz'}
            </span>
            <span className="text-[10px] font-bold text-black/60">
              {questions.length} / 15 Questions Configured
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleLoadSample}>
            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[#FBBC05]" /> Load Sample Quiz
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="w-3.5 h-3.5 inline mr-1" /> Save Draft
          </Button>
          <Button variant="primary" size="sm" onClick={handlePublishClick} disabled={isSaving}>
            <UploadCloud className="w-3.5 h-3.5 inline mr-1" /> Publish Version
          </Button>

          {game?.id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="border-[#EA4335] text-[#EA4335] hover:bg-[#FFF0F0]"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1 text-[#EA4335]" /> Delete Quiz
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#FFF5F5] border-[2px] border-[#EA4335] rounded-xl text-xs font-bold text-[#EA4335]">
          {error}
        </div>
      )}

      {/* Quiz Metadata Deck */}
      <Card surface="white" shadow="md" border="thick" rounded="xl" className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
              Quiz Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Google Cloud & AI Architecture Battle"
              className="w-full px-3.5 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-bold text-sm text-black shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
              Target Track Audience
            </label>
            <select
              value={trackTarget}
              onChange={(e) => setTrackTarget(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-bold text-xs text-black shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
            >
              {DEVFEST_TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
              🏛️ Stage Auditorium / Hall
            </label>
            <select
              value={hallName}
              onChange={(e) => setHallName(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-bold text-xs text-black shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
            >
              {DEVFEST_HALLS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
            Quiz Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief tagline shown to attendees in the waiting lobby..."
            className="w-full px-3.5 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-semibold text-black shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
          />
        </div>
      </Card>

      {/* Horizontal Question Navigator Rail */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 horizontal-scroll-touch select-none">
        {questions.map((q, idx) => {
          const isActive = idx === activeQuestionIdx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveQuestionIdx(idx)}
              className={`px-3 py-1.5 rounded-full border-[2px] border-black font-black text-xs uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-black text-white shadow-[2px_2px_0_0_#FBBC05]'
                  : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[2px_2px_0_0_#000]'
              }`}
            >
              Q.{idx + 1}
            </button>
          );
        })}

        {questions.length < 15 && (
          <button
            type="button"
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border-[2px] border-black bg-[#FBBC05] text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Question Detail Card */}
      {currentQ && (
        <Card surface="white" shadow="lg" border="thick" rounded="xl" className="p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
            <div className="flex items-center gap-2">
              <Badge color="blue" size="md">
                Question {activeQuestionIdx + 1} of {questions.length}
              </Badge>
              <span className="text-xs font-bold text-black/60 font-mono">
                ID: {currentQ.questionId}
              </span>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDeleteQuestion(activeQuestionIdx)}
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Delete Question
            </Button>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#4285F4]" />
              Question Prompt *
            </label>
            <textarea
              rows={2}
              required
              value={currentQ.prompt}
              onChange={(e) => handleUpdateCurrentQ('prompt', e.target.value)}
              placeholder="e.g. Which Google Cloud service provides fully managed serverless containers?"
              className="w-full p-3 bg-[#FFFBF0] border-[2px] border-black rounded-xl font-bold text-sm text-black shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-[#FBBC05]"
            />
          </div>

          {/* Code Snippet & Media */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#34A853]" />
                Optional Code Snippet (Syntax Box)
              </label>
              <textarea
                rows={3}
                value={currentQ.codeSnippet || ''}
                onChange={(e) => handleUpdateCurrentQ('codeSnippet', e.target.value)}
                placeholder="Paste code or terminal command..."
                className="w-full p-2.5 bg-[#0D2818] text-[#34A853] border-[2px] border-black rounded-xl font-mono text-xs shadow-[2px_2px_0_0_#000] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5">
                Diagram / Image URL
              </label>
              <input
                type="text"
                value={currentQ.mediaUrl || ''}
                onChange={(e) => handleUpdateCurrentQ('mediaUrl', e.target.value)}
                placeholder="https://... diagram or architecture mockup image URL"
                className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-semibold text-black shadow-[2px_2px_0_0_#000] focus:outline-none"
              />

              {/* Time Limit Pills */}
              <div className="mt-3">
                <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#EA4335]" />
                  Time Limit (Seconds)
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIME_LIMIT_PRESETS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      onClick={() => handleUpdateCurrentQ('timeLimitSeconds', seconds)}
                      className={`px-3 py-1 rounded-full border-[1.5px] border-black text-xs font-mono font-bold cursor-pointer transition-all ${
                        currentQ.timeLimitSeconds === seconds
                          ? 'bg-[#EA4335] text-white shadow-[1.5px_1.5px_0_0_#000]'
                          : 'bg-white hover:bg-[#FFF8E7] text-black shadow-[1px_1px_0_0_#000]'
                      }`}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Colored Tactile Option Cards */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-2 flex items-center justify-between">
              <span>Multiple Choice Options (Select radio button to designate correct answer)</span>
              <span className="text-[10px] text-[#34A853] font-bold">
                ✓ Authoritative Answer Stored Server-Side Only
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {currentQ.options.map((opt, idx) => {
                const isCorrect = currentQ.correctOptionId === opt.id;
                const colors = [
                  { border: 'border-[#EA4335]', badge: 'bg-[#EA4335] text-white', label: 'Option A (Red)' },
                  { border: 'border-[#4285F4]', badge: 'bg-[#4285F4] text-white', label: 'Option B (Blue)' },
                  { border: 'border-[#FBBC05]', badge: 'bg-[#FBBC05] text-black', label: 'Option C (Yellow)' },
                  { border: 'border-[#34A853]', badge: 'bg-[#34A853] text-white', label: 'Option D (Green)' },
                ];
                const theme = colors[idx % 4];

                return (
                  <div
                    key={opt.id}
                    className={`p-3.5 bg-white border-[2.5px] ${theme.border} rounded-xl shadow-[3px_3px_0_0_#000] flex flex-col gap-2 relative transition-all ${
                      isCorrect ? 'ring-2 ring-black bg-[#FFFDF6]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black ${theme.badge}`}>
                        {theme.label}
                      </span>

                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="radio"
                          name={`correct_${activeQuestionIdx}`}
                          checked={isCorrect}
                          onChange={() => handleUpdateCurrentQ('correctOptionId', opt.id)}
                          className="w-4 h-4 accent-[#34A853] cursor-pointer"
                        />
                        <span className={`text-[11px] font-black uppercase ${isCorrect ? 'text-[#34A853]' : 'text-black/60'}`}>
                          {isCorrect ? 'Correct Answer ✓' : 'Mark Correct'}
                        </span>
                      </label>
                    </div>

                    <input
                      type="text"
                      required
                      value={opt.text}
                      onChange={(e) => handleUpdateOption(idx, e.target.value)}
                      placeholder={`Enter answer text for ${theme.label}...`}
                      className="w-full px-3 py-2 bg-[#FFFBF0] border-[1.5px] border-black rounded-lg font-bold text-xs text-black placeholder:text-black/40 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explanation note */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
              Tech Explanation Note (Revealed on stage chart breakdown)
            </label>
            <input
              type="text"
              value={currentQ.explanation || ''}
              onChange={(e) => handleUpdateCurrentQ('explanation', e.target.value)}
              placeholder="e.g. Cloud Run scales dynamically from 0 to 1,000 container instances..."
              className="w-full px-3 py-2 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-xs font-semibold text-black shadow-[2px_2px_0_0_#000] focus:outline-none"
            />
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal with Last Warning & YES/NO Buttons */}
      <DeleteGameModal
        game={game?.id ? game : null}
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
