import { CalendarDays, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/constants/routes';

export type NavItem = {
  href: string;
  labelKey: 'events' | 'wallet' | 'admin';
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.home, labelKey: 'events', icon: CalendarDays },
  { href: ROUTES.wallet, labelKey: 'wallet', icon: Wallet },
  { href: ROUTES.admin, labelKey: 'admin', icon: ShieldCheck, adminOnly: true },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === '/' || pathname.startsWith('/events');
  return pathname.startsWith(href);
}
