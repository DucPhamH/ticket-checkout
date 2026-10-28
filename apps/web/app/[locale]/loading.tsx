import { Container } from '@/components/layout/container';

// Shown at once while a page's data loads, instead of the screen freezing on the previous page.
export default function Loading() {
  return (
    <Container className="space-y-6 py-6 sm:py-10" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200/80" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
    </Container>
  );
}
