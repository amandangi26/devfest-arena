import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

/**
 * Accessible Neo-Brutalist Empty State container.
 */
export function EmptyState({
  badge = 'Standby',
  title = 'No Entries Available',
  message = 'There are no active records or challenges available right now.',
}) {
  return (
    <div className="flex items-center justify-center p-8 w-full min-h-[280px]">
      <Card
        surface="sand"
        shadow="md"
        border="base"
        rounded="xl"
        className="p-8 max-w-md w-full text-center flex flex-col items-center gap-4"
      >
        <Badge color="yellow" size="sm">
          {badge}
        </Badge>
        <h3 className="font-black text-xl text-black uppercase tracking-tight">
          {title}
        </h3>
        <p className="text-sm text-black/70 font-medium leading-relaxed">
          {message}
        </p>
      </Card>
    </div>
  );
}
