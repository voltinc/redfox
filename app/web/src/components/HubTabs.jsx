import React from 'react';
import { NavLink } from 'react-router-dom';
import { cx } from '../lib/format.js';

/* Shared tab strip for the grouped sections (Data, Observability, Infrastructure,
   Settings, Documentation). Keeping one implementation keeps the underline,
   spacing and hover behaviour identical everywhere. */
export default function HubTabs({ items, className }) {
  return (
    <div className={cx('sticky top-0 z-20 border-b border-line bg-base/95 backdrop-blur', className)}>
      <nav className="flex items-center gap-1 overflow-x-auto hide-scrollbar" aria-label="Section">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx(
              'relative flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-[12.5px] transition-colors',
              isActive ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {({ isActive }) => (
              <>
                {item.icon ? <item.icon size={13} strokeWidth={isActive ? 2.2 : 1.8} /> : null}
                {item.label}
                <span
                  className={cx(
                    'absolute inset-x-1.5 -bottom-px h-[2px] rounded-full transition-opacity',
                    isActive ? 'bg-accent opacity-100' : 'opacity-0',
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
