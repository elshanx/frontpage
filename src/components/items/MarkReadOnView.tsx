'use client';

import { useEffect } from 'react';
import { setReadAction } from '@/app/app/actions';

export default function MarkReadOnView({ id, unread }: { id: string; unread: boolean }) {
  useEffect(() => {
    if (unread) setReadAction(id, true);
  }, [id, unread]);
  return null;
}
