'use client';

import { type ReactNode, createContext, use, useMemo, useState } from 'react';

interface ReadState {
  isUnread: (id: string, serverUnread: boolean) => boolean;
  setUnread: (id: string, unread: boolean) => void;
  markAllRead: () => Record<string, boolean>;
  restore: (snapshot: Record<string, boolean>, unreadIds: string[]) => void;
}

const ReadStateContext = createContext<ReadState | null>(null);

export function ReadStateProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [allRead, setAllReadState] = useState(false);

  const value = useMemo<ReadState>(
    () => ({
      isUnread: (id, serverUnread) => overrides[id] ?? (allRead ? false : serverUnread),
      setUnread: (id, unread) => setOverrides((current) => ({ ...current, [id]: unread })),
      markAllRead: () => {
        setOverrides({});
        setAllReadState(true);
        return overrides;
      },
      restore: (snapshot, unreadIds) => {
        setAllReadState(false);
        setOverrides({ ...snapshot, ...Object.fromEntries(unreadIds.map((id) => [id, true])) });
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
