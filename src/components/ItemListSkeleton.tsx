export default function ItemListSkeleton() {
  return (
    <ul aria-hidden='true' className='animate-pulse'>
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index} className='flex gap-3 border-b border-border-subtle py-3'>
          <span className='size-2 shrink-0' />
          <div className='flex-1 space-y-2'>
            <div className='h-5 w-3/4 rounded bg-bg-tertiary' />
            <div className='h-4 w-1/3 rounded bg-bg-tertiary' />
            <div className='h-4 w-full rounded bg-bg-tertiary max-sm:hidden' />
          </div>
        </li>
      ))}
    </ul>
  );
}
