import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AttendeeVerificationModal } from '../auth/AttendeeVerificationModal';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { Ticket, LogOut, UserCheck, ShieldCheck } from 'lucide-react';

/**
 * Sticky Navbar for DevFest Ranchi 2026 Gaming Arena.
 * Fully responsive across all viewport sizes with live authentication indicator.
 */
export function Navbar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { isAdmin, adminEmail, logoutAdmin } = useAdminAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const navLinks = [
    { label: 'Games Hub', shortLabel: 'Games', path: '/games' },
    { label: 'Leaderboard', shortLabel: 'Arena', path: '/arena' },
    { label: 'Admin', shortLabel: 'Admin', path: '/admin' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FFFBF0]/95 backdrop-blur-md border-b-[2.5px] border-black w-full">
        <div className="max-w-[1360px] mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Brand Identity */}
          <Link to="/games" className="flex items-center gap-1.5 sm:gap-3 group select-none min-w-0 shrink">
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#4285F4] border border-black shadow-[1px_1px_0_0_#000]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#EA4335] border border-black shadow-[1px_1px_0_0_#000]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#FBBC05] border border-black shadow-[1px_1px_0_0_#000]" />
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#34A853] border border-black shadow-[1px_1px_0_0_#000]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm sm:text-lg md:text-xl tracking-tight text-black leading-none truncate">
                DevFest <span className="text-[#4285F4]">Gaming</span> Arena
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold text-black/60 uppercase tracking-widest leading-none mt-0.5 truncate">
                Ranchi 2026 • Oct 31
              </span>
            </div>
          </Link>

          {/* Navigation & Status */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <nav className="flex items-center gap-1 sm:gap-2">
              {navLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      'font-black text-[10px] sm:text-xs uppercase tracking-wider px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-black text-white border-2 border-black shadow-[2px_2px_0_0_#4285F4]'
                        : 'text-black/80 hover:bg-black/5 hover:-translate-y-0.5'
                    )}
                  >
                    <span className="hidden sm:inline">{link.label}</span>
                    <span className="sm:hidden">{link.shortLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Admin Deck Indicator & Logout Trigger */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-[#FCE8E6] border-[1.5px] sm:border-[2px] border-black rounded-full px-2 sm:px-3 py-0.5 sm:py-1 shadow-[1.5px_1.5px_0_0_#EA4335]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#EA4335] shrink-0" />
                <span className="font-black text-[10px] sm:text-xs text-black truncate max-w-[80px] sm:max-w-[130px]" title={adminEmail || 'Admin'}>
                  {adminEmail ? adminEmail.split('@')[0] : 'Admin'}
                </span>
                <button
                  type="button"
                  onClick={logoutAdmin}
                  className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-[#EA4335] hover:bg-black text-white font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-colors cursor-pointer shadow-[1px_1px_0_0_#000]"
                  title="Logout from Admin Deck"
                >
                  <LogOut className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}

            {/* Attendee Profile or Verification Trigger */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-[#EEFBF3] border-[1.5px] sm:border-[2px] border-black rounded-full px-2 sm:px-3 py-0.5 sm:py-1 shadow-[1.5px_1.5px_0_0_#000]">
                <UserCheck className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
                <span className="font-black text-[10px] sm:text-xs text-black truncate max-w-[90px] sm:max-w-[120px]">
                  {user.displayName}
                </span>
                <span className="hidden md:inline font-mono font-bold text-[9px] bg-black text-white px-1.5 py-0.2 rounded-full uppercase">
                  Verified
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="p-0.5 hover:bg-black/10 rounded-full transition-colors cursor-pointer text-black/60 hover:text-black ml-0.5"
                  title="Logout"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 font-black text-[10px] sm:text-xs uppercase tracking-wider px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#FBBC05] text-black border-[1.5px] sm:border-[2px] border-black shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
              >
                <Ticket className="w-3 h-3 text-black" />
                <span>Verify Ticket</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Verification Modal */}
      <AttendeeVerificationModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
