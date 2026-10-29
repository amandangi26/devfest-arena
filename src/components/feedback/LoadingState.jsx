import { Card } from '../ui/Card';

/**
 * Accessible Neo-Brutalist Loading State indicator.
 */
export function LoadingState({ message = 'Loading challenge resources...' }) {
  return (
    <div className="flex items-center justify-center p-8 w-full min-h-[240px]">
      <Card
        surface="cream"
        shadow="md"
        border="base"
        rounded="xl"
        className="p-6 max-w-md w-full text-center flex flex-col items-center gap-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#4285F4] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-3.5 h-3.5 rounded-full bg-[#EA4335] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-3.5 h-3.5 rounded-full bg-[#FBBC05] animate-bounce" style={{ animationDelay: '300ms' }} />
          <span className="w-3.5 h-3.5 rounded-full bg-[#34A853] animate-bounce" style={{ animationDelay: '450ms' }} />
        </div>
        <p className="font-black text-sm text-black uppercase tracking-wider">
          {message}
        </p>
      </Card>
    </div>
  );
}
