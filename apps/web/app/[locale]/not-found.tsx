import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/layout/container';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <Container className="flex flex-col items-center py-16">
      <EmptyState icon={SearchX} title={t('title')} />
      <Link href={ROUTES.home} className={buttonVariants({ variant: 'outline' })}>
        {t('back')}
      </Link>
    </Container>
  );
}
