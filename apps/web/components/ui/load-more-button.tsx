import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

type LoadMoreButtonProps = { loading: boolean; failed: boolean; onClick: () => void };

export function LoadMoreButton({ loading, failed, onClick }: LoadMoreButtonProps) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3">
      <Button variant="ghost" size="sm" onClick={onClick} disabled={loading} aria-busy={loading}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t('loadMore')}
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-red-600">
          {t('loadMoreFailed')}
        </p>
      )}
    </div>
  );
}
