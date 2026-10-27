const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatVnd(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

// Parts for the calendar-style date block on event cards.
export function dateParts(iso: string, locale: string) {
  const date = new Date(iso);
  const tag = locale === 'vi' ? 'vi-VN' : 'en-GB';
  return {
    day: new Intl.DateTimeFormat(tag, { day: '2-digit', timeZone: TIME_ZONE }).format(date),
    // Vietnamese short months ("thg 12") are too long for the date block, so use "T12".
    month:
      locale === 'vi'
        ? `T${new Intl.DateTimeFormat(tag, { month: 'numeric', timeZone: TIME_ZONE }).format(date)}`
        : new Intl.DateTimeFormat(tag, { month: 'short', timeZone: TIME_ZONE }).format(date),
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
