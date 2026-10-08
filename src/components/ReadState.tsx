'use client';

import { type ReactNode, createContext, use, useMemo, useState } from 'react';

interface ReadState {
  isUnread: (id: string, serverUnread: boolean) => boolean;
  setUnread: (id: string, unread: boolean) => void;
  setAllRead: (allRead: boolean) => void;
}

const ReadStateContext = createContext<ReadState | null>(null);

export function ReadStateProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [allRead, setAllReadState] = useState(false);

  const value = useMemo<ReadState>(
    () => ({
      isUnread: (id, serverUnread) => overrides[id] ?? (allRead ? false : serverUnread),
      setUnread: (id, unread) => setOverrides((current) => ({ ...current, [id]: unread })),
      setAllRead: (next) => {
        setOverrides({});
        setAllReadState(next);
      },
    }),
    [overrides, allRead]
  );

  return <ReadStateContext value={value}>{children}</ReadStateContext>;
}

export function useReadState() {
  const state = use(ReadStateContext);
  if (!state) throw new Error('useReadState must be used inside ReadStateProvider');
  return state;
}
