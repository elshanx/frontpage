'use client';

import { useActionState, useId, useRef, useState, useTransition } from 'react';
import {
  createCategoryAction,
  deleteCategoryAction,
  type FormState,
  moveCategoryAction,
  renameCategoryAction,
} from '@/app/app/feeds/actions';
import ConfirmDialog, { buttonClass } from '@/components/ConfirmDialog';

interface ManagedCategory {
  id: string;
  name: string;
  feedCount: number;
}

const initialState: FormState = { error: null };
const inputClass =
  'min-h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base aria-invalid:border-error pointer-coarse:min-h-11';
const feedCountLabel = (count: number) => `${count} ${count === 1 ? 'feed' : 'feeds'}`;

function NameForm({
  action,
  label,
  submit,
  defaultValue = '',
  hidden = {},
  onDone = undefined,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  submit: string;
  defaultValue?: string;
  hidden?: Record<string, string>;
  onDone?: () => void;
}) {
  const id = useId();
  const [state, formAction, isPending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const next = await action(previous, formData);
      if (!next.error) onDone?.();
      return next;
    },
    initialState
  );
  return (
    <form action={formAction} className='flex flex-col gap-1'>
      <div className='flex gap-2'>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type='hidden' name={name} value={value} />
        ))}
        <label htmlFor={id} className='sr-only'>
          {label}
        </label>
        <input
          id={id}
          name='name'
          required
          maxLength={40}
          defaultValue={defaultValue}
          placeholder={label}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? `${id}-error` : undefined}
          className={inputClass}
        />
        <button type='submit' disabled={isPending} className={buttonClass}>
          {submit}
        </button>
      </div>
      {state.error && (
        <p id={`${id}-error`} role='alert' className='text-sm text-error'>
          {state.error}
        </p>
      )}
    </form>
  );
}

function CategoryRow({
  category,
  isFirst,
  isLast,
}: {
  category: ManagedCategory;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [isMoving, startMove] = useTransition();
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);

  const move = (direction: 'up' | 'down') =>
    startMove(async () => {
      await moveCategoryAction(category.id, direction);
      const same = direction === 'up' ? up.current : down.current;
      const other = direction === 'up' ? down.current : up.current;
      (same?.disabled ? other : same)?.focus();
    });

  return (
    <li className='flex flex-col gap-2 border-b border-border-subtle py-3 sm:flex-row sm:items-center'>
      <div className='min-w-0 flex-1'>
        {renaming ? (
          <NameForm
            action={renameCategoryAction}
            label={`New name for ${category.name}`}
            submit='Save'
            defaultValue={category.name}
            hidden={{ id: category.id }}
            onDone={() => setRenaming(false)}
          />
        ) : (
          <p>
            <span className='font-medium'>{category.name}</span>{' '}
            <span className='text-sm text-text-tertiary'>{feedCountLabel(category.feedCount)}</span>
          </p>
        )}
      </div>
      <div className='flex flex-wrap gap-2'>
        <button
          ref={up}
          type='button'
          onClick={() => move('up')}
          disabled={isFirst || isMoving}
          aria-label={`Move ${category.name} up`}
          className={buttonClass}
        >
          <span aria-hidden='true'>↑</span>
        </button>
        <button
          ref={down}
          type='button'
          onClick={() => move('down')}
          disabled={isLast || isMoving}
          aria-label={`Move ${category.name} down`}
          className={buttonClass}
        >
          <span aria-hidden='true'>↓</span>
        </button>
        <button
          type='button'
          onClick={() => setRenaming((value) => !value)}
          aria-expanded={renaming}
          aria-label={renaming ? `Cancel renaming ${category.name}` : `Rename ${category.name}`}
          className={buttonClass}
        >
          {renaming ? 'Cancel' : 'Rename'}
        </button>
        <ConfirmDialog
          trigger='Delete'
          triggerLabel={`Delete ${category.name}`}
          title={`Delete ${category.name}?`}
          confirm='Delete'
          action={deleteCategoryAction}
          fields={{ id: category.id }}
        >
          {category.feedCount > 0
            ? `Its ${feedCountLabel(category.feedCount)} will move to Uncategorized.`
            : 'It has no feeds.'}
        </ConfirmDialog>
      </div>
    </li>
  );
}

export default function CategoryManager({
  categories,
  uncategorizedCount,
}: {
  categories: ManagedCategory[];
  uncategorizedCount: number;
}) {
  return (
    <div className='flex flex-col gap-3'>
      <NameForm action={createCategoryAction} label='New category name' submit='Add category' />
      <ul>
        {categories.map((category, index) => (
          <CategoryRow
            key={category.id}
            category={category}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
          />
        ))}
        <li className='py-3'>
          <span className='font-medium'>Uncategorized</span>{' '}
          <span className='text-sm text-text-tertiary'>{feedCountLabel(uncategorizedCount)}</span>
        </li>
      </ul>
    </div>
  );
}
