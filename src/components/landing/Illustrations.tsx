const frame = 'h-auto w-full';
const panel = 'fill-bg-primary stroke-border';
const line = 'fill-border';
const strongLine = 'fill-text-tertiary';
const accent = 'fill-accent';

export function FrontPageIllustration() {
  return (
    <svg aria-hidden='true' viewBox='0 0 240 120' className={frame}>
      <rect x='20' y='10' width='200' height='100' rx='8' className={panel} />
      <rect x='20.5' y='10.5' width='54' height='99' rx='7.5' className='fill-bg-tertiary' />
      <rect x='30' y='22' width='34' height='6' rx='3' className={accent} />
      <rect x='30' y='36' width='28' height='5' rx='2.5' className={line} />
      <rect x='30' y='48' width='32' height='5' rx='2.5' className={line} />
      <rect x='30' y='60' width='24' height='5' rx='2.5' className={line} />
      {[22, 50, 78].map((y, index) => (
        <g key={y}>
          <circle cx='90' cy={y + 4} r='3' className={index < 2 ? accent : 'fill-transparent'} />
          <rect
            x='100'
            y={y}
            width={index === 1 ? 80 : 100}
            height='6'
            rx='3'
            className={index < 2 ? strongLine : line}
          />
          <rect x='100' y={y + 11} width='46' height='4' rx='2' className={line} />
        </g>
      ))}
    </svg>
  );
}

export function DigestIllustration() {
  return (
    <svg aria-hidden='true' viewBox='0 0 240 120' className={frame}>
      {[18, 32, 46, 60, 74, 88, 102].map((y, index) => (
        <rect
          key={y}
          x={20 + (index % 3) * 6}
          y={y - 2}
          width={44 - (index % 3) * 8}
          height='4'
          rx='2'
          className={line}
        />
      ))}
      <path
        d='M76 14 L120 46 V74 L76 106'
        className='fill-accent-subtle stroke-accent'
        strokeWidth='1.5'
        strokeLinejoin='round'
      />
      <rect x='136' y='30' width='84' height='60' rx='8' className={panel} />
      <rect x='148' y='42' width='52' height='6' rx='3' className={accent} />
      <rect x='148' y='56' width='60' height='5' rx='2.5' className={strongLine} />
      <rect x='148' y='68' width='40' height='5' rx='2.5' className={line} />
    </svg>
  );
}

function Key({
  x,
  y,
  width = 36,
  label,
  active = false,
}: {
  x: number;
  y: number;
  width?: number;
  label: string;
  active?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y + 3} width={width} height='34' rx='7' className='fill-border' />
      <rect
        x={x}
        y={y}
        width={width}
        height='34'
        rx='7'
        className={active ? 'fill-accent stroke-accent' : panel}
      />
      <text
        x={x + width / 2}
        y={y + 22}
        textAnchor='middle'
        className={`font-sans text-[13px] font-semibold ${active ? 'fill-white' : 'fill-text-secondary'}`}
      >
        {label}
      </text>
    </g>
  );
}

export function KeyboardIllustration() {
  return (
    <svg aria-hidden='true' viewBox='0 0 240 120' className={frame}>
      <Key x={38} y={18} label='J' active />
      <Key x={82} y={18} label='K' />
      <Key x={126} y={18} label='S' />
      <Key x={170} y={18} label='?' />
      <Key x={60} y={66} width={52} label='⌘' />
      <Key x={120} y={66} width={52} label='K' active />
    </svg>
  );
}

export function ReaderIllustration() {
  return (
    <svg aria-hidden='true' viewBox='0 0 240 120' className={frame}>
      <rect x='20' y='10' width='130' height='100' rx='8' className={panel} />
      <text x='34' y='42' className='fill-text-primary font-serif text-[24px]'>
        Aa
      </text>
      {[54, 66, 78, 90].map((y, index) => (
        <rect
          key={y}
          x='34'
          y={y}
          width={index === 3 ? 60 : 102}
          height='5'
          rx='2.5'
          className={line}
        />
      ))}
      {[30, 60, 90].map((y, index) => (
        <g key={y}>
          <rect x='166' y={y - 1.5} width='54' height='3' rx='1.5' className={line} />
          <rect
            x='166'
            y={y - 1.5}
            width={[38, 22, 44][index]}
            height='3'
            rx='1.5'
            className={accent}
          />
          <circle
            cx={166 + [38, 22, 44][index]}
            cy={y}
            r='6'
            className='fill-bg-primary stroke-accent'
            strokeWidth='2'
          />
        </g>
      ))}
    </svg>
  );
}
