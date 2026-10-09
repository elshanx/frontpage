'use client';

import { type ReactNode, useId, useRef } from 'react';

interface ConfirmDialogProps {
  trigger: string;
  triggerLabel: string;
  title: string;
  children: ReactNode;
  confirm: string;
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
}

export const buttonClass =
  'min-h-9 rounded-md border border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:min-h-11';

export default function ConfirmDialog({
  trigger,
  triggerLabel,
  title,
  children,
  confirm,
  action,
  fields,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type='button'
        aria-label={triggerLabel}
        onClick={() => dialog.current?.showModal()}
        className={buttonClass}
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className='m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-surface p-5 text-text-primary shadow-lg backdrop:bg-black/40'
      >
        <h2 id={titleId} className='text-lg font-semibold'>
          {title}
        </h2>
        <div className='mt-2 text-sm text-text-secondary'>{children}</div>
        <form
          action={async (formData) => {
            await action(formData);
            dialog.current?.close();
          }}
          className='mt-5 flex justify-end gap-2'
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type='hidden' name={name} value={value} />
          ))}
          <button type='button' onClick={() => dialog.current?.close()} className={buttonClass}>
            Cancel
          </button>
          <button
            type='submit'
            className='min-h-9 rounded-md bg-error px-3 text-sm font-semibold text-white pointer-coarse:min-h-11'
          >
            {confirm}
          </button>
        </form>
      </dialog>
    </>
  );
}
