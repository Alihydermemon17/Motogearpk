import { useState } from 'react';

/* ---------------------------------------------------------------
   Product media
   Falls back to a designed category panel when a product has no
   image (or the image fails to load), so the catalog never shows
   broken-image icons.
   --------------------------------------------------------------- */

/* Placeholder palette for products with no uploaded image. These are muted on
   purpose — the old bright set fought the graphite/teal identity. The labels
   only exist for whoever reads this file next, so they name the real colours. */
const THEMES = [
  { tint: '#477C78', label: 'Teal' },
  { tint: '#4A6E86', label: 'Slate' },
  { tint: '#5C7F62', label: 'Moss' },
  { tint: '#6B6480', label: 'Heather' },
  { tint: '#8A5B5B', label: 'Clay' },
  { tint: '#7A6A4A', label: 'Ochre' },
] as const;

function hashIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % mod;
}

type GlyphName = 'bulb' | 'helmet' | 'bottle' | 'box' | 'gear';

const GLYPHS: Record<GlyphName, React.ReactNode> = {
  bulb: (
    <>
      <path d="M9.2 18.2h5.6M10.4 21h3.2" />
      <path d="M12 3.2a6.2 6.2 0 0 0-3.7 11.2c.6.5.9 1.2.9 1.9v.3h5.6v-.3c0-.7.3-1.4.9-1.9A6.2 6.2 0 0 0 12 3.2Z" />
    </>
  ),
  helmet: (
    <>
      <path d="M3.4 13.4a8.6 8.6 0 0 1 17.2 0v2.4a2 2 0 0 1-2 2h-1.2" />
      <path d="M3.4 13.4h8.8l4.2 3" />
      <path d="M3.4 13.4v2.4a2 2 0 0 0 2 2h1.2" />
      <path d="M7.6 21.2h8.8" />
    </>
  ),
  bottle: (
    <>
      <path d="M8.6 8.6h5.2a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H8.6a2 2 0 0 1-2-2v-8.6a2 2 0 0 1 2-2Z" />
      <path d="M9.4 8.6V5.4h2.8M12.2 5.4V3.2" />
      <path d="M15.8 3.6 18 2.6M15.8 5.9h2.2M15.8 8.2l2.2 1" />
    </>
  ),
  box: (
    <>
      <path d="M20.8 7.9 12 3.2 3.2 7.9v8.2L12 20.8l8.8-4.7V7.9Z" />
      <path d="m3.2 7.9 8.8 4.7 8.8-4.7M12 12.6v8.2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.6v2.3M12 19.1v2.3M21.4 12h-2.3M4.9 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4" />
    </>
  ),
};

function glyphFor(seed: string): GlyphName {
  const s = seed.toLowerCase();
  if (/(light|led|bulb|headlight|projector|fog|drl|lamp|indicator|horn)/.test(s)) return 'bulb';
  if (/(helmet|jacket|glove|riding|boot|armour|armor|gear|protec)/.test(s)) return 'helmet';
  if (/(lube|clean|chain|polish|care|wax|shampoo|maintenance)/.test(s)) return 'bottle';
  if (/(luggage|box|bag|saddle|top ?case|carrier|rack|storage|tank)/.test(s)) return 'box';
  return 'gear';
}

export function ProductImage({
  src,
  alt,
  category,
  name,
  className = '',
}: {
  src?: string | null;
  alt?: string;
  category?: string;
  name?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = (src ?? '').trim();

  if (!failed && url) {
    return (
      <img
        className={className}
        src={url}
        alt={alt || name || 'Product'}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const seed = `${category ?? ''}${name ?? ''}`;
  const theme = THEMES[hashIndex(seed, THEMES.length)];
  const glyph = GLYPHS[glyphFor(`${category ?? ''} ${name ?? ''}`)];
  const label = (category || 'MotoGear PK').toUpperCase();

  return (
    <div
      className={`product-media-fallback ${className}`}
      role="img"
      aria-label={alt || name || label}
      style={{ '--media-tint': theme.tint } as React.CSSProperties}
    >
      <span className="media-grid" aria-hidden="true" />
      <span className="media-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {glyph}
        </svg>
      </span>
      <span className="media-caption">
        <b>{label}</b>
        <i>MotoGear PK</i>
      </span>
    </div>
  );
}
