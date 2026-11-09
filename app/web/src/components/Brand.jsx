/* Redfox brand marks.

   A faceted fox head: five flat triangles in three tones, mirrored about the
   centre line. Read at 16px as a glyph, at 200px as a shape with depth. The
   construction is deliberately geometric, the way GitLab builds its tanuki,
   but the silhouette is a fox: tall ears, a V forehead and a pointed chin. */

import React from 'react';
import { cx } from '../lib/format.js';

const TONES = {
  deep: '#b4410a',
  mid: '#ff7000',
  light: '#ffab5e',
};

/* Points are on a 40 unit grid, mirrored around x = 20. */
const FACETS = [
  { points: '7,3.5 16.4,14.6 7,19.6', tone: 'deep' },
  { points: '33,3.5 23.6,14.6 33,19.6', tone: 'deep' },
  { points: '7,19.6 16.4,14.6 20,26.4', tone: 'mid' },
  { points: '33,19.6 23.6,14.6 20,26.4', tone: 'mid' },
  { points: '16.4,14.6 23.6,14.6 20,26.4', tone: 'light' },
];

export function LogoMark({ size = 24, className, mono = false, title = 'Redfox' }) {
  return (
    <svg
      width={size}
      height={size * 0.78}
      viewBox="0 0 40 31"
      role="img"
      aria-label={title}
      className={cx('shrink-0', className)}
    >
      {FACETS.map((facet, index) => (
        <polygon
          key={index}
          points={facet.points}
          fill={mono ? 'currentColor' : TONES[facet.tone]}
          opacity={mono ? (facet.tone === 'light' ? 0.55 : facet.tone === 'mid' ? 0.8 : 1) : 1}
        />
      ))}
    </svg>
  );
}

export function Logo({ size = 24, withWordmark = true, className, suffix, mono = false }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark size={size * 1.12} mono={mono} />
      {withWordmark ? (
        <span className="flex items-baseline gap-1.5">
          <span
            className="font-semibold tracking-[-0.045em] text-fg"
            style={{ fontSize: Math.round(size * 0.78), lineHeight: 1 }}
          >
            redfox
          </span>
          {suffix ? (
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-dim">{suffix}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function LogoLockup({ workspace, size = 26, onClick }) {
  return (
    <span className={cx('flex items-center gap-2.5', onClick && 'cursor-pointer')} onClick={onClick}>
      <LogoMark size={size * 1.1} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold leading-4 tracking-[-0.03em] text-fg">redfox</span>
        <span className="block truncate text-[10.5px] leading-4 text-dim">{workspace || 'developer cloud'}</span>
      </span>
    </span>
  );
}
