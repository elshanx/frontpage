'use client';

import { type ReactNode, createContext, useCallback, useContext, useState } from 'react';

const AnnounceContext = createContext<(message: string) => void>(() => {});

export const useAnnounce = () => useContext(AnnounceContext);

export function Announcer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((next: string) => {
    setMessage('');
    requestAnimationFrame(() => setMessage(next));
  }, []);

  return (
    <AnnounceContext value={announce}>
      {children}
      <div aria-live='polite' className='sr-only'>
        {message}
      </div>
    </AnnounceContext>
  );
}
