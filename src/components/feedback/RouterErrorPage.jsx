import { useState } from 'react';
import { useRouteError, useNavigate, Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  AlertTriangle,
  RotateCcw,
  Gamepad2,
  Trophy,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';

export function RouterErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract error details gracefully
  const errorMessage =
    error?.message ||
    error?.statusText ||
    (typeof error === 'string' ? error : 'An unexpected exception occurred during rendering.');

  const errorStack = error?.stack || null;
  const is404 = error?.status === 404;

  const handleCopy = () => {
    const text = `DevFest Error: ${errorMessage}\n\nStack:\n${errorStack || 'No stack trace available'}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF6] flex flex-col items-center justify-center p-4 sm:p-8 select-none">
      {/* Decorative Brand Dots */}
      <div className="flex items-center gap-2 mb-6">
        <span className="w-3.5 h-3.5 rounded-full bg-[#4285F4] border-[1.5px] border-black shadow-[1.5px_1.5px_0_0_#000]" />
        <span className="w-3.5 h-3.5 rounded-full bg-[#EA4335] border-[1.5px] border-black shadow-[1.5px_1.5px_0_0_#000]" />
        <span className="w-3.5 h-3.5 rounded-full bg-[#FBBC05] border-[1.5px] border-black shadow-[1.5px_1.5px_0_0_#000]" />
        <span className="w-3.5 h-3.5 rounded-full bg-[#34A853] border-[1.5px] border-black shadow-[1.5px_1.5px_0_0_#000]" />
        <span className="text-xs font-black tracking-widest text-black/60 uppercase ml-1">
          DevFest Ranchi 2026
        </span>
      </div>

      <Card
        surface="white"
        shadow="xl"
        border="thick"
        rounded="2xl"
        className="max-w-xl w-full p-6 sm:p-10 text-center flex flex-col items-center gap-5 border-[3.5px] border-black shadow-[8px_8px_0_0_#000]"
      >
        {/* Warning Icon Badge */}
        <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-[#FFF5F5] border-[3px] border-[#EA4335] flex items-center justify-center text-[#EA4335] shadow-[4px_4px_0_0_#EA4335]">
          <AlertTriangle className="w-10 h-10 sm:w-11 sm:h-11" />
        </div>

        <div className="space-y-2">
          <Badge color={is404 ? 'yellow' : 'red'} size="md">
            {is404 ? '404 • Page Not Found' : '⚡ Arena Recovery Engine'}
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-black leading-tight">
            {is404 ? 'Route Lost in Space' : 'Oops! Something Stumbled'}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-black/70 max-w-md mx-auto leading-relaxed">
            {is404
              ? 'The challenge screen or arena page you are looking for does not exist or has moved.'
              : 'The gaming arena encountered an unexpected hiccup. Your ticket status and recorded tournament points are safe in the database.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => window.location.reload()}
            className="w-full sm:flex-1 py-3.5 font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_0_#000] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload Arena</span>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/games')}
            className="w-full sm:flex-1 py-3.5 font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_0_#000] flex items-center justify-center gap-2 cursor-pointer bg-white"
          >
            <Gamepad2 className="w-4 h-4 text-[#4285F4]" />
            <span>Games Hub</span>
          </Button>
        </div>

        {/* Secondary Navigation */}
        <div className="flex items-center justify-center gap-4 text-xs font-black uppercase text-black/60 pt-1">
          <Link to="/games" className="hover:text-black hover:underline">
            Games Hub
          </Link>
          <span>•</span>
          <Link to="/arena" className="hover:text-black hover:underline flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[#FBBC05]" />
            <span>Leaderboard</span>
          </Link>
        </div>

        {/* Expandable Developer Diagnostics */}
        <div className="w-full pt-4 border-t-2 border-dashed border-black/15 text-left">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="w-full flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-black/60 hover:text-black transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-black/60" />
              Technical Error Details
            </span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="mt-3 p-3.5 bg-[#0D2818] border-[2px] border-black rounded-xl font-mono text-xs text-[#34A853] space-y-2 overflow-x-auto shadow-[2px_2px_0_0_#000] animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2 border-b border-[#34A853]/20 pb-2">
                <span className="text-[10px] text-white/70 font-bold uppercase">Exception Trace</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-[#34A853]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy Log'}</span>
                </button>
              </div>

              <div className="text-[#EA4335] font-bold break-all">
                {errorMessage}
              </div>

              {errorStack && (
                <pre className="text-[10px] text-white/60 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {errorStack}
                </pre>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 text-[11px] font-bold text-black/50 text-center">
        DevFest Ranchi 2026 Gaming Arena • Central & Eastern India Flagship Conference
      </div>
    </div>
  );
}
