'use client';

import { useState } from 'react';

export default function FeedIcon({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden='true'
        className='grid size-4 shrink-0 place-items-center rounded-sm bg-bg-tertiary text-[0.625rem] font-semibold text-text-secondary uppercase'
      >
        {title.trim().charAt(0) || '?'}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- favicons come from arbitrary feed hosts that next/image can't allowlist
    <img
      src={src}
      alt=''
      width={16}
      height={16}
      loading='lazy'
      onError={() => setFailed(true)}
      className='size-4 shrink-0 rounded-sm'
    />
  );
}
