import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/app/[locale]/_components/site-header';
import { routing } from '@/i18n/routing';
import '../globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6528f2',
};

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('title'), description: t('description') };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={font.variable}>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider>
          <SiteHeader />
          {/* Bottom padding leaves room for the phone tab bar (+ checkout bar). */}
          <main className="pb-44 md:pb-16">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
