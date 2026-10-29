import { Suspense, lazy, createElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getActivityManifest } from './registry';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingState } from '../components/feedback/LoadingState';
import { ErrorState } from '../components/feedback/ErrorState';

/**
 * Cache for lazy-loaded components outside render to preserve component identity.
 * @type {Map<string, import('react').LazyExoticComponent<any>>}
 */
const lazyComponentCache = new Map();

function getLazyComponent(manifest) {
  if (!manifest || typeof manifest.loadComponent !== 'function') return null;
  if (!lazyComponentCache.has(manifest.id)) {
    lazyComponentCache.set(manifest.id, lazy(manifest.loadComponent));
  }
  return lazyComponentCache.get(manifest.id);
}

/**
 * ActivityHost handles dynamic resolution and lazy mounting of activities at /play/:activityId.
 * Validates existence, checks status, and provides error boundaries for unknown IDs.
 */
export function ActivityHost() {
  const { activityId } = useParams();
  const navigate = useNavigate();

  const manifest = activityId ? getActivityManifest(activityId) : undefined;

  // Case 1: Unknown Activity ID
  if (!manifest) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 w-full flex items-center justify-center flex-1">
        <ErrorState
          title="Activity Not Found"
          message={`The challenge identifier "${activityId}" does not exist or has not been registered in the DevFest Gaming Arena.`}
          actionLabel="Return to Arena"
          onAction={() => navigate('/arena')}
        />
      </div>
    );
  }

  // Case 2: Draft or Disabled Activity
  if (manifest.status !== 'active') {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 w-full flex items-center justify-center flex-1">
        <Card
          surface="yellowPod"
          shadow="lg"
          border="thick"
          rounded="xl"
          className="p-8 max-w-lg w-full text-center flex flex-col items-center gap-5"
        >
          <Badge color="yellow" size="md">
            Status: {manifest.status.toUpperCase()}
          </Badge>

          <h2 className="font-black text-2xl text-black uppercase tracking-tight">
            {manifest.title}
          </h2>

          <p className="text-sm text-black/70 font-medium leading-relaxed">
            This activity is currently in preparation for DevFest Ranchi 2026. Please check back during event hours.
          </p>

          <Button variant="outline" size="md" onClick={() => navigate('/arena')}>
            Back to Arena
          </Button>
        </Card>
      </div>
    );
  }

  // Case 3: Active Activity
  const ActiveComponent = getLazyComponent(manifest);

  return (
    <div className="w-full flex-1 flex flex-col">
      <Suspense fallback={<LoadingState message={`Launching ${manifest.title}...`} />}>
        {ActiveComponent ? createElement(ActiveComponent, { manifest }) : null}
      </Suspense>
    </div>
  );
}
