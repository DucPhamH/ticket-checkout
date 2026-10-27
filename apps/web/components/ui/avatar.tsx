import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
