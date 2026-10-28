'use client';

import { CheckCircle2, Loader2, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import {
  calculateOrderAmounts,
  LISTING_PRICE_MAX,
  LISTING_PRICE_MIN,
  LISTING_PRICE_STEP,
  MAX_TICKETS_PER_LISTING,
} from '@tc/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';
import { formatVnd } from '@/lib/format';
import { createListing } from '../actions';

const isValidPrice = (price: number) =>
  Number.isInteger(price) &&
  price >= LISTING_PRICE_MIN &&
  price <= LISTING_PRICE_MAX &&
  price % LISTING_PRICE_STEP === 0;

// "Sell tickets for this event". The api re-checks every rule; the form only gives early feedback.
export function SellForm({ eventId, locale }: { eventId: number; locale: string }) {
  const t = useTranslations('sell');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, pending] = useActionState(createListing, null);

  const unitPrice = Number(price);
  const valid = isValidPrice(unitPrice);
  const payout = valid ? calculateOrderAmounts(unitPrice, quantity).sellerPayout : null;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="size-4 text-brand-600" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="quantity" value={quantity} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">{t('price')}</span>
              <input
                name="unitPrice"
                type="number"
                inputMode="numeric"
                required
                min={LISTING_PRICE_MIN}
                max={LISTING_PRICE_MAX}
                step={LISTING_PRICE_STEP}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="500000"
                aria-describedby="sell-price-hint"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-brand-500"
              />
              <span id="sell-price-hint" className="block text-xs text-slate-500">
                {t('priceHint', {
                  min: formatVnd(LISTING_PRICE_MIN, locale),
                  max: formatVnd(LISTING_PRICE_MAX, locale),
                  step: formatVnd(LISTING_PRICE_STEP, locale),
                })}
              </span>
            </label>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">{t('quantity')}</span>
              <QuantityStepper
                value={quantity}
                max={MAX_TICKETS_PER_LISTING}
                onChange={setQuantity}
                decreaseLabel={t('decrease')}
                increaseLabel={t('increase')}
              />
            </div>
          </div>

          <p className="rounded-xl bg-slate-100/70 p-3 text-sm text-slate-600">
            {payout === null ? (
              t('payoutUnknown')
            ) : (
              <>
                {t('payout')}{' '}
                <span className="font-semibold text-slate-900 tabular-nums">{formatVnd(payout, locale)}</span>{' '}
                <span className="text-xs">{t('payoutNote')}</span>
              </>
            )}
          </p>

          <Button type="submit" disabled={!valid || pending} aria-busy={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('submit')}
          </Button>

          {state?.ok && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              {t('created', { quantity: state.listing.quantityTotal })}{' '}
              <Link href={ROUTES.wallet} className="font-medium underline">
                {t('viewMine')}
              </Link>
            </p>
          )}
          {state && !state.ok && (
            <p role="alert" className="text-sm text-red-600">
              {t.has(`errors.${state.errorCode}`) ? t(`errors.${state.errorCode}`) : t('errors.UNKNOWN')}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
