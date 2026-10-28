import { useTranslations } from 'next-intl';
import type { MyListingDto } from '@tc/shared';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';
import { formatDateTime, formatVnd } from '@/lib/format';
import { LISTING_STATUS_VARIANT } from '../constants';
import { WithdrawButton } from './withdraw-button';

export function MyListingRow({ listing, locale }: { listing: MyListingDto; locale: string }) {
  const t = useTranslations();
  return (
    <li className="space-y-2 px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={ROUTES.event(listing.event.id)}
            className="block truncate text-sm font-medium text-slate-900 hover:underline"
          >
            {listing.event.name}
          </Link>
          <p className="truncate text-xs text-slate-500">
            #{listing.id} · {formatVnd(listing.unitPrice, locale)} {t('event.perTicket')} ·{' '}
            {formatDateTime(listing.event.startsAt, locale)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
            {t('sell.counts', {
              available: listing.quantityAvailable,
              reserved: listing.ticketsReserved,
              sold: listing.ticketsSold,
              total: listing.quantityTotal,
            })}
          </p>
        </div>
        <Badge variant={LISTING_STATUS_VARIANT[listing.status]}>{t(`status.listing.${listing.status}`)}</Badge>
      </div>
      {listing.status === 'ACTIVE' && <WithdrawButton listingId={listing.id} />}
    </li>
  );
}
