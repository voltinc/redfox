/* Redfox brand marks.

   One glyph, drawn on a 32 unit grid: a fox head cut out of a rounded tile.
   The glyph is a single path with the eyes as sub-paths, so it renders as true
   negative space and sits correctly on any surface. No filters, no gradients,
   no raster fallbacks: it stays crisp from 14px favicon to billboard. */

import React from 'react';
import { cx } from '../lib/format.js';

const GLYPH = [
  'M7.4 7.6 L12.7 12.1 L16 10.6 L19.3 12.1 L24.6 7.6',
  'L23.2 18.5 L19.6 23.2 L16 24.8 L12.4 23.2 L8.8 18.5 Z',
  'M12.1 16.1 L15.2 15.2 L12.7 18 Z',
  'M19.9 16.1 L16.8 15.2 L19.3 18 Z',
].join(' ');

export function LogoMark({ size = 24, className, tone = 'accent', title = 'Redfox' }) {
  const fill = tone === 'mono' ? 'currentColor' : 'var(--accent)';
  const glyph = tone === 'mono' ? 'var(--bg)' : 'var(--bg)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cx('shrink-0', className)}
    >
      <rect x="0" y="0" width="32" height="32" rx="8.5" fill={fill} />
      <path d={GLYPH} fillRule="evenodd" fill={glyph} />
    </svg>
  );
}

export function Logo({ size = 24, withWordmark = true, className, suffix, tone = 'accent' }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} tone={tone} />
      {withWordmark ? (
        <span className="flex items-baseline gap-1.5">
          <span
            className="font-semibold tracking-[-0.035em] text-fg"
            style={{ fontSize: Math.round(size * 0.75), lineHeight: 1 }}
          >
            Redfox
          </span>
          {suffix ? (
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-dim">{suffix}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/* Compact lockup for the sidebar: glyph, name, and the workspace beneath it. */
export function LogoLockup({ workspace, size = 26, onClick }) {
  return (
    <span className={cx('flex items-center gap-2.5', onClick && 'cursor-pointer')} onClick={onClick}>
      <LogoMark size={size} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold leading-4 tracking-[-0.02em] text-fg">Redfox</span>
        <span className="block truncate text-[10.5px] leading-4 text-dim">{workspace || 'developer cloud'}</span>
      </span>
    </span>
  );
}
