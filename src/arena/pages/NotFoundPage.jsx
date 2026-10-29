import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

/**
 * 404 Not Found Page for the Gaming Arena.
 */
export function NotFoundPage() {
  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-16 flex-1 flex flex-col items-center justify-center">
      <Card
        surface="cream"
        shadow="xl"
        border="thick"
        rounded="xl"
        className="p-8 sm:p-12 max-w-lg w-full text-center flex flex-col items-center gap-6"
      >
        <div className="text-6xl font-black text-black tracking-tighter">
          404
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">
          Page Not Found
        </h1>

        <p className="text-sm text-black/70 font-medium leading-relaxed">
          The requested Gaming Arena pathway does not exist.
        </p>

        <Button variant="primary" size="md" as="a" href="/arena">
          Return to Arena
        </Button>
      </Card>
    </div>
  );
}
