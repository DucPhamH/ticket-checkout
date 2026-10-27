'use client';

import { useMemo, useState } from 'react';
import { ChevronUp, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { calculateOrderAmounts, type ListingDto } from '@tc/shared';
import { createOrder } from '../actions';
import { ListingOption } from './listing-option';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoHint } from '@/components/ui/info-hint';
import { Money } from '@/components/ui/money';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { cn } from '@/lib/cn';
import { PayButton } from './pay-button';
import { PriceBreakdown } from '@/components/pricing/price-breakdown';

type TicketPickerProps = {
  listings: ListingDto[];
  currentUserId: number;
};

// Listing selection + checkout. Desktop: sticky side card. Phone: fixed bottom bar.
export function TicketPicker({ listings, currentUserId }: TicketPickerProps) {
  const t = useTranslations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const selected = listings.find((listing) => listing.id === selectedId) ?? null;
  const amounts = useMemo(() => (selected ? calculateOrderAmounts(selected.unitPrice, quantity) : null), [selected, quantity]);

  function select(listing: ListingDto) {
    setSelectedId(listing.id);
    setQuantity(1);
  }

  const checkoutForm = selected && amounts && (
    <form action={createOrder} className="space-y-4">
      <input type="hidden" name="listingId" value={selected.id} />
      <input type="hidden" name="quantity" value={quantity} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{t('checkout.quantity')}</span>
        <QuantityStepper
          value={quantity}
          max={selected.quantityAvailable}
          onChange={setQuantity}
          decreaseLabel={t('checkout.decrease')}
          increaseLabel={t('checkout.increase')}
        />
      </div>
      <PriceBreakdown unitPrice={selected.unitPrice} quantity={quantity} amounts={amounts} />
      <PayButton />
    </form>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
      <section>
        <h2 className="mb-3 flex items-baseline justify-between text-lg font-bold">
          {t('event.listings')}
          <span className="text-sm font-normal text-slate-500">{t('event.listingsCount', { count: listings.length })}</span>
        </h2>
        <div role="radiogroup" aria-label={t('event.listings')} className="space-y-2.5">
          {listings.map((listing) => (
            <ListingOption
              key={listing.id}
              listing={listing}
              selected={listing.id === selectedId}
              isOwn={listing.seller.id === currentUserId}
              onSelect={() => select(listing)}
            />
          ))}
        </div>
        <InfoHint icon={ShieldCheck} iconClassName="text-emerald-600" className="mt-4">
          <span className="font-semibold text-slate-700">{t('checkout.escrowTitle')}</span>{' '}
          {t('checkout.escrowNote')}
        </InfoHint>
      </section>

      {/* Desktop checkout card */}
      <Card className="sticky top-24 hidden md:block">
        <CardHeader>
          <CardTitle>{t('checkout.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {checkoutForm ?? <p className="py-6 text-center text-sm text-slate-500">{t('checkout.pickListing')}</p>}
        </CardContent>
      </Card>

      {/* Phone checkout bar, sits above the bottom tab bar */}
      {selected && amounts && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 rounded-t-3xl border-t border-slate-200 bg-white p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] md:hidden">
          {expanded ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-slate-200"
                aria-label={t('checkout.hideDetails')}
              />
              {checkoutForm}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setExpanded(true)} className="flex-1 text-left">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  {t('checkout.total')} · {quantity} × <Money amount={selected.unitPrice} />
                  <ChevronUp className="size-3.5" />
                </span>
                <Money amount={amounts.total} className="text-lg font-bold" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={cn('h-12 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm')}
              >
                {t('checkout.title')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
