import { useId } from 'react';

interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}

export default function TextField({
  label,
  name,
  value,
  onChange,
  error = undefined,
  type = 'text',
  autoComplete = undefined,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className='flex flex-col gap-1'>
      <label htmlFor={id} className='text-sm font-medium'>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className='min-h-11 rounded-md border border-border bg-surface px-3 text-base aria-invalid:border-error'
      />
      {error && (
        <p id={errorId} className='text-sm text-error'>
          {error}
        </p>
      )}
    </div>
  );
}
