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
      <footer className="bg-[#0D2818] text-white border-t-[3px] border-black py-3 sm:py-4 mt-auto w-full select-none">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center md:text-left text-xs sm:text-sm font-medium text-white/70">
          {/* Left: Copyright Notice */}
          <div>
            &copy; 2026 Google Developer Groups Ranchi. All rights reserved.
          </div>

          {/* Center: 4 Google Brand Dots */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
            <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
          </div>

          {/* Right: Made with Heart Note */}
          <div className="text-white/80">
            Made with <span className="inline-block text-[#EA4335]">❤️</span> by{' '}
            <span className="font-semibold text-white">GDG Ranchi Tech Team</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
