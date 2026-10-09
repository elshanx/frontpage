'use client';

import { type FormEvent, useState, useTransition } from 'react';
import type { z } from 'zod';
import { fieldErrors } from '@/lib/accounts/forms';

export default function useAuthForm<S extends z.ZodType<Record<string, string>>>(
  schema: S,
  initial: Record<string, string>
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const field = (name: string) => ({
    name,
    value: values[name] ?? '',
    error: errors[name],
    onChange: (value: string) => setValues((current) => ({ ...current, [name]: value })),
  });

  const submit =
    (action: (data: z.infer<S>) => Promise<string | null>) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = schema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return;
      }
      setErrors({});
      setFormError(null);
      startTransition(async () => {
        setFormError(await action(parsed.data));
      });
    };

  return { field, submit, formError, isPending };
}
