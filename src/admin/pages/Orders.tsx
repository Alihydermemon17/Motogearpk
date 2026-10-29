import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRegular,
  ArrowUndoRegular,
  CartRegular,
  CheckmarkCircleRegular,
  ChevronRightRegular,
  CopyRegular,
  DocumentTextRegular,
  MoneyRegular,
  OpenRegular,
  PrintRegular,
  VehicleTruckBagRegular,
} from '@fluentui/react-icons';
import { api } from '../../api';
import {
  listAdminOrders,
  updateAdminOrder,
  updateAdminOrderPayment,
  type AdminOrderBundle,
} from '../../api/admin';
import type { AdminOrderStatus, Product } from '../../api/types';
import type { PaymentStatus } from '../../lib/supabase';
import { InvoiceModal } from '../../app/Invoice';
import type { Navigate } from '../AdminDashboard';
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterBar,
  PageHeader,
  SearchInput,
  StatusPill,
  ToastHost,
  failureText,
  money,
  nice,
  shortOrderNumber,
  useCopy,
  useMediaQuery,
  useToast,
  type Column,
} from '../components/ui';

const COURIERS = ['TCS', 'Leopards', 'M&P', 'Trax', 'PostEx'];

/* Public tracking pages. The number is copied separately, so a courier whose
   pattern changes still leaves the operator with the value they need. */
const TRACKING_URLS: Record<string, string> = {
  TCS: 'https://www.tcsexpress.com/track',
  Leopards: 'https://www.leopardscourier.com/track',
  'M&P': 'https://www.mulphilog.com/tracking',
  Trax: 'https://trax.pk/tracking',
  PostEx: 'https://postex.pk/tracking',
};

const orderStatuses: AdminOrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'SUPPLIER_PROCESSING',
  'SUPPLIER_SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'REFUNDED',
];

function orderTransitions(current: AdminOrderStatus, paymentStatus: string): AdminOrderStatus[] {
  const next: Record<AdminOrderStatus, AdminOrderStatus[]> = {
    PENDING: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['CONFIRMED', 'SUPPLIER_PROCESSING', 'CANCELLED'],
    SUPPLIER_PROCESSING: ['SUPPLIER_PROCESSING', 'SUPPLIER_SHIPPED', 'CANCELLED'],
    SUPPLIER_SHIPPED: ['SUPPLIER_SHIPPED', 'IN_TRANSIT'],
    IN_TRANSIT: ['IN_TRANSIT', 'DELIVERED', 'RETURNED'],
    DELIVERED: ['DELIVERED', 'RETURNED'],
    CANCELLED: ['CANCELLED'],
    RETURNED: ['RETURNED'],
    REFUNDED: ['REFUNDED'],
  };
  return next[current].filter((status) => status !== 'REFUNDED' || paymentStatus === 'PAID');
}

type TabKey = 'ALL' | 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';

