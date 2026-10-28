'use client'; // Error boundaries must be Client Components

import { CloudOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Container } from '@/components/layout/container';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';

// Shown when a page fails to render, typically because the api is unreachable. The message never
// includes server details (Next hides them in production); the digest matches the server logs.
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('error');

  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  return (
    <Container className="flex flex-col items-center py-16">
      <EmptyState icon={CloudOff} title={t('title')} description={t('body')} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>{t('retry')}</Button>
        <Link href={ROUTES.home} className={buttonVariants({ variant: 'outline' })}>
          {t('home')}
        </Link>
      </div>
      {digest && <p className="mt-4 font-mono text-[11px] text-slate-400">{t('reference', { digest })}</p>}
    </Container>
  );
}
