import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Accessibility' };

const FEATURES = [
  'Every action works from the keyboard. Press ? anywhere in the app for the shortcut list, or ⌘/Ctrl-K for the command palette.',
  'Light, dark and high-contrast themes. High contrast keeps all text at 7:1 or better, and turns on by itself when your device asks for more contrast.',
  'Choose the article font (including Atkinson Hyperlegible), text size, line spacing and line length.',
  'Animations stop when your device asks for reduced motion, or when you turn on Reduce motion in Settings.',
  'Refresh results, new items and bulk actions are announced to screen readers.',
  'Unread items, saved items and feed health never rely on color alone.',
];

const KNOWN_ISSUES = [
  'Article content comes from each publisher. We keep its structure and alt text but cannot fix missing alt text or skipped heading levels in the original.',
  'Guest sessions expire after 24 hours. Create an account to keep your feeds without a time limit.',
  'We have not yet completed a full screen reader pass with NVDA or TalkBack.',
];

export default function AccessibilityPage() {
  return (
    <main id='main' className='mx-auto max-w-content px-4 py-10'>
      <h1 className='text-2xl font-bold'>Accessibility</h1>
      <p className='mt-4 text-text-secondary'>
        Frontpage aims to meet WCAG 2.1 level AA, and goes further where reading comfort matters.
      </p>
      <h2 className='mt-8 text-lg font-semibold'>What we support</h2>
      <ul className='mt-3 list-disc space-y-2 pl-6'>
        {FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <h2 className='mt-8 text-lg font-semibold'>Known limitations</h2>
      <ul className='mt-3 list-disc space-y-2 pl-6'>
        {KNOWN_ISSUES.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      <h2 className='mt-8 text-lg font-semibold'>Feedback</h2>
      <p className='mt-3'>
        If something gets in your way, please{' '}
        <a
          href='https://github.com/elshanx/frontpage/issues'
          className='font-semibold text-accent underline'
        >
          open an issue
        </a>
        . We treat accessibility problems as bugs.
      </p>
      <p className='mt-8'>
        <Link href='/' className='font-semibold text-accent underline'>
          Back to Frontpage
        </Link>
      </p>
    </main>
  );
}
