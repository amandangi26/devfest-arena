import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';

/**
 * Root Application Component.
 * Integrates application-wide providers and centralized router.
 */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

export default App;
