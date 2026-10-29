import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowClockwiseRegular,
  CheckmarkCircleRegular,
  DismissRegular,
  SearchRegular,
  WarningRegular,
} from '@fluentui/react-icons';

/* ---------------------------------------------------------------
   Shared admin primitives.

   One StatusPill, one DataTable, one Drawer, one EmptyState, one Toast.
   Everything an operator sees in the console is composed from these so a
   change to spacing, tone or behaviour lands everywhere at once.
   --------------------------------------------------------------- */

export const money = (value: number | null | undefined) =>
  `PKR ${Math.round(Number(value ?? 0)).toLocaleString('en-PK')}`;

export const nice = (value: string | null | undefined) =>
  String(value ?? '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/* Operators should never see a Postgres error string. Map the few classes we
   can act on to plain language; everything else gets one honest default. */
export function failureText(reason: unknown): string {
  let raw = '';
  if (reason instanceof Error) raw = reason.message;
  else if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = Reflect.get(reason, 'message');
    if (typeof message === 'string') raw = message;
  }
  if (!raw) return 'That change could not be saved. Try again.';
  if (/permission|denied|42501|row-level security|jwt|not authorized/i.test(raw)) {
    return 'Your admin session does not have permission for that change. Sign in again, then retry.';
  }
  if (/duplicate|unique constraint|already exists/i.test(raw)) {
    return 'A record with that name, slug or SKU already exists. Use a different value.';
  }
  if (/failed to fetch|network|load failed/i.test(raw)) {
    return 'The console could not reach the server. Check your connection and try again.';
  }
  if (/invalid input|invalid uuid|violates/i.test(raw)) {
    return 'Some of those values are not valid. Check the highlighted fields and try again.';
  }
  return 'That change could not be saved. Try again.';
}

