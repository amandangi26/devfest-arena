import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/api/client';
import { AttendeeVerificationModal } from '../../components/auth/AttendeeVerificationModal';
import {
  Radio,
  Sparkles,
  Users,
  ArrowRight,
  Play,
  CheckCircle,
  Ticket,
  AlertTriangle,
  Flame,
} from 'lucide-react';

export function GamesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(null);
  const [isCheckingPin, setIsCheckingPin] = useState(false);

  // Verification modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingPinForAuth, setPendingPinForAuth] = useState('');

  const handleJoinPin = async (e, overridePin) => {
    e?.preventDefault();
    setPinError(null);
    const clean = (overridePin || pinInput).trim().toUpperCase();

    if (clean.length !== 6) {
      setPinError('Please enter a 6-character room PIN displayed on the auditorium stage screen.');
      return;
    }

    if (!isAuthenticated) {
      setPendingPinForAuth(clean);
      setIsAuthModalOpen(true);
      return;
    }

    setIsCheckingPin(true);
    try {
      // Validate room state with backend
      const res = await apiClient(`/rooms/${clean}/state`);
      if (res?.ok && res.state) {
        if (res.state.isEnded || res.state.status === 'GAME_OVER' || res.state.status === 'ARCHIVED') {
          setPinError(
            `🚫 Match Concluded: Room "${clean}" has already ended. Under DevFest tournament rules, late entries and replays are locked. Please look at the auditorium screen for the next active challenge!`
          );
          setIsCheckingPin(false);
          return;
        }
        navigate(`/play/${clean}`);
      } else {
        setPinError(`⚠️ Room "${clean}" not found or inactive. Look at the auditorium projector screen for the active room PIN.`);
      }
    } catch (err) {
      if (err.data?.error?.code === 'ROOM_ENDED' || err.message?.includes('ended') || err.message?.includes('concluded')) {
        setPinError(
          `🚫 Match Concluded: Room "${clean}" has already ended. Under DevFest tournament rules, late entries and replays are locked. Please look at the auditorium screen for the next active challenge!`
        );
      } else {
        setPinError(`⚠️ Room "${clean}" not found. Please verify the 6-character PIN displayed on the auditorium screen.`);
      }
    } finally {
      setIsCheckingPin(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full flex flex-col flex-1 gap-8 sm:gap-10">
      {/* ========================================================= */}
      {/* 1. HERO HEADER                                            */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden bg-white border-[3px] border-black rounded-[28px] p-6 sm:p-10 shadow-[6px_6px_0_0_#000]">
        <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 bg-[#FBBC05]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -translate-x-12 translate-y-12 w-64 h-64 bg-[#4285F4]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EA4335] text-white border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000]">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Stage Battles
              </span>
              <Badge color="yellow" size="sm">
                Radisson Blu, Ranchi
              </Badge>
              <Badge color="green" size="sm">
                800+ Builders
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight leading-tight">
              DevFest Ranchi 2026 <span className="text-[#4285F4]">Games Hub</span>
            </h1>

            <p className="text-xs sm:text-sm font-semibold text-black/70 leading-relaxed">
              Fastest-fingers-first live auditorium quizzes across Cloud, AI, Web, and Android.
              Join the synchronized stage battles directly on your phone using the room PIN shown on the auditorium projector screen!
            </p>

            {/* Attendee Status */}
            {isAuthenticated ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EEFBF3] border-[2px] border-[#34A853] rounded-xl text-xs font-black text-[#0D2818] shadow-[2px_2px_0_0_#34A853] w-fit">
                <CheckCircle className="w-4 h-4 text-[#34A853]" />
                <span>Verified Attendee: {user.displayName}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFF8E7] hover:bg-[#FBBC05] border-[2px] border-black rounded-xl text-xs font-black text-black shadow-[2px_2px_0_0_#000] transition-colors cursor-pointer w-fit"
              >
                <Ticket className="w-4 h-4 text-black" />
                <span>Verify Your DevFest Ticket to Compete for Prizes →</span>
              </button>
            )}
          </div>

          {/* Quick Stats Pill Strip */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <div className="p-3 bg-[#FFFBF0] border-[2px] border-black rounded-xl text-left shadow-[2px_2px_0_0_#000] min-w-[200px]">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-black/60 mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FBBC05]" /> Scoring Mode
              </div>
              <div className="text-sm font-black text-black">+100 Pts / Sahi Answer</div>
            </div>

            <div className="p-3 bg-[#EEF4FF] border-[2px] border-black rounded-xl text-left shadow-[2px_2px_0_0_#000] min-w-[200px]">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-black/60 mb-0.5">
                <Users className="w-3.5 h-3.5 text-[#4285F4]" /> Server Authority
              </div>
              <div className="text-sm font-black text-black">Synchronized with Stage</div>
            </div>
          </div>
        </div>
      </section>



      {/* ========================================================= */}
      {/* 3. VISUAL INSTRUCTION GUIDE (3 MODERN STEP CARDS WITH SVG) */}
      {/* ========================================================= */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-[#4285F4] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Stage Tournament Guide
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-black tracking-tight mt-0.5">
              How to Compete in DevFest Live Battles
            </h2>
          </div>
          <Badge color="yellow" size="sm" className="hidden sm:inline-flex">
            3 Simple Steps
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {/* STEP 1: WATCH STAGE SCREEN */}
          <Card
            surface="white"
            shadow="lg"
            border="thick"
            rounded="2xl"
            className="p-6 flex flex-col justify-between gap-5 border-t-[8px] border-t-[#4285F4] hover:-translate-y-1 transition-all"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#EEF4FF] text-[#4285F4] px-2.5 py-1 rounded-full border border-[#4285F4]/30">
                  Step 01
                </span>
                <span className="text-xs font-black font-mono text-black/40">STAGE</span>
              </div>

              {/* Visual SVG: Auditorium Stage Screen with Projector Beam */}
              <div className="w-full h-36 bg-[#F8F9FA] border-[2px] border-black rounded-xl flex items-center justify-center p-3 shadow-[2px_2px_0_0_#000] overflow-hidden relative">
                <svg viewBox="0 0 200 120" className="w-full h-full max-w-[180px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Projector hanging from top */}
                  <rect x="85" y="4" width="30" height="12" rx="3" fill="#202124" stroke="#000" strokeWidth="2" />
                  <line x1="100" y1="0" x2="100" y2="4" stroke="#000" strokeWidth="2" />
                  {/* Light Beam */}
                  <polygon points="90,16 110,16 160,85 40,85" fill="#4285F4" opacity="0.15" />
                  {/* Big Stage Screen */}
                  <rect x="25" y="24" width="150" height="75" rx="8" fill="#FFFFFF" stroke="#000" strokeWidth="2.5" />
                  {/* Header bar on screen */}
                  <rect x="25" y="24" width="150" height="18" rx="8" fill="#4285F4" />
                  <circle cx="37" cy="33" r="3" fill="#EA4335" />
                  <circle cx="46" cy="33" r="3" fill="#FBBC05" />
                  <circle cx="55" cy="33" r="3" fill="#34A853" />
                  <text x="100" y="36" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold" fontFamily="sans-serif">DEVFEST AUDITORIUM</text>
                  {/* PIN Display on Screen */}
                  <rect x="45" y="52" width="110" height="32" rx="6" fill="#FFF8E7" stroke="#000" strokeWidth="1.5" />
                  <text x="100" y="65" textAnchor="middle" fill="#202124" fontSize="7" fontWeight="bold" fontFamily="sans-serif">ROOM PIN CODE</text>
                  <text x="100" y="79" textAnchor="middle" fill="#EA4335" fontSize="13" fontWeight="900" fontFamily="monospace" letterSpacing="3">YXX2AX</text>
                  {/* Audience silhouette */}
                  <circle cx="60" cy="112" r="8" fill="#202124" />
                  <circle cx="100" cy="110" r="10" fill="#202124" />
                  <circle cx="140" cy="112" r="8" fill="#202124" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-black uppercase text-black leading-snug">
                  1. Watch Stage Screen
                </h3>
                <p className="text-xs font-semibold text-black/70 mt-1.5 leading-relaxed">
                  When the host initiates a round in the main auditorium, the screen displays the live 6-character room PIN.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 text-[11px] font-bold text-[#4285F4] flex items-center gap-1">
              <span>Auditorium Projector Display</span>
            </div>
          </Card>

          {/* STEP 2: ENTER ROOM PIN */}
          <Card
            surface="white"
            shadow="lg"
            border="thick"
            rounded="2xl"
            className="p-6 flex flex-col justify-between gap-5 border-t-[8px] border-t-[#FBBC05] hover:-translate-y-1 transition-all"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#FFF8E7] text-[#7A5B00] px-2.5 py-1 rounded-full border border-[#FBBC05]/40">
                  Step 02
                </span>
                <span className="text-xs font-black font-mono text-black/40">PHONE</span>
              </div>

              {/* Visual SVG: Smartphone with PIN Entry */}
              <div className="w-full h-36 bg-[#FFFBF0] border-[2px] border-black rounded-xl flex items-center justify-center p-3 shadow-[2px_2px_0_0_#000] overflow-hidden relative">
                <svg viewBox="0 0 200 120" className="w-full h-full max-w-[180px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Smartphone Frame */}
                  <rect x="65" y="6" width="70" height="108" rx="12" fill="#FFFFFF" stroke="#000" strokeWidth="2.5" />
                  {/* Notch */}
                  <rect x="90" y="10" width="20" height="4" rx="2" fill="#202124" />
                  {/* Phone Header */}
                  <text x="100" y="24" textAnchor="middle" fill="#000" fontSize="6" fontWeight="bold" fontFamily="sans-serif">JOIN DEV BATTLE</text>
                  {/* PIN Input Box on Phone */}
                  <rect x="73" y="30" width="54" height="22" rx="4" fill="#FFF8E7" stroke="#000" strokeWidth="1.5" />
                  <text x="100" y="45" textAnchor="middle" fill="#4285F4" fontSize="10" fontWeight="900" fontFamily="monospace" letterSpacing="1.5">YXX2AX</text>
                  {/* Keypad Grid (Simplified) */}
                  <g fill="#F1F3F4" stroke="#000" strokeWidth="1">
                    <rect x="74" y="57" width="15" height="12" rx="3" />
                    <rect x="92" y="57" width="15" height="12" rx="3" />
                    <rect x="110" y="57" width="15" height="12" rx="3" />
                    <rect x="74" y="72" width="15" height="12" rx="3" />
                    <rect x="92" y="72" width="15" height="12" rx="3" />
                    <rect x="110" y="72" width="15" height="12" rx="3" />
                  </g>
                  {/* Submit Button on Phone */}
                  <rect x="74" y="89" width="52" height="16" rx="4" fill="#34A853" stroke="#000" strokeWidth="1.5" />
                  <text x="100" y="100" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold" fontFamily="sans-serif">JOIN LOBBY ✓</text>
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-black uppercase text-black leading-snug">
                  2. Enter PIN on Phone
                </h3>
                <p className="text-xs font-semibold text-black/70 mt-1.5 leading-relaxed">
                  Type the 6-character PIN in the console below. Verified tickets automatically sync into the live synchronized battle.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 text-[11px] font-bold text-[#7A5B00] flex items-center gap-1">
              <span>Instant Lobby Sync</span>
            </div>
          </Card>

          {/* STEP 3: 3-2-1 RAPID FIRE & PODIUM */}
          <Card
            surface="white"
            shadow="lg"
            border="thick"
            rounded="2xl"
            className="p-6 flex flex-col justify-between gap-5 border-t-[8px] border-t-[#34A853] hover:-translate-y-1 transition-all"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#EEFBF3] text-[#34A853] px-2.5 py-1 rounded-full border border-[#34A853]/30">
                  Step 03
                </span>
                <span className="text-xs font-black font-mono text-black/40">PODIUM</span>
              </div>

              {/* Visual SVG: Winner Podium & Lightning Speed Multiplier */}
              <div className="w-full h-36 bg-[#EEFBF3] border-[2px] border-black rounded-xl flex items-center justify-center p-3 shadow-[2px_2px_0_0_#000] overflow-hidden relative">
                <svg viewBox="0 0 200 120" className="w-full h-full max-w-[180px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Speed Lightning */}
                  <path d="M100 8 L90 28 L98 28 L92 46 L108 24 L100 24 Z" fill="#FBBC05" stroke="#000" strokeWidth="1.5" />
                  {/* Trophy on Top of #1 Podium */}
                  <g transform="translate(85, 36)">
                    <rect x="8" y="2" width="14" height="12" rx="3" fill="#FBBC05" stroke="#000" strokeWidth="1.5" />
                    <path d="M5 4 C3 4 3 10 7 10" stroke="#000" strokeWidth="1.5" fill="none" />
                    <path d="M25 4 C27 4 27 10 23 10" stroke="#000" strokeWidth="1.5" fill="none" />
                    <rect x="13" y="14" width="4" height="4" fill="#202124" />
                    <rect x="10" y="18" width="10" height="3" rx="1" fill="#202124" />
                  </g>
                  {/* Podium #2 (Left) */}
                  <rect x="35" y="70" width="42" height="42" fill="#4285F4" stroke="#000" strokeWidth="2" />
                  <text x="56" y="96" textAnchor="middle" fill="#FFFFFF" fontSize="18" fontWeight="900" fontFamily="sans-serif">2</text>
                  {/* Podium #1 (Center) */}
                  <rect x="79" y="58" width="42" height="54" fill="#34A853" stroke="#000" strokeWidth="2" />
                  <text x="100" y="90" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900" fontFamily="sans-serif">1</text>
                  {/* Podium #3 (Right) */}
                  <rect x="123" y="78" width="42" height="34" fill="#EA4335" stroke="#000" strokeWidth="2" />
                  <text x="144" y="100" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="900" fontFamily="sans-serif">3</text>
                  {/* Confetti Dots */}
                  <circle cx="30" cy="30" r="3" fill="#EA4335" />
                  <circle cx="170" cy="25" r="3" fill="#4285F4" />
                  <circle cx="160" cy="45" r="2.5" fill="#34A853" />
                  <circle cx="45" cy="50" r="2" fill="#FBBC05" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-black uppercase text-black leading-snug">
                  3. Rapid Fire & Podium
                </h3>
                <p className="text-xs font-semibold text-black/70 mt-1.5 leading-relaxed">
                  Har sahi answer ke liye 100 points milte hain! Equal score hone par fastest response time se top rank decide hoti hai.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 text-[11px] font-bold text-[#34A853] flex items-center gap-1">
              <span>Auditorium Championship</span>
            </div>
          </Card>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. DEDICATED NEO-BRUTALIST PIN JOIN CONSOLE                */}
      {/* ========================================================= */}
      <section className="w-full max-w-2xl mx-auto my-2">
        <Card
          surface="white"
          shadow="xl"
          border="thick"
          rounded="2xl"
          className="p-6 sm:p-10 text-center flex flex-col items-center gap-5 border-[3.5px] border-black shadow-[8px_8px_0_0_#000]"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#FFF8E7] border-[2.5px] border-black flex items-center justify-center text-black shadow-[3px_3px_0_0_#000]">
            <Flame className="w-9 h-9 text-[#EA4335]" />
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBBC05] text-black border-[2px] border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_0_#000]">
              ⚡ Live Room Keypad
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-black tracking-tight mt-1">
              Enter Room PIN
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-black/70 max-w-md mx-auto">
              Look at the main stage screen in the auditorium for the 6-character room PIN.
            </p>
          </div>



          {/* Error Banner */}
          {pinError && (
            <div className="w-full p-4 bg-[#FFF5F5] border-[2.5px] border-[#EA4335] rounded-2xl text-xs sm:text-sm font-bold text-[#EA4335] text-left shadow-[3px_3px_0_0_#EA4335] flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[#EA4335] mt-0.5" />
              <div className="leading-relaxed">{pinError}</div>
            </div>
          )}

          {/* PIN Input Form */}
          <form onSubmit={handleJoinPin} className="w-full flex flex-col gap-4">
            <div className="relative w-full">
              <input
                type="text"
                required
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.toUpperCase());
                  setPinError(null);
                }}
                placeholder="e.g. YXX2AX"
                className="w-full text-center py-4 px-4 bg-[#FFFBF0] border-[3px] border-black rounded-2xl font-mono text-3xl sm:text-4xl font-black tracking-[0.25em] text-black placeholder:text-black/25 placeholder:tracking-widest shadow-[4px_4px_0_0_#000] focus:outline-none focus:ring-4 focus:ring-[#FBBC05] uppercase"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isCheckingPin}
              className="w-full py-4 text-sm sm:text-base font-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCheckingPin ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-white rounded-full animate-spin" />
                  <span>Connecting to Stage...</span>
                </>
              ) : (
                <>
                  <span>Enter Live Battle Arena</span>
                  <ArrowRight className="w-5 h-5 ml-1" />
                </>
              )}
            </Button>
          </form>

          {/* Security & Server Authority Guarantee */}
          <div className="w-full pt-4 border-t border-black/10 flex flex-col sm:flex-row items-center justify-between text-[11px] font-bold text-black/60 gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#34A853]" />
              Official DevFest Anti-Cheating Protection
            </span>
            <span>Server-Authoritative Clock</span>
          </div>
        </Card>
      </section>

      {/* ========================================================= */}
      {/* 5. ATTENDEE VERIFICATION MODAL                            */}
      {/* ========================================================= */}
      <AttendeeVerificationModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingPinForAuth('');
        }}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          if (pendingPinForAuth) {
            const targetPin = pendingPinForAuth;
            setPendingPinForAuth('');
            navigate(`/play/${targetPin}`);
          }
        }}
      />
    </div>
  );
}
