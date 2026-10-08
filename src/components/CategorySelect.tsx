import { useId } from 'react';

export interface CategoryOption {
  id: string;
  name: string;
}

export default function CategorySelect({
  categories,
  defaultValue = null,
}: {
  categories: CategoryOption[];
  defaultValue?: string | null;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className='flex flex-col gap-1'>
      <span className='text-sm font-medium'>Category</span>
      <select
        id={id}
        name='categoryId'
        defaultValue={defaultValue ?? ''}
        className='min-h-11 rounded-md border border-border bg-surface px-3 text-base'
      >
        <option value=''>Uncategorized</option>
        {categories.map(({ id: value, name }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