export function OrdersPage({ navigate }: { navigate: Navigate }) {
  const [rows, setRows] = useState<AdminOrderBundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [refundTarget, setRefundTarget] = useState<AdminOrderBundle | null>(null);
  const toast = useToast();
  const isMobile = useMediaQuery('(max-width: 899px)');

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      const [orderRows, productRows] = await Promise.all([listAdminOrders(), api.listAdminProducts()]);
      setRows(orderRows);
      setProducts(productRows);
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status && ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'].includes(status)) {
      setTab(status as TabKey);
    }
  }, []);

  const visible = useMemo(() => rows.filter((row) => {
    if (tab !== 'ALL' && row.status !== tab) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return `${row.order_number} ${row.shipping_full_name} ${row.shipping_phone} ${row.shipping_city}`
      .toLowerCase()
      .includes(term);
  }), [rows, tab, search]);

  const selected = rows.find((row) => row.id === selectedId) ?? (isMobile ? undefined : visible[0]);

  const imageFor = (productId: string | null) =>
    products.find((product) => product.id === productId)?.image ?? '';

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'ALL', label: 'All', count: rows.length },
    { key: 'PENDING', label: 'Pending', count: rows.filter((row) => row.status === 'PENDING').length },
    { key: 'CONFIRMED', label: 'Confirmed', count: rows.filter((row) => row.status === 'CONFIRMED').length },
    { key: 'DELIVERED', label: 'Delivered', count: rows.filter((row) => row.status === 'DELIVERED').length },
    { key: 'CANCELLED', label: 'Cancelled', count: rows.filter((row) => row.status === 'CANCELLED').length },
  ];

  const save = async (order: AdminOrderBundle, status: AdminOrderStatus, tracking: string, courier: string, notes: string) => {
    setSaving(true);
    setSaveError('');
    try {
      await updateAdminOrder(order.id, status, tracking, courier, notes);
      toast.success('Order saved.');
      await load();
    } catch (reason: unknown) {
      const message = failureText(reason);
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async (order: AdminOrderBundle, status: PaymentStatus, reference: string, note: string) => {
    setSaving(true);
    setSaveError('');
    try {
      await updateAdminOrderPayment(order.id, status, reference, note);
      toast.success(status === 'PAID' ? 'Payment recorded as received.' : `Payment status set to ${nice(status)}.`);
      await load();
    } catch (reason: unknown) {
      const message = failureText(reason);
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<Column<AdminOrderBundle>> = [
    {
      key: 'order',
      label: 'Order',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong className="adm-order-no" title={`#${row.order_number.replace(/^#/, '')}`}>
            #{shortOrderNumber(row.order_number)}
          </strong>
          <small>
            {row.shipping_full_name}
            {row.shipping_city ? ` · ${row.shipping_city}` : ''}
          </small>
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Placed',
      render: (row) => (
        <span className="adm-cell-stack">
          <span>{new Date(row.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span>
          <small>{new Date(row.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</small>
        </span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      align: 'right',
      render: (row) => <span className="adm-num">{row.items.reduce((sum, item) => sum + item.quantity, 0)}</span>,
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (row) => <span className="adm-num">{money(row.total)}</span>,
    },
    {
      key: 'payment',
      label: 'Payment',
      render: (row) => <StatusPill status={row.payment_status} kind="payment" />,
    },
    {
      key: 'status',
      label: 'Order status',
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  return (
    <div className={`adm-page adm-orders${selected ? ' has-selection' : ''}`}>
      <PageHeader
        crumb="Sales / Orders"
        title="Orders"
        description="Confirm, dispatch and reconcile payments. Status changes are checked."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}

      <FilterBar count={`${visible.length} of ${rows.length} orders`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Order, customer or phone…" label="Search orders" />
        <div className="adm-tabs" role="tablist" aria-label="Filter orders by status">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`adm-tab${tab === item.key ? ' is-active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              <span className="adm-tab-count">{item.count}</span>
            </button>
          ))}
        </div>
      </FilterBar>

      {!busy && rows.length === 0 ? (
        <EmptyState
          icon={<CartRegular />}
          title="No orders yet"
          body="Real orders will appear here as soon as a customer checks out."
          actionLabel="Open the storefront"
          onAction={() => navigate('/')}
        />
      ) : (
        <div className="adm-order-layout">
          <section className="adm-order-list" aria-label="Orders">
            {isMobile ? (
              <div className="adm-order-cards">
                {busy && Array.from({ length: 4 }).map((_, index) => (
                  <div className="adm-order-card adm-sk-card" key={index} aria-hidden="true" />
                ))}
                {!busy && visible.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`adm-order-card${selected?.id === row.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="adm-order-card-top">
                      <strong title={`#${row.order_number.replace(/^#/, '')}`}>#{shortOrderNumber(row.order_number)}</strong>
                      <span className="adm-num">{money(row.total)}</span>
                    </span>
                    <span>{row.shipping_full_name}</span>
                    <span className="adm-order-card-pills">
                      <StatusPill status={row.payment_status} kind="payment" />
                      <StatusPill status={row.status} />
                    </span>
                    <ChevronRightRegular aria-hidden="true" />
                  </button>
                ))}
                {!busy && visible.length === 0 && <p className="adm-panel-empty">No orders match this filter.</p>}
              </div>
            ) : (
              <DataTable
                ariaLabel="Orders"
                columns={columns}
                rows={visible}
                rowKey={(row) => row.id}
                loading={busy}
                onRowClick={(row) => setSelectedId(row.id)}
                selectedId={selected?.id}
                rowTitle={(row) => `Open order ${row.order_number}`}
                empty={<EmptyState title="No orders match" body="Try another status tab or clear the search." />}
              />
            )}
          </section>

          {selected && (
            <OrderDetail
              key={selected.id}
              order={selected}
              imageFor={imageFor}
              saving={saving}
              saveError={saveError}
              isMobile={isMobile}
              onBack={() => setSelectedId('')}
              onSave={(status, tracking, courier, notes) => void save(selected, status, tracking, courier, notes)}
              onSavePayment={(status, reference, note) => void savePayment(selected, status, reference, note)}
              onRequestRefund={() => setRefundTarget(selected)}
            />
          )}

          {!selected && !isMobile && !busy && visible.length > 0 && (
            <EmptyState title="Select an order" body="Pick a row to open the items, payment and fulfilment controls." />
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(refundTarget)}
        title="Record a refund?"
        body="This records that the money was returned. It does not move any money — issue the refund in your payment channel first."
        confirmLabel="Record refund"
        tone="danger"
        onConfirm={() => {
          if (!refundTarget) return;
          void savePayment(refundTarget, 'REFUNDED', '', 'Refund recorded from the orders console.');
          setRefundTarget(null);
        }}
        onCancel={() => setRefundTarget(null)}
      />

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

function OrderDetail({
  order,
  imageFor,
  saving,
  saveError,
  isMobile,
  onBack,
  onSave,
  onSavePayment,
  onRequestRefund,
}: {
  order: AdminOrderBundle;
  imageFor: (productId: string | null) => string;
  saving: boolean;
  saveError: string;
  isMobile: boolean;
  onBack: () => void;
  onSave: (status: AdminOrderStatus, tracking: string, courier: string, notes: string) => void;
  onSavePayment: (status: PaymentStatus, reference: string, note: string) => void;
  onRequestRefund: () => void;
}) {
  const [status, setStatus] = useState<AdminOrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [notes, setNotes] = useState(order.internal_notes ?? '');
  const [courierChoice, setCourierChoice] = useState(
    order.courier ? (COURIERS.includes(order.courier) ? order.courier : 'Other') : '',
  );
  const [courierOther, setCourierOther] = useState(
    order.courier && !COURIERS.includes(order.courier) ? order.courier : '',
  );
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { copied, copy } = useCopy();

  useEffect(() => {
    setStatus(order.status);
    setTracking(order.tracking_number ?? '');
    setNotes(order.internal_notes ?? '');
    setCourierChoice(order.courier ? (COURIERS.includes(order.courier) ? order.courier : 'Other') : '');
    setCourierOther(order.courier && !COURIERS.includes(order.courier) ? order.courier : '');
  }, [order]);

  const allowed = orderTransitions(order.status, order.payment_status);
  const courier = courierChoice === 'Other' ? courierOther : courierChoice;
  const trackingUrl = courierChoice !== 'Other' ? TRACKING_URLS[courierChoice] : undefined;
  const phone = order.customer?.phone ?? order.shipping_phone;

  return (
    <aside className="adm-order-detail" aria-label={`Order ${order.order_number}`}>
      {isMobile && (
        <button type="button" className="adm-back" onClick={onBack}>
          <ArrowLeftRegular aria-hidden="true" />
          Back to orders
        </button>
      )}

      <header className="adm-order-detail-head">
        <div>
          <p className="adm-crumb">Order</p>
          <h2 className="adm-order-title">#{shortOrderNumber(order.order_number)}</h2>
          <p className="adm-order-id" title={`Database ID: ${order.id}`}>
            #{order.order_number.replace(/^#/, '')}
            <button
              type="button"
              className="adm-copy"
              onClick={() => void copy(order.order_number.replace(/^#/, ''), 'id')}
              aria-label="Copy full order number"
            >
              <CopyRegular aria-hidden="true" />
              {copied === 'id' ? 'Copied' : 'Copy number'}
            </button>
          </p>
        </div>
        <div className="adm-order-detail-tools">
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setInvoiceOpen(true)}>
            <DocumentTextRegular aria-hidden="true" />
            Invoice
          </button>
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => window.print()}>
            <PrintRegular aria-hidden="true" />
            Print
          </button>
        </div>
      </header>

      <div className="adm-order-status-row">
        <StatusPill status={order.payment_status} kind="payment" />
        <StatusPill status={order.status} />
        <strong className="adm-num">{money(order.total)}</strong>
      </div>

      <section className="adm-detail-section">
        <h3>Customer &amp; delivery</h3>
        <div className="adm-detail-two">
          <div>
            <p className="adm-detail-label">Customer</p>
            <strong>{order.customer?.full_name || order.shipping_full_name}</strong>
            <span>{order.customer?.email || order.shipping_email}</span>
            {phone && (
              <span className="adm-contact-links">
                <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>{phone}</a>
                <a
                  href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </span>
            )}
          </div>
          <div>
            <p className="adm-detail-label">Ship to</p>
            <strong>{order.shipping_full_name}</strong>
            <span>{order.shipping_address}</span>
            <span>{[order.shipping_city, order.shipping_province].filter(Boolean).join(', ')}</span>
            <span>{order.shipping_phone}</span>
          </div>
        </div>
      </section>

      <section className="adm-detail-section">
        <h3>Items</h3>
        <ul className="adm-line-items">
          {order.items.length === 0 && <li className="adm-panel-empty">No order items recorded.</li>}
          {order.items.map((item) => (
            <li key={item.id}>
              <span className="adm-thumb is-small">
                {imageFor(item.product_id)
                  ? <img src={imageFor(item.product_id)} alt="" loading="lazy" />
                  : <CartRegular aria-hidden="true" />}
              </span>
              <span className="adm-cell-stack">
                <strong>{item.product_name}</strong>
                <small>
                  {item.product_sku || 'No SKU'} · Qty {item.quantity}
                  {item.supplier_name ? ` · ${item.supplier_name}` : ''}
                </small>
              </span>
              <b className="adm-num">{money(item.line_total)}</b>
            </li>
          ))}
        </ul>
        <dl className="adm-totals">
          <div><dt>Subtotal</dt><dd className="adm-num">{money(order.subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd className="adm-num">{money(order.delivery_fee)}</dd></div>
          <div className="is-total"><dt>Total</dt><dd className="adm-num">{money(order.total)}</dd></div>
        </dl>
      </section>

      <section className="adm-detail-section">
        <h3>Payment</h3>
        <PaymentPanel
          order={order}
          busy={saving}
          onSetPayment={onSavePayment}
          onRequestRefund={onRequestRefund}
        />
      </section>

      <section className="adm-detail-section">
        <h3>Fulfilment</h3>
        {saveError && <div className="adm-inline-error" role="alert">{saveError}</div>}
        <div className="adm-form-grid">
          <label className="adm-field">
            <span>Order status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as AdminOrderStatus)}>
              {allowed.map((value) => <option key={value} value={value}>{nice(value)}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>Courier</span>
            <select value={courierChoice} onChange={(event) => setCourierChoice(event.target.value)}>
              <option value="">Not assigned</option>
              {COURIERS.map((value) => <option key={value} value={value}>{value}</option>)}
              <option value="Other">Other</option>
            </select>
          </label>
          {courierChoice === 'Other' && (
            <label className="adm-field is-wide">
              <span>Courier name</span>
              <input value={courierOther} onChange={(event) => setCourierOther(event.target.value)} placeholder="Enter the courier" />
            </label>
          )}
          <label className="adm-field is-wide">
            <span>Tracking number</span>
            <span className="adm-input-with-action">
              <input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="e.g. 123456789" />
              <button type="button" className="adm-btn adm-btn--tiny" onClick={() => void copy(tracking, 'tracking')} disabled={!tracking}>
                <CopyRegular aria-hidden="true" />
                {copied === 'tracking' ? 'Copied' : 'Copy'}
              </button>
              {trackingUrl && tracking && (
                <a className="adm-btn adm-btn--tiny" href={trackingUrl} target="_blank" rel="noreferrer">
                  <OpenRegular aria-hidden="true" />
                  Track
                </a>
              )}
            </span>
          </label>
          <label className="adm-field is-wide">
            <span>Internal notes</span>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Only admins can read this" />
          </label>
        </div>
        <div className="adm-detail-actions">
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => onSave(status, tracking, courier, notes)} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <InvoiceModal isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} order={order} items={order.items} type="admin" />
    </aside>
  );
}

function PaymentPanel({
  order,
  busy,
  onSetPayment,
  onRequestRefund,
}: {
  order: AdminOrderBundle;
  busy: boolean;
  onSetPayment: (status: PaymentStatus, reference: string, note: string) => void;
  onRequestRefund: () => void;
}) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmPaid, setConfirmPaid] = useState(false);
  const status = order.payment_status;
  const canMarkPaid = status === 'PENDING' || status === 'FAILED';
  const canMarkPending = status === 'FAILED';
  const canRefund = status === 'PAID';

  return (
    <div className="adm-payment">
      <div className="adm-payment-head">
        <StatusPill status={status} kind="payment" />
        <span>{nice(order.payment_method)}</span>
      </div>
      <p className="adm-hint">
        Cash on Delivery is collected at the door. Mark it paid only once the money has actually been received.
      </p>
      {(canMarkPaid || canMarkPending) && (
        <div className="adm-form-grid">
          {canMarkPaid && (
            <label className="adm-field is-wide">
              <span>Payment reference</span>
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transfer ID, receipt number or cash note" />
            </label>
          )}
          <label className="adm-field is-wide">
            <span>Confirmation note</span>
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was checked before confirming this payment" />
          </label>
        </div>
      )}
      <div className="adm-payment-actions">
        {canMarkPaid && (
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => setConfirmPaid(true)} disabled={busy}>
            <CheckmarkCircleRegular aria-hidden="true" />
            Mark as paid
          </button>
        )}
        {canMarkPending && (
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => onSetPayment('PENDING', '', note)} disabled={busy}>
            Mark pending again
          </button>
        )}
        {canMarkPaid && (
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => onSetPayment('FAILED', '', note)} disabled={busy}>
            Mark failed
          </button>
        )}
        {canRefund && (
          <button type="button" className="adm-btn adm-btn--quiet" onClick={onRequestRefund} disabled={busy}>
            <ArrowUndoRegular aria-hidden="true" />
            Record refund
          </button>
        )}
      </div>
      {status === 'PAID' && (order.payment_reference || order.payment_confirmed_at) && (
        <p className="adm-hint">
          {order.payment_reference ? `Reference: ${order.payment_reference}. ` : ''}
          Confirmed {order.payment_confirmed_at ? new Date(order.payment_confirmed_at).toLocaleString('en-PK') : ''}
        </p>
      )}

      <ConfirmDialog
        open={confirmPaid}
        title="Confirm this payment was received?"
        body={
          <>
            <p className="adm-num">{money(order.total)}</p>
            <p>This records the payment as paid. Placing or dispatching a COD order does not do it for you.</p>
          </>
        }
        confirmLabel="Mark as paid"
        onConfirm={() => {
          setConfirmPaid(false);
          onSetPayment('PAID', reference, note);
        }}
        onCancel={() => setConfirmPaid(false)}
      />
    </div>
  );
}
