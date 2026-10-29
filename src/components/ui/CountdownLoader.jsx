import { useState, useEffect } from 'react';
import { Sparkles, Zap, Flame } from 'lucide-react';

const STEP_CONFIG = {
  3: {
    number: '3',
    label: 'READY',
    tagline: 'Get your fingers ready!',
    badgeBg: 'bg-[#4285F4]',
    circleBg: 'bg-[#EEF4FF]',
    circleShadow: 'shadow-[5px_5px_0_0_#4285F4]',
    textColor: 'text-[#4285F4]',
    icon: Sparkles,
  },
  2: {
    number: '2',
    label: 'SET',
    tagline: 'Eyes on the screen!',
    badgeBg: 'bg-[#FBBC05]',
    circleBg: 'bg-[#FFF8E7]',
    circleShadow: 'shadow-[5px_5px_0_0_#FBBC05]',
    textColor: 'text-[#B45309]',
    icon: Flame,
  },
  1: {
    number: '1',
    label: 'GO!',
    tagline: 'Fastest finger wins!',
    badgeBg: 'bg-[#EA4335]',
    circleBg: 'bg-[#FFF5F5]',
    circleShadow: 'shadow-[5px_5px_0_0_#EA4335]',
    textColor: 'text-[#EA4335]',
    icon: Zap,
  },
};

export function CountdownLoader({
  countdownEndsAt,
  currentQuestionIndex = 0,
  totalQuestions = 0,
  variant = 'mobile', // 'mobile' | 'stage'
}) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const updateCountdown = () => {
      if (countdownEndsAt) {
        const remainingMs = Math.max(0, countdownEndsAt - Date.now());
        const seconds = Math.min(3, Math.max(1, Math.ceil(remainingMs / 1000)));
        setCount(seconds);
      } else {
        setCount((prev) => (prev > 1 ? prev - 1 : 1));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [countdownEndsAt]);

  const currentStep = STEP_CONFIG[count] || STEP_CONFIG[1];
  const StepIcon = currentStep.icon;
  const isStage = variant === 'stage';

  return (
    <div className={`my-auto flex flex-col items-center justify-center text-center select-none ${isStage ? 'gap-8' : 'gap-5'}`}>
      {/* Top Question Pill */}
      {totalQuestions > 0 && (
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1 rounded-full bg-black text-[#FBBC05] border-[2px] border-black font-black text-xs uppercase tracking-widest shadow-[2px_2px_0_0_#000]">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
        </div>
      )}

      {/* Main Countdown Visual Badge */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing Outer Halo */}
        <div
          className={`absolute rounded-full animate-ping opacity-25 pointer-events-none ${
            isStage ? 'w-64 h-64' : 'w-36 h-36'
          } ${currentStep.badgeBg}`}
          style={{ animationDuration: '1.2s' }}
        />

        {/* Central Tactile Circle */}
        <div
          className={`rounded-full border-[3.5px] border-black flex flex-col items-center justify-center relative transition-all duration-200 ${
            currentStep.circleBg
          } ${currentStep.circleShadow} ${
            isStage ? 'w-60 h-60 sm:w-72 sm:h-72' : 'w-36 h-36'
          }`}
        >
          {/* Popping Number */}
          <span
            key={count}
            className={`font-mono font-black leading-none drop-shadow-[2px_2px_0_#000] animate-number-pop ${
              currentStep.textColor
            } ${isStage ? 'text-8xl sm:text-9xl' : 'text-7xl'}`}
          >
            {currentStep.number}
          </span>

          {/* Subtext Label */}
          <span
            key={`label-${count}`}
            className={`font-black uppercase tracking-widest mt-1 text-[11px] sm:text-xs animate-number-pop ${
              currentStep.textColor
            }`}
          >
            {currentStep.label}
          </span>
        </div>
      </div>

      {/* Step Pills: 3, 2, 1 Progress Track */}
      <div className="flex items-center gap-2">
        {[3, 2, 1].map((stepNum) => {
          const isActive = count <= stepNum;
          const isCurrent = count === stepNum;
          return (
            <div
              key={stepNum}
              className={`h-2.5 rounded-full border-[1.5px] border-black transition-all duration-300 ${
                isCurrent
                  ? 'w-8 bg-black shadow-[1px_1px_0_0_#FBBC05]'
                  : isActive
                  ? 'w-5 bg-black/60'
                  : 'w-2.5 bg-black/15'
              }`}
            />
          );
        })}
      </div>

      {/* Modern Status Badge */}
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FBBC05] text-black border-[2px] border-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_0_#000]">
          <StepIcon className="w-4 h-4 fill-current animate-spin" style={{ animationDuration: '4s' }} />
          <span>Question Incoming!</span>
        </span>
        <p className="text-xs font-semibold text-black/60 mt-1">
          {currentStep.tagline}
        </p>
      </div>
    </div>
  );
}
