import { dateParts } from '@/lib/format';
import { cn } from '@/lib/cn';

export function EventDateBlock({ startsAt, locale, className }: { startsAt: string; locale: string; className?: string }) {
  const { day, month } = dateParts(startsAt, locale);
  return (
    <div className={cn('flex w-12 flex-col items-center rounded-xl bg-white/95 py-1.5 text-slate-900 shadow-sm', className)}>
      <span className="text-[10px] font-semibold uppercase text-brand-600">{month}</span>
      <span className="text-lg leading-none font-bold">{day}</span>
    </div>
  );
}
