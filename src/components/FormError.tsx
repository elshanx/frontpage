export default function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role='alert' className='rounded-md bg-bg-tertiary px-3 py-2 text-sm text-error'>
      {message}
    </p>
  );
}
