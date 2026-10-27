import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold text-slate-900">{title}</p>
      {description && <p className="max-w-xs text-sm text-slate-500">{description}</p>}
    </div>
  );
}
