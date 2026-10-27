'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ListingDto } from '@tc/shared';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/cn';

type ListingOptionProps = {
  listing: ListingDto;
  selected: boolean;
  isOwn: boolean;
  onSelect: () => void;
};

// One selectable listing row; behaves like a radio button.
export function ListingOption({ listing, selected, isOwn, onSelect }: ListingOptionProps) {
  const t = useTranslations('event');
  const disabled = isOwn || listing.quantityAvailable === 0;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition sm:p-4',
        selected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300',
        disabled && 'cursor-not-allowed opacity-60 hover:border-slate-200',
      )}
    >
      <Avatar name={listing.seller.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{listing.seller.name}</p>
        <p className="text-xs text-slate-500">
          {isOwn ? (
            <Badge variant="brand">{t('yourListing')}</Badge>
          ) : (
            t('available', { count: listing.quantityAvailable })
          )}
        </p>
      </div>
      <div className="text-right">
        <Money amount={listing.unitPrice} className="block font-bold text-slate-900" />
        <span className="text-xs text-slate-500">{t('perTicket')}</span>
      </div>
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition',
          selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300',
        )}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}
