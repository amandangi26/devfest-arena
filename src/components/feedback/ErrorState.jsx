import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

/**
 * Accessible Neo-Brutalist Error State card.
 */
export function ErrorState({
  title = 'Something Went Wrong',
  message = 'An unexpected error occurred while preparing this view.',
  onAction,
  actionLabel = 'Return to Arena',
}) {
  return (
    <div className="flex items-center justify-center p-8 w-full min-h-[320px]">
      <Card
        surface="redPod"
        shadow="lg"
        border="thick"
        rounded="xl"
        className="p-8 max-w-lg w-full text-center flex flex-col items-center gap-5"
        role="alert"
      >
        <div className="w-14 h-14 rounded-full bg-[#EA4335] text-white border-[2.5px] border-black shadow-[3px_3px_0_0_#000] flex items-center justify-center font-black text-2xl">
          !
        </div>

        <div>
          <h2 className="font-black text-2xl text-black uppercase tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-sm text-black/70 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {onAction && (
          <Button variant="danger" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Card>
    </div>
  );
}
