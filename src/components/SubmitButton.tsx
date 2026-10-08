export default function SubmitButton({
  isPending,
  label,
  pendingLabel,
}: {
  isPending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type='submit'
      disabled={isPending}
      className='min-h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60'
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}
