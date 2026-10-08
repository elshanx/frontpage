import { ImageResponse } from 'next/og';

export const alt = 'Frontpage: your personalized front page for tech content';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 96,
        background: '#ffffff',
        color: '#1a1d21',
      }}
    >
      <div style={{ fontSize: 36, fontWeight: 700, color: '#2563eb' }}>Frontpage</div>
      <div style={{ marginTop: 24, fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
        Your personalized front page for tech content.
      </div>
      <div style={{ marginTop: 32, fontSize: 32, color: '#57606a' }}>
        Blogs, newsletters and changelogs in one calm, organized place.
      </div>
    </div>,
    size
  );
}
