const floating = 'absolute animate-float';
const tile = 'rounded-xl border border-border bg-bg-primary shadow-md';

export default function Decorations() {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-x-0 top-0 hidden h-[34rem] xl:block'
    >
      <div className={`${floating} top-16 left-[4%] [--float-tilt:-4deg]`}>
        <span className='grid size-14 -rotate-6 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30'>
          <svg viewBox='0 0 20 20' className='size-7 fill-none stroke-current stroke-2'>
            <path d='M4 4a12 12 0 0 1 12 12M4 9a7 7 0 0 1 7 7' strokeLinecap='round' />
            <circle cx='5' cy='15' r='1.5' className='fill-current stroke-none' />
          </svg>
        </span>
      </div>

      <div className={`${floating} top-64 left-[1%] [--float-tilt:3deg] [animation-delay:-2.5s]`}>
        <div className={`${tile} w-52 -rotate-3 p-3`}>
          <div className='flex items-center gap-2'>
            <span className='size-2 rounded-full bg-unread' />
            <span className='h-2 w-32 rounded-full bg-text-tertiary/60' />
          </div>
          <span className='mt-2 ml-4 block h-1.5 w-24 rounded-full bg-border' />
          <span className='mt-1.5 ml-4 block h-1.5 w-16 rounded-full bg-border' />
        </div>
      </div>

      <div className={`${floating} top-[27rem] left-[8%] [animation-delay:-4s]`}>
        <span className='block size-3 rounded-full bg-accent/40' />
      </div>

      <div className={`${floating} top-20 right-[4%] [--float-tilt:4deg] [animation-delay:-1.5s]`}>
        <div className={`${tile} w-44 rotate-3 p-3`}>
          <p className='text-[0.625rem] font-semibold tracking-wider text-text-tertiary uppercase'>
            Categories
          </p>
          {[
            ['Frontend', 'bg-accent'],
            ['Backend & DevOps', 'bg-success'],
            ['Newsletters', 'bg-warning'],
          ].map(([name, color]) => (
            <p key={name} className='mt-2 flex items-center gap-2 text-xs text-text-secondary'>
              <span className={`size-2 rounded-full ${color}`} />
              {name}
            </p>
          ))}
        </div>
      </div>

      <div className={`${floating} top-64 right-[1%] [--float-tilt:-3deg] [animation-delay:-3.5s]`}>
        <div className={`${tile} flex -rotate-3 items-center gap-2 py-2 pr-3 pl-2`}>
          <span className='flex -space-x-1.5'>
            {['bg-[#f38020]', 'bg-text-primary', 'bg-[#e8543e]'].map((color) => (
              <span
                key={color}
                className={`size-5 rounded-md border-2 border-bg-primary ${color}`}
              />
            ))}
          </span>
          <span className='text-xs font-semibold text-text-secondary'>12 feeds</span>
        </div>
      </div>

      <div className={`${floating} top-[24rem] right-[3%] [animation-delay:-5s]`}>
        <span className='inline-flex -rotate-3 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-subtle px-3 py-1.5 text-xs font-semibold text-accent shadow-md'>
          <span className='size-1.5 rounded-full bg-accent' />3 new
        </span>
      </div>

      <div className={`${floating} top-8 right-[22%] [animation-delay:-6s]`}>
        <span className='block size-2 rounded-full bg-success/50' />
      </div>
    </div>
  );
}
