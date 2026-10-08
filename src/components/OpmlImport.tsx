'use client';

import { useActionState, useId, useState, useTransition } from 'react';
import {
  importOpmlAction,
  type OpmlPreviewState,
  previewOpmlAction,
} from '@/app/app/feeds/actions';
import { buttonClass } from '@/components/ConfirmDialog';
import SubmitButton from '@/components/SubmitButton';
import type { ImportStatus } from '@/lib/opml/plan';

type ImportResult = Awaited<ReturnType<typeof importOpmlAction>>;

const STATUS_LABELS: Record<ImportStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'text-success' },
  duplicate: { label: 'Duplicate in file', className: 'text-text-tertiary' },
  subscribed: { label: 'Already following', className: 'text-text-tertiary' },
};

const initialState: OpmlPreviewState = { status: 'idle' };

export default function OpmlImport() {
  const [state, formAction, isPreviewing] = useActionState(previewOpmlAction, initialState);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImporting, startImport] = useTransition();
  const id = useId();
  const rows = state.status === 'preview' ? state.rows : [];
  const newCount = rows.filter(({ status }) => status === 'new').length;

  const runImport = () =>
    startImport(async () => {
      setResult(null);
      setResult(
        await importOpmlAction(rows.map(({ url, title, category }) => ({ url, title, category })))
      );
    });

  return (
    <div className='flex flex-col gap-4'>
      <form
        action={formAction}
        onSubmit={() => setResult(null)}
        className='flex flex-col gap-3 sm:flex-row sm:items-end'
      >
        <label htmlFor={id} className='flex flex-1 flex-col gap-1'>
          <span className='text-sm font-medium'>OPML file</span>
          <input
            id={id}
            name='file'
            type='file'
            accept='.opml,.xml,text/x-opml,text/xml,application/xml'
            required
            aria-describedby={state.status === 'error' ? `${id}-error` : undefined}
            className='min-h-11 text-sm file:mr-3 file:min-h-9 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:text-sm file:font-medium'
          />
        </label>
        <SubmitButton
          isPending={isPreviewing}
          label='Preview import'
          pendingLabel='Reading file…'
        />
        <a href='/api/opml' download className={`${buttonClass} inline-flex items-center`}>
          Export OPML
        </a>
      </form>

      {state.status === 'error' && (
        <p id={`${id}-error`} role='alert' className='text-sm text-error'>
          {state.message}
        </p>
      )}

      {rows.length > 0 && !result && (
        <div className='flex flex-col gap-3'>
          <p className='text-sm text-text-secondary'>
            {rows.length} feeds in the file: {newCount} new, {rows.length - newCount} already
            following or duplicated.
          </p>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <caption className='sr-only'>Feeds in the OPML file</caption>
              <thead className='text-text-secondary'>
                <tr>
                  <th scope='col' className='py-2 pr-3 font-medium'>
                    Feed
                  </th>
                  <th scope='col' className='py-2 pr-3 font-medium'>
                    Category
                  </th>
                  <th scope='col' className='py-2 font-medium'>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  // eslint-disable-next-line react/no-array-index-key -- duplicate URLs are expected in OPML files
                  <tr key={index} className='border-t border-border-subtle'>
                    <td className='max-w-64 truncate py-2 pr-3'>{row.title ?? row.url}</td>
                    <td className='py-2 pr-3 text-text-secondary'>
                      {row.category ?? 'Uncategorized'}
                    </td>
                    <td className={`py-2 ${STATUS_LABELS[row.status].className}`}>
                      {STATUS_LABELS[row.status].label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type='button'
            onClick={runImport}
            disabled={isImporting || newCount === 0}
            className='min-h-11 self-start rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60'
          >
            {isImporting ? `Checking ${newCount} feeds…` : `Import ${newCount} feeds`}
          </button>
        </div>
      )}

      <div aria-live='polite'>
        {result && (
          <div className='rounded-lg border border-border-subtle bg-bg-secondary p-4 text-sm'>
            <p className='font-semibold'>
              {result.added} added, {result.duplicates} duplicates skipped, {result.invalid.length}{' '}
              invalid
            </p>
            {result.invalid.length > 0 && (
              <ul className='mt-2 flex flex-col gap-1'>
                {result.invalid.map(({ url, title, message }) => (
                  <li key={url}>
                    <span className='font-medium'>{title ?? url}</span>:{' '}
                    <span className='text-error'>{message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