export function timeAgo(iso: number | null): string {
  if (!iso) return 'not yet';
  const seconds = Math.max(0, Math.round((Date.now() - iso) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

export const shortOrderNumber = (value: string) => {
  const clean = value.replace(/^#/, '');
  return clean.length > 12 ? clean.slice(-8) : clean;
};

/* --- Status pill --------------------------------------------------------- */

export type StatusTone = 'amber' | 'blue' | 'indigo' | 'teal' | 'grey' | 'red';

const STATUS_TONES: Record<string, StatusTone> = {
  // Fulfilment
  pending: 'amber',
  confirmed: 'blue',
  processing: 'blue',
  supplier_processing: 'blue',
  'in progress': 'blue',
  in_progress: 'blue',
  shipped: 'indigo',
  supplier_shipped: 'indigo',
  in_transit: 'indigo',
  delivered: 'teal',
  // Payment
  paid: 'teal',
  unpaid: 'amber',
  failed: 'red',
  refunded: 'grey',
  // Catalog
  published: 'teal',
  visible: 'teal',
  active: 'teal',
  draft: 'grey',
  archived: 'grey',
  hidden: 'grey',
  disabled: 'grey',
  inactive: 'grey',
  available: 'teal',
  unavailable: 'red',
  check_required: 'amber',
  'check required': 'amber',
  // Requests
  requested: 'amber',
  under_review: 'blue',
  approved: 'teal',
  rejected: 'red',
  returned: 'grey',
  replacement_sent: 'teal',
  closed: 'grey',
  open: 'amber',
  waiting_for_customer: 'indigo',
  resolved: 'teal',
  cancelled: 'grey',
  // Reviews / feedback
  in_review: 'blue',
  new: 'amber',
  read: 'grey',
  spam: 'red',
  // Misc
  success: 'teal',
  error: 'red',
  queued: 'grey',
  running: 'blue',
  skipped: 'grey',
};

export const statusTone = (status: string): StatusTone =>
  STATUS_TONES[String(status).toLowerCase()] ?? 'grey';

export function StatusPill({
  status,
  label,
  kind = 'status',
}: {
  status: string;
  label?: string;
  kind?: 'status' | 'payment' | 'neutral';
}) {
  const tone = STATUS_TONES[String(status).toLowerCase()] ?? 'grey';
  return (
    <span className={`adm-pill adm-pill--${tone}${kind === 'payment' ? ' adm-pill--payment' : ''}`}>
      {kind === 'payment' && <span className="adm-pill-glyph" aria-hidden="true">₨</span>}
      {label ?? nice(status)}
    </span>
  );
}

/* --- Page header --------------------------------------------------------- */

export function PageHeader({
  crumb,
  title,
  description,
  actions,
  updatedAt,
  onRefresh,
  refreshing,
}: {
  crumb: string;
  title: string;
  description: string;
  actions?: ReactNode;
  updatedAt?: number | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="adm-page-head">
      <div className="adm-page-head-copy">
        <p className="adm-crumb">{crumb}</p>
        <h1 className="adm-h1">{title}</h1>
        <p className="adm-page-desc">{description}</p>
      </div>
      <div className="adm-page-actions">
        {onRefresh && (
          <div className="adm-refresh">
            <button
              type="button"
              className={`adm-icon-btn${refreshing ? ' is-spinning' : ''}`}
              onClick={onRefresh}
              aria-label="Refresh this page"
              title="Refresh"
            >
              <ArrowClockwiseRegular />
            </button>
            <span className="adm-updated">Updated {timeAgo(updatedAt ?? null)}</span>
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}

/* --- KPI card ------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  sub,
  onClick,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
  tone?: 'neutral' | 'attention';
}) {
  const content = (
    <>
      <span className="adm-kpi-label">{label}</span>
      <strong className="adm-kpi-value">{value}</strong>
      {sub && <span className="adm-kpi-sub">{sub}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={`adm-kpi tone-${tone}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`adm-kpi tone-${tone}`}>{content}</div>
  );
}

/* --- Filter bar ---------------------------------------------------------- */

export function FilterBar({ children, count }: { children: ReactNode; count?: ReactNode }) {
  return (
    <div className="adm-filterbar" role="group" aria-label="Filters">
      <div className="adm-filterbar-fields">{children}</div>
      {count !== undefined && <span className="adm-filter-count">{count}</span>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="adm-search">
      <SearchRegular aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

export function SelectFilter({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <select
      className="adm-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    >
      {children}
    </select>
  );
}

/* --- Tabs with counts ---------------------------------------------------- */

export function CountTabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: Array<{ key: string; label: string; count: number }>;
  active: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div className="adm-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`adm-tab${active === tab.key ? ' is-active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className="adm-tab-count">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

/* --- Data table ---------------------------------------------------------- */

export type Column<T> = {
  key: string;
  label: string;
  width?: string;
  align?: 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedId,
  selectedIds,
  onToggleRow,
  onToggleAll,
  loading,
  empty,
  ariaLabel,
  rowTitle,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedId?: string;
  selectedIds?: Set<string>;
  onToggleRow?: (row: T) => void;
  onToggleAll?: () => void;
  loading?: boolean;
  empty?: ReactNode;
  ariaLabel: string;
  rowTitle?: (row: T) => string;
}) {
  const selectable = Boolean(selectedIds && onToggleRow);
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selectedIds?.has(rowKey(row)));

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="adm-table-wrap">
      <table className="adm-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {selectable && (
              <th className="adm-th-check">
                <input
                  type="checkbox"
                  checked={Boolean(allSelected)}
                  onChange={() => onToggleAll?.()}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={column.align ? `is-${column.align}` : undefined}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 6 }).map((_, index) => (
            <tr key={`skeleton-${index}`} className="adm-tr-skeleton" aria-hidden="true">
              {selectable && <td><span className="adm-sk adm-sk-box" /></td>}
              {columns.map((column) => (
                <td key={column.key}>
                  <span className={`adm-sk${column.align === 'right' ? ' is-short' : ''}`} />
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows.map((row, index) => {
            const key = rowKey(row);
            const selected = selectedId === key;
            return (
              <tr
                key={key}
                className={`${onRowClick ? 'is-clickable' : ''}${selected ? ' is-selected' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-selected={onRowClick ? selected : undefined}
                title={rowTitle?.(row)}
                onKeyDown={onRowClick ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
              >
                {selectable && (
                  <td className="adm-td-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds?.has(key))}
                      onChange={() => onToggleRow?.(row)}
                      aria-label={`Select row ${index + 1}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={column.align ? `is-${column.align}` : undefined}>
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- Pagination ---------------------------------------------------------- */

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) {
    return <p className="adm-pagination-note">{total} {total === 1 ? 'record' : 'records'}</p>;
  }
  return (
    <div className="adm-pagination">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div>
        <button type="button" className="adm-page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="adm-page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

/* --- Drawer -------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'regular',
  closeLabel = 'Close panel',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'regular' | 'wide';
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="adm-drawer-layer">
      <div className="adm-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className={`adm-drawer${size === 'wide' ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="adm-drawer-head">
          <div>
            <h2 className="adm-drawer-title">{title}</h2>
            {description && <p className="adm-drawer-desc">{description}</p>}
          </div>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label={closeLabel}>
            <DismissRegular />
          </button>
        </header>
        <div className="adm-drawer-body">{children}</div>
        {footer && <footer className="adm-drawer-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* --- Confirm dialog ------------------------------------------------------ */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="adm-dialog-layer">
      <div className="adm-scrim" onClick={onCancel} aria-hidden="true" />
      <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 className="adm-dialog-title" id={titleId}>{title}</h2>
        <div className="adm-dialog-body" id={bodyId}>{body}</div>
        <div className="adm-dialog-actions">
          <button type="button" className="adm-btn adm-btn--quiet" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            ref={confirmRef}
            className={`adm-btn ${tone === 'danger' ? 'adm-btn--danger' : 'adm-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Empty state --------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="adm-empty">
      <span className="adm-empty-icon" aria-hidden="true">
        {icon ?? <CheckmarkCircleRegular />}
      </span>
      <h3 className="adm-empty-title">{title}</h3>
      <p>{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="adm-btn adm-btn--primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* --- Load failure -------------------------------------------------------- */

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="adm-error-banner" role="alert">
      <WarningRegular aria-hidden="true" />
      <p>{message}</p>
      <button type="button" className="adm-btn adm-btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* --- Toast --------------------------------------------------------------- */

export type ToastState = { message: string; tone: 'success' | 'error'; id: number } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = (message: string, tone: 'success' | 'error' = 'success') => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return {
    toast,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    dismiss: () => setToast(null),
  };
}

export function ToastHost({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div className={`adm-toast adm-toast--${toast.tone}`} role="status" aria-live="polite">
      <span className="adm-toast-dot" aria-hidden="true" />
      <span>{toast.message}</span>
      <button type="button" className="adm-toast-close" onClick={onDismiss} aria-label="Dismiss notification">
        <DismissRegular />
      </button>
    </div>
  );
}

/* --- Small helpers ------------------------------------------------------- */

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = async (value: string, key = value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1500);
    } catch {
      setCopied('');
    }
  };
  return { copied, copy };
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="adm-icon-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
