'use client';

import { useTranslations } from 'next-intl';

// An admin action's error, from the api's stable error code.
export function ActionError({ code }: { code: string }) {
  const t = useTranslations('admin');
  return (
    <p role="alert" className="text-xs text-red-600">
      {t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.UNKNOWN')}
    </p>
  );
}
