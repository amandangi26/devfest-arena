import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ArenaLayout } from '../components/layout/ArenaLayout';
import { GamesPage } from '../games/pages/GamesPage';
import { ArenaPage } from '../arena/pages/ArenaPage';
import { PlayerPage } from '../player/pages/PlayerPage';
import { StagePage } from '../stage/pages/StagePage';
import { ActivityHost } from '../activities/ActivityHost';
import { AdminGuard } from '../admin/components/AdminGuard';
import { AdminPage } from '../admin/pages/AdminPage';
import { GameResultsPage } from '../admin/pages/GameResultsPage';
import { NotFoundPage } from '../arena/pages/NotFoundPage';
import { RouterErrorPage } from '../components/feedback/RouterErrorPage';

/**
 * Centralized Application Router for DevFest Ranchi 2026 Live Game Engine.
 */
export const router = createBrowserRouter([
  // Fullscreen Stage Projector Routes (Stand-alone without marketing layout)
  {
    path: '/stage',
    element: <StagePage />,
    errorElement: <RouterErrorPage />,
  },
  {
    path: '/stage/:roomCode',
    element: <StagePage />,
    errorElement: <RouterErrorPage />,
  },

  // Main Platform Shell
  {
    path: '/',
    element: (
      <ArenaLayout>
        <Outlet />
      </ArenaLayout>
    ),
    errorElement: <RouterErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/games" replace />,
      },
      {
        path: 'games',
        element: <GamesPage />,
      },
      {
        path: 'arena',
        element: <ArenaPage />,
      },
      {
        path: 'leaderboard',
        element: <Navigate to="/arena" replace />,
      },
      // Mobile Live MCQ Player Routes
      {
        path: 'play',
        element: <PlayerPage />,
      },
      {
        path: 'play/:roomCode',
        element: <PlayerPage />,
      },
      // Generic Modular Activity Sandboxes (Future Module 2/3)
      {
        path: 'activity/:activityId',
        element: <ActivityHost />,
      },
      // Admin Operations Portal (Protected by AdminGuard)
      {
        path: 'admin',
        element: (
          <AdminGuard>
            {({ adminKey, adminEmail, handleLogout }) => (
              <AdminPage adminKey={adminKey} adminEmail={adminEmail} onLogout={handleLogout} />
            )}
          </AdminGuard>
        ),
      },
      {
        path: 'admin/games/:id/results',
        element: (
          <AdminGuard>
            <GameResultsPage />
          </AdminGuard>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
