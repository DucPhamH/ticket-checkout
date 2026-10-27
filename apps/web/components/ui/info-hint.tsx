import { Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type InfoHintProps = { children: React.ReactNode; icon?: LucideIcon; iconClassName?: string; className?: string };

export function InfoHint({ children, icon: Icon = Info, iconClassName, className }: InfoHintProps) {
  return (
    <p className={cn('flex gap-2 rounded-xl bg-slate-100/70 p-3 text-xs leading-relaxed text-slate-600', className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0 text-slate-400', iconClassName)} />
      <span>{children}</span>
    </p>
  );
}
