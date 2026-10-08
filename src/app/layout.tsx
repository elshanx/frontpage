import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Frontpage', template: '%s · Frontpage' },
  description: 'Your personalized front page for tech content.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className={inter.variable}>
      <body>
        <a
          href='#main'
          className='sr-only rounded-md bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50'
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
