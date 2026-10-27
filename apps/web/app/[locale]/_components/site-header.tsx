import { Ticket } from 'lucide-react';
import { APP_NAME } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/features/users/api';
import { listUsers } from '@/features/users/api';
import { Container } from '@/components/layout/container';
import { DesktopNav } from '@/components/layout/desktop-nav';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { UserSwitcher } from '@/features/users/components/user-switcher';

export async function SiteHeader() {
  const [users, currentUser] = await Promise.all([listUsers(), getCurrentUser()]);
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <Container className="flex h-14 items-center gap-3 sm:h-16">
          <Link href={ROUTES.home} className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Ticket className="size-4.5" />
            </span>
            <span className="text-lg">{APP_NAME}</span>
          </Link>
          <DesktopNav isAdmin={isAdmin} />
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <UserSwitcher users={users} currentUser={currentUser} />
          </div>
        </Container>
      </header>
      <MobileTabBar isAdmin={isAdmin} />
    </>
  );
}
