import { useEffect, useState } from 'react';
import {
  ArrowRightRegular,
  BoxMultipleRegular,
  CartRegular,
  CheckmarkCircleRegular,
  MoneyRegular,
  PeopleRegular,
  StarRegular,
  WarningRegular,
} from '@fluentui/react-icons';
import { api } from '../../api';
import {
  getDashboardMetrics,
  listAdminOrders,
  listAdminReviews,
  type AdminOrderBundle,
  type DashboardMetrics,
} from '../../api/admin';
import { listAdminReturnRequests } from '../../api/trust';
import type { Product } from '../../api/types';
import type { Navigate } from '../AdminDashboard';
import {
  DataTable,
  EmptyState,
  KpiCard,
  PageHeader,
  StatusPill,
  ToastHost,
  failureText,
  money,
  nice,
  shortOrderNumber,
  statusTone,
  useToast,
  type Column,
} from '../components/ui';

type AttentionItem = {
  count: number;
  label: string;
  detail: string;
  href: string;
  tone: 'amber' | 'red';
};

const PIPELINE = [
  'PENDING',
  'CONFIRMED',
  'SUPPLIER_PROCESSING',
  'SUPPLIER_SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
];

export function OverviewPage({ navigate }: { navigate: Navigate }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<AdminOrderBundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState(0);
  const [returns, setReturns] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setError('');
    const [summary, orderRows, productRows, reviewRows, returnRows] = await Promise.allSettled([
      getDashboardMetrics(),
      listAdminOrders(),
      api.listAdminProducts(),
      listAdminReviews(),
      listAdminReturnRequests(),
    ]);
    if (summary.status === 'fulfilled') setMetrics(summary.value);
    else setError(failureText(summary.reason));
    if (orderRows.status === 'fulfilled') setOrders(orderRows.value);
    if (productRows.status === 'fulfilled') setProducts(productRows.value);
    if (reviewRows.status === 'fulfilled') setReviews(reviewRows.value.filter((row) => !row.is_visible).length);
    if (returnRows.status === 'fulfilled') {
      setReturns(returnRows.value.filter((row) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(row.status)).length);
    }
    setUpdatedAt(Date.now());
    setBusy(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (busy && !metrics) {
    return (
      <div className="adm-page">
        <PageHeader
          crumb="Overview"
          title="Today at a glance"
          description="Loading the live business snapshot."
        />
        <div className="adm-kpi-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => <div className="adm-kpi adm-sk-card" key={index} />)}
        </div>
        <div className="adm-panel adm-sk-panel" aria-hidden="true" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="adm-page">
        <PageHeader
          crumb="Overview"
          title="Today at a glance"
          description="The business snapshot could not be loaded."
          updatedAt={updatedAt}
          onRefresh={() => void load()}
          refreshing={busy}
        />
        <EmptyState
          title="We could not reach the dashboard"
          body={error || 'The metrics request did not complete.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      </div>
    );
  }

  const pending = orders.filter((row) => row.status === 'PENDING').length;
  const confirmedTotal = orders
    .filter((row) => ['CONFIRMED', 'SUPPLIER_PROCESSING', 'SUPPLIER_SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(row.status))
    .reduce((sum, row) => sum + row.total, 0);
  const missingCost = products.filter((product) => product.supplierCost == null).length;
  const unavailable = products.filter((product) => product.availabilityStatus === 'UNAVAILABLE').length;
  const recent = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  const attentionItems: AttentionItem[] = [
    {
      count: metrics.pending_orders,
      label: `${metrics.pending_orders} order${metrics.pending_orders === 1 ? '' : 's'} awaiting confirmation`,
      detail: 'Confirm or cancel so fulfilment can start.',
      href: '/admin/orders?status=PENDING',
      tone: 'amber',
    },
    {
      count: metrics.pending_approvals,
      label: `${metrics.pending_approvals} approval request${metrics.pending_approvals === 1 ? '' : 's'} pending`,
      detail: 'Decide before any queued work continues.',
      href: '/admin/approvals',
      tone: 'amber',
    },
    {
      count: unavailable,
      label: `${unavailable} listing${unavailable === 1 ? '' : 's'} marked unavailable`,
      detail: 'Customers cannot add these to a cart.',
      href: '/admin/products?availability=UNAVAILABLE',
      tone: 'red',
    },
    {
      count: missingCost,
      label: `${missingCost} product${missingCost === 1 ? '' : 's'} missing supplier cost`,
      detail: 'Profit estimates exclude these listings.',
      href: '/admin/products?cost=missing',
      tone: 'amber',
    },
    {
      count: reviews,
      label: `${reviews} review${reviews === 1 ? '' : 's'} awaiting moderation`,
      detail: 'Publish or hide them from the product page.',
      href: '/admin/reviews',
      tone: 'amber',
    },
    {
      count: returns,
      label: `${returns} return request${returns === 1 ? '' : 's'} open`,
      detail: 'Review the item and record a decision.',
      href: '/admin/returns',
      tone: 'amber',
    },
  ];
  const attention = attentionItems.filter((item) => item.count > 0);

  const attentionTotal = attention.reduce((sum, item) => sum + item.count, 0);
  const pipeline = PIPELINE.map((status) => ({
    status,
    count: orders.filter((row) => row.status === status).length,
  })).filter((row) => row.count > 0 || row.status === 'PENDING');
  const pipelineMax = Math.max(1, ...pipeline.map((row) => row.count));

  const recentColumns: Array<Column<AdminOrderBundle>> = [
    {
      key: 'order',
      label: 'Order',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong title={row.order_number}>#{shortOrderNumber(row.order_number)}</strong>
          <small>{new Date(row.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</small>
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>{row.shipping_full_name}</strong>
          <small>{row.shipping_city || 'City not set'}</small>
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (row) => <span className="adm-num">{money(row.total)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Overview"
        title="Today at a glance"
        description="Collected money, open work and the catalog — read straight from live records."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => navigate('/admin/orders')}>
            <CartRegular aria-hidden="true" />
            Process orders
          </button>
        }
      />

      <div className="adm-kpi-grid">
        <KpiCard
          label="Collected revenue"
          value={money(metrics.revenue)}
          sub={`${money(metrics.revenue)} collected · ${money(confirmedTotal)} in confirmed orders`}
          onClick={() => navigate('/admin/orders?payment=PAID')}
        />
        <KpiCard
          label="Orders"
          value={metrics.total_orders}
          sub={`${pending} pending · ${metrics.delivered_orders} delivered`}
          onClick={() => navigate('/admin/orders')}
          tone={pending ? 'attention' : 'neutral'}
        />
        <KpiCard
          label="Products live"
          value={metrics.published_products}
          sub={`${unavailable} unavailable`}
          onClick={() => navigate('/admin/products')}
        />
        <KpiCard
          label="Customers"
          value={metrics.total_customers}
          sub={`${metrics.total_reviews} reviews submitted`}
          onClick={() => navigate('/admin/customers')}
        />
      </div>

      <section className="adm-attention" aria-labelledby="adm-attention-title">
        <div className="adm-attention-head">
          <WarningRegular aria-hidden="true" />
          <h2 id="adm-attention-title">Needs attention</h2>
          {attentionTotal > 0 && <span className="adm-attention-badge">{attentionTotal}</span>}
          <button type="button" className="adm-link" onClick={() => navigate('/admin/orders?status=PENDING')}>
            Open the queue
            <ArrowRightRegular aria-hidden="true" />
          </button>
        </div>

        {attention.length === 0 ? (
          <div className="adm-clear">
            <CheckmarkCircleRegular aria-hidden="true" />
            <div>
              <strong>Nothing needs your attention</strong>
              <p>Orders are confirmed, approvals are decided and the catalog is purchasable.</p>
            </div>
          </div>
        ) : (
          <ul className="adm-attention-list">
            {attention.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className={`adm-attention-row tone-${item.tone}`}
                  onClick={() => navigate(item.href)}
                >
                  <span className="adm-attention-dot" aria-hidden="true" />
                  <span className="adm-attention-copy">
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </span>
                  <ArrowRightRegular aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="adm-insight-grid">
        <section className="adm-panel" aria-labelledby="adm-pipeline-title">
          <header className="adm-panel-head">
            <div>
              <p className="adm-panel-kicker">Fulfilment</p>
              <h2 id="adm-pipeline-title">Order pipeline</h2>
            </div>
            <button type="button" className="adm-link" onClick={() => navigate('/admin/orders')}>
              All orders
              <ArrowRightRegular aria-hidden="true" />
            </button>
          </header>

          <div className="adm-pipeline">
            {pipeline.map((row) => (
              <div className="adm-pipeline-row" key={row.status}>
                <StatusPill status={row.status} />
                <span className="adm-pipeline-track" aria-hidden="true">
                  <i
                    className={`adm-bar adm-bar--${statusTone(row.status)}`}
                    style={{ width: `${Math.max(4, Math.round((row.count / pipelineMax) * 100))}%` }}
                  />
                </span>
                <b className="adm-num">{row.count}</b>
              </div>
            ))}
            {pipeline.length === 0 && <p className="adm-panel-empty">No orders have been placed yet.</p>}
          </div>

          <footer className="adm-panel-foot">
            <span>{metrics.total_orders} orders recorded</span>
            <strong>{money(metrics.revenue)} collected</strong>
          </footer>
        </section>

        <section className="adm-panel adm-recent" aria-labelledby="adm-recent-title">
          <header className="adm-panel-head">
            <div>
              <p className="adm-panel-kicker">Activity</p>
              <h2 id="adm-recent-title">Recent orders</h2>
            </div>
            <button type="button" className="adm-link" onClick={() => navigate('/admin/orders')}>
              View all
              <ArrowRightRegular aria-hidden="true" />
            </button>
          </header>

          {recent.length === 0 ? (
            <p className="adm-panel-empty">No orders have been placed yet.</p>
          ) : (
            <DataTable
              ariaLabel="Recent orders"
              columns={recentColumns}
              rows={recent}
              rowKey={(row) => row.id}
              onRowClick={() => navigate('/admin/orders')}
              rowTitle={(row) => `Open ${row.order_number} in orders`}
              empty={null}
            />
          )}
        </section>
      </div>

      <section className="adm-quick-row" aria-label="Jump to">
        {[
          { href: '/admin/orders?status=PENDING', label: 'Process pending orders', icon: <CartRegular /> },
          { href: '/admin/products', label: 'Manage the catalog', icon: <BoxMultipleRegular /> },
          { href: '/admin/customers', label: 'Review customers', icon: <PeopleRegular /> },
          { href: '/admin/reviews', label: 'Moderate reviews', icon: <StarRegular /> },
          { href: '/admin/settings', label: 'Store settings', icon: <MoneyRegular /> },
        ].slice(0, 4).map((action) => (
          <button type="button" key={action.href} className="adm-quick" onClick={() => navigate(action.href)}>
            <span aria-hidden="true">{action.icon}</span>
            {action.label}
            <ArrowRightRegular aria-hidden="true" />
          </button>
        ))}
      </section>

      <p className="adm-footnote">
        {missingCost > 0 ? (
          <button
            type="button"
            className="adm-link"
            onClick={() => navigate('/admin/products?cost=missing')}
          >
            Est. profit {money(metrics.estimated_profit)} · supplier cost missing on {missingCost} product{missingCost === 1 ? '' : 's'}
            <ArrowRightRegular aria-hidden="true" />
          </button>
        ) : (
          <>Estimated profit is {money(metrics.estimated_profit)} across recorded orders.</>
        )}
      </p>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}
