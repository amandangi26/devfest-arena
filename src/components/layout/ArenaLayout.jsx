import { Navbar } from './Navbar';

/**
 * Standard Application Shell & Layout for the Gaming Arena.
 * Incorporates tribal border gradient, grid pattern, and Ranchi theme footer.
 * Source: design.md Section 4.3 & 5.9
 */
export function ArenaLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FFFBF0] text-black w-full overflow-x-clip">
      {/* Signature Tribal Border Ribbon */}
      <div className="tribal-stripe w-full border-b-[2px] border-black" />

      {/* Sticky Navigation Bar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 bg-grid-pattern flex flex-col w-full">
        {children}
      </main>

      {/* Neo-Brutalist Forest Footer */}
      <footer className="bg-[#0D2818] text-white border-t-[3px] border-black py-6 sm:py-8 mt-auto w-full">
        <div className="max-w-[1360px] mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
            <span className="font-black text-xs sm:text-sm tracking-wide">
              DevFest Ranchi 2026 Gaming Arena
            </span>
            <span className="text-white/40 text-xs hidden sm:inline">•</span>
            <span className="text-[11px] sm:text-xs text-white/70">
              Central & Eastern India&apos;s Flagship Developer Conference
            </span>
          </div>

          {/* 4 Google Brand Dots & Signature Note */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
            <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
            <span className="text-xs font-bold text-white/70 ml-2">
              GDG Ranchi
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
