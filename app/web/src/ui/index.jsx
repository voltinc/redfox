import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Info, Loader2, Search, X,
} from 'lucide-react';
import { cx, STATUS_TONE } from '../lib/format.js';
import { copyText } from '../lib/format.js';

/* ------------------------------------------------------------------ buttons */
const BUTTON_VARIANTS = {
  primary: 'bg-accent text-[#0b0b0c] hover:bg-accent2 border border-transparent font-medium',
  secondary: 'bg-raised text-fg border border-line hover:border-strong hover:bg-[#191a1d]',
  ghost: 'bg-transparent text-muted border border-transparent hover:text-fg hover:bg-raised',
  outline: 'bg-transparent text-fg border border-line hover:border-strong hover:bg-raised',
  danger: 'bg-transparent text-danger border border-[#3a2222] hover:bg-[#1e1214] hover:border-danger/60',
  'danger-solid': 'bg-danger text-[#0b0b0c] border border-transparent hover:opacity-90 font-medium',
};
const BUTTON_SIZES = {
  xs: 'h-6 px-2 text-xs gap-1 rounded',
  sm: 'h-7 px-2.5 text-sm gap-1.5 rounded',
  md: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  lg: 'h-9 px-4 text-base gap-2 rounded-md',
};

export function Button({
  variant = 'secondary', size = 'md', className, loading, icon: Icon, children, iconRight, ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-colors duration-100',
        'disabled:cursor-not-allowed disabled:opacity-45',
        BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
      )}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : Icon ? <Icon size={13} strokeWidth={2} /> : null}
      {children}
      {iconRight}
    </button>
  );
}

export function IconButton({ label, icon: Icon, size = 14, className, tone = 'muted', ...props }) {
  const tones = {
    muted: 'text-dim hover:text-fg hover:bg-raised',
    default: 'text-muted hover:text-fg hover:bg-raised',
    danger: 'text-dim hover:text-danger hover:bg-[#1e1214]',
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors', tones[tone], className)}
    >
      <Icon size={size} strokeWidth={1.9} />
    </button>
  );
}

/* ------------------------------------------------------------------- badges */
const TONES = {
  neutral: 'border-line bg-raised text-muted',
  success: 'border-[#1c3a22] bg-[#0f1c13] text-success',
  danger: 'border-[#3d2222] bg-[#1d1213] text-danger',
  warn: 'border-[#3a2f16] bg-[#1d1a10] text-warn',
  info: 'border-[#1e3040] bg-[#101a22] text-info',
  accent: 'border-[#43261e] bg-[#1d1210] text-accent',
};

export function Badge({ tone = 'neutral', children, className, icon: Icon, mono }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-2xs font-medium leading-4',
      mono && 'font-mono', TONES[tone], className,
    )}>
      {Icon ? <Icon size={10} strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral', pulse = false, className }) {
  const colors = {
    neutral: 'bg-dim', success: 'bg-success', danger: 'bg-danger', warn: 'bg-warn', info: 'bg-info', accent: 'bg-accent',
  };
  return <span className={cx('inline-block h-[6px] w-[6px] rounded-full', colors[tone], pulse && 'animate-pulse2', className)} />;
}

export function StatusBadge({ status, label }) {
  const tone = STATUS_TONE[status] || 'neutral';
  const text = label || String(status || 'unknown').replace(/_/g, ' ');
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded border px-1.5 py-[1px] text-2xs font-medium capitalize leading-4',
      TONES[tone],
    )}>
      <Dot tone={tone} pulse={['building', 'deploying', 'queued', 'restarting'].includes(status)} />
      {text}
    </span>
  );
}

/* -------------------------------------------------------------------- inputs */
const fieldBase =
  'w-full rounded-md border border-line bg-base px-2.5 text-base text-fg placeholder:text-dim ' +
  'transition-colors focus:border-strong focus:outline-none focus:ring-0 disabled:opacity-50';

