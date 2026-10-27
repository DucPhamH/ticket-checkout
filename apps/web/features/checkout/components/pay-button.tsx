'use client';

import { Loader2, Lock } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// Submit button that shows a spinner while the order is being created.
export function PayButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('checkout');
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" fullWidth disabled={disabled || pending}>
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
      {t('pay')}
    </Button>
  );
}