export function Input({ className, mono, icon: Icon, ...props }) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
        <input {...props} className={cx(fieldBase, 'h-8 pl-7.5', 'pl-[30px]', mono && 'font-mono', className)} />
      </div>
    );
  }
  return <input {...props} className={cx(fieldBase, 'h-8', mono && 'font-mono text-sm', className)} />;
}

export function Textarea({ className, mono, ...props }) {
  return <textarea {...props} className={cx(fieldBase, 'py-2 leading-5', mono && 'font-mono text-sm', className)} />;
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cx(fieldBase, 'h-8 cursor-pointer appearance-none pr-7', className)}
      >
        {children}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-dim" />
    </div>
  );
}

export function Field({ label, hint, error, required, children, className, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className={cx('block', className)}>
      {label ? (
        <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted">
          {label}
          {required ? <span className="text-accent">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-dim">{hint}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('group flex items-start gap-2.5 text-left disabled:opacity-50', !label && 'inline-flex')}
    >
      <span className={cx(
        'mt-[1px] flex h-[16px] w-[28px] shrink-0 items-center rounded-full border transition-colors',
        checked ? 'border-accent/60 bg-accent/25' : 'border-line bg-raised',
      )}>
        <span className={cx(
          'h-[10px] w-[10px] rounded-full transition-transform',
          checked ? 'translate-x-[13px] bg-accent' : 'translate-x-[3px] bg-dim',
        )} />
      </span>
      {label ? (
        <span className="min-w-0">
          <span className="block text-sm text-fg">{label}</span>
          {description ? <span className="mt-0.5 block text-xs text-dim">{description}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cx('flex items-center gap-2 text-sm text-muted hover:text-fg', className)}>
      <span className={cx(
        'flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition-colors',
        checked ? 'border-accent bg-accent text-[#0b0b0c]' : 'border-strong bg-base',
      )}>
        {checked ? <Check size={10} strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}

export function SegmentedControl({ options, value, onChange, className, size = 'md' }) {
  return (
    <div className={cx('inline-flex items-center gap-0.5 rounded-md border border-line bg-panel p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded px-2 transition-colors',
              size === 'sm' ? 'h-5 text-2xs' : 'h-[24px] text-xs',
              active ? 'bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ surfaces */
export function Panel({ className, children, padded = false, ...props }) {
  return (
    <section {...props} className={cx('rounded-lg border border-line bg-panel', padded && 'p-4', className)}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, description, actions, icon: Icon, className, dense }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-line', dense ? 'px-3 py-2' : 'px-4 py-2.5', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-fg">
          {Icon ? <Icon size={13} className="text-dim" /> : null}
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-dim">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumb, badge, tabs }) {
  return (
    <div className="border-b border-line bg-base/60">
      <div className="mx-auto max-w-[1400px] px-6 pt-4">
        {breadcrumb ? <div className="mb-2 flex items-center gap-1 text-xs text-dim">{breadcrumb}</div> : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-fg">{title}</h1>
              {badge}
            </div>
            {description ? <p className="mt-0.5 max-w-2xl text-sm text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
        </div>
        {tabs ? <div className="mt-3 flex gap-0.5 overflow-x-auto hide-scrollbar">{tabs}</div> : null}
      </div>
    </div>
  );
}

export function TabLink({ to, children, end, count }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cx(
        'relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b px-2.5 pb-2 pt-1.5 text-sm transition-colors',
        isActive ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
      )}
    >
      {children}
      {count !== undefined ? <span className="rounded bg-raised px-1 text-2xs text-dim tabular">{count}</span> : null}
    </NavLink>
  );
}

export function SectionTitle({ children, actions, description }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-dim">{children}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function KeyValue({ items, columns = 2, className }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-2.5', columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : '', className)}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-2xs uppercase tracking-[0.06em] text-dim">{item.label}</dt>
          <dd className={cx('mt-0.5 truncate text-sm text-fg', item.mono && 'font-mono text-xs')}>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------- tables */
export function Table({ children, className, dense }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cx('w-full text-left text-sm', className)} data-dense={dense ? 'true' : undefined}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = 'left', width }) {
  return (
    <th
      style={width ? { width } : undefined}
      className={cx(
        'sticky top-0 z-[1] border-b border-line bg-panel px-3 py-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-dim',
        align === 'right' && 'text-right', align === 'center' && 'text-center', className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = 'left', mono, colSpan }) {
  return (
    <td colSpan={colSpan} className={cx(
      'border-b border-line/70 px-3 py-[7px] align-middle',
      align === 'right' && 'text-right', align === 'center' && 'text-center', mono && 'font-mono text-xs', className,
    )}>
      {children}
    </td>
  );
}

export function Tr({ children, className, onClick, ...props }) {
  return (
    <tr
      {...props}
      onClick={onClick}
      className={cx(onClick && 'cursor-pointer hover:bg-raised/60 transition-colors', className)}
    >
      {children}
    </tr>
  );
}

/* ------------------------------------------------------------------- states */
export function Spinner({ size = 14, className }) {
  return <Loader2 size={size} className={cx('animate-spin text-dim', className)} />;
}

export function LoadingBlock({ label = 'Loading', rows = 3, className }) {
  return (
    <div className={cx('space-y-2 p-4', className)} aria-busy="true">
      <div className="flex items-center gap-2 text-xs text-dim"><Spinner /> {label}</div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-6 rounded shimmer" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {Icon ? (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-panel text-dim">
          <Icon size={16} strokeWidth={1.7} />
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-dim">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-[#3d2222] bg-[#1d1213] text-danger">
        <AlertTriangle size={16} />
      </div>
      <h3 className="text-sm font-medium text-fg">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-dim">{error?.message || 'The request failed.'}</p>
      {onRetry ? <Button className="mt-4" size="sm" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

export function Banner({ tone = 'info', title, children, action, icon: IconOverride, className }) {
  const tones = {
    info: 'border-[#1e3040] bg-[#0d151c] text-info',
    warn: 'border-[#3a2f16] bg-[#17140d] text-warn',
    danger: 'border-[#3d2222] bg-[#180f10] text-danger',
    neutral: 'border-line bg-panel text-muted',
  };
  const Icon = IconOverride || (tone === 'danger' || tone === 'warn' ? AlertTriangle : Info);
  return (
    <div className={cx('flex items-start gap-2 rounded-md border px-3 py-2', tones[tone], className)}>
      <Icon size={13} className="mt-[3px] shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1 text-xs leading-5">
        {title ? <span className="font-medium text-fg">{title} </span> : null}
        <span className="text-muted">{children}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- modals */
export function Modal({ open, onClose, title, description, children, footer, width = 'md', danger }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh] animate-fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('w-full animate-slide-up rounded-lg border border-line bg-panel shadow-pop', widths[width])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 className={cx('text-sm font-medium', danger ? 'text-danger' : 'text-fg')}>{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-dim">{description}</p> : null}
          </div>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </div>
        <div className="px-4 py-3.5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-base/40 px-4 py-2.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', danger, loading, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      danger={danger}
      footer={(
        <>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant={danger ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      {children}
    </Modal>
  );
}

/* -------------------------------------------------------------------- menus */
export function Menu({ trigger, children, align = 'right', width = 'w-56', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className={cx('relative', className)} ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div
          className={cx(
            'absolute z-40 mt-1 animate-fade-in rounded-md border border-line bg-[#101013] py-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0', width,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, danger, disabled, hint, to }) {
  const cls = cx(
    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
    disabled ? 'cursor-not-allowed opacity-40' : danger ? 'text-danger hover:bg-[#1e1214]' : 'text-muted hover:bg-raised hover:text-fg',
  );
  if (to) {
    return (
      <NavLink to={to} className={cls} onClick={(e) => { if (disabled) e.preventDefault(); }}>
        {Icon ? <Icon size={13} /> : null}
        <span className="flex-1">{children}</span>
        {hint ? <span className="text-2xs text-dim">{hint}</span> : null}
      </NavLink>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={13} /> : null}
      <span className="flex-1">{children}</span>
      {hint ? <span className="text-2xs text-dim">{hint}</span> : null}
    </button>
  );
}

export function MenuLabel({ children }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-[0.08em] text-dim">{children}</div>;
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

/* ------------------------------------------------------------------- toasts */
const ToastContext = createContext({ push: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const push = useCallback((toast) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((prev) => [...prev.slice(-3), { id, tone: 'info', ...toast }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.duration ?? 4200);
  }, []);

  const remove = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const value = useMemo(() => ({ push, success: (title, description) => push({ title, description, tone: 'success' }), error: (title, description) => push({ title, description, tone: 'danger' }) }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-3 right-3 z-[60] flex w-[320px] flex-col gap-1.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto flex animate-slide-up items-start gap-2 rounded-md border bg-[#121215] px-3 py-2 shadow-pop',
              toast.tone === 'success' ? 'border-[#1c3a22]' : toast.tone === 'danger' ? 'border-[#3d2222]' : 'border-line',
            )}
          >
            <span className={cx('mt-[3px]', toast.tone === 'success' ? 'text-success' : toast.tone === 'danger' ? 'text-danger' : 'text-info')}>
              {toast.tone === 'success' ? <Check size={13} strokeWidth={2.5} /> : toast.tone === 'danger' ? <AlertTriangle size={13} /> : <Info size={13} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 break-words text-xs text-dim">{toast.description}</p> : null}
            </div>
            <IconButton label="Dismiss" icon={X} size={12} onClick={() => remove(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------ helpers */
export function CopyButton({ value, label = 'Copy', className, size = 'xs', onCopied }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  return (
    <Button
      size={size}
      variant="ghost"
      className={className}
      icon={copied ? Check : Copy}
      aria-label={label ? `${label}` : 'Copy to clipboard'}
      title={label ? `${label}` : 'Copy to clipboard'}
      onClick={async (event) => {
        event.stopPropagation();
        await copyText(value);
        setCopied(true);
        toast.success(`${label === 'Copy' ? 'Copied' : label} to clipboard`);
        onCopied?.();
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function Pagination({ page, pages, total, limit, onPage, className }) {
  if (!pages || pages <= 1) {
    return <div className={cx('px-3 py-2 text-xs text-dim', className)}>{total !== undefined ? `${total} results` : null}</div>;
  }
  return (
    <div className={cx('flex items-center justify-between px-3 py-2 text-xs text-dim', className)}>
      <span>{total !== undefined ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : `Page ${page} of ${pages}`}</span>
      <div className="flex items-center gap-1">
        <Button size="xs" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={ChevronRight} className="[&>svg]:rotate-180">Prev</Button>
        <span className="px-1 tabular">{page} / {pages}</span>
        <Button size="xs" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={12} /></Button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className, autoFocus }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
      <input
        type="search"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cx(fieldBase, 'h-8 pl-[30px] [&::-webkit-search-cancel-button]:hidden')}
      />
    </div>
  );
}

export function Avatar({ name, color, size = 22, className }) {
  const chars = String(name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-medium text-[#0b0b0c]', className)}
      style={{
        width: size, height: size, background: color || '#3a3a42', fontSize: Math.max(9, size * 0.4),
      }}
      title={name}
    >
      {chars}
    </span>
  );
}

export function Tooltip({ label, children }) {
  return <span title={label} className="inline-flex">{children}</span>;
}

export function Kbd({ children }) {
  return <kbd className="rounded border border-line bg-raised px-1 font-mono text-[10px] leading-4 text-dim">{children}</kbd>;
}

export function Sparkline({ values, width = 88, height = 22, tone = 'accent', className }) {
  const points = (values || []).filter((v) => typeof v === 'number');
  if (points.length < 2) return <div className={cx('h-[22px]', className)} />;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 3) - 1.5).toFixed(1)}`).join(' ');
  const colors = { accent: 'var(--accent)', success: 'var(--success)', danger: 'var(--danger)', muted: 'var(--fg-dim)', info: 'var(--info)' };
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <path d={path} fill="none" stroke={colors[tone]} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
