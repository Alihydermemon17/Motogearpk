import { useEffect, useMemo, useState } from 'react';
import { ChatRegular, PeopleRegular, PhoneRegular } from '@fluentui/react-icons';
import { listAdminCustomers, listAdminOrders, type AdminCustomer, type AdminOrderBundle } from '../../api/admin';
import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorBanner,
  FilterBar,
  PageHeader,
  SearchInput,
  SelectFilter,
  StatusPill,
  ToastHost,
  failureText,
  money,
  useToast,
  type Column,
} from '../components/ui';

type SortKey = 'name' | 'value' | 'orders' | 'recent';

export function CustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [orders, setOrders] = useState<AdminOrderBundle[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectedId, setSelectedId] = useState('');
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      const [customerRows, orderRows] = await Promise.all([listAdminCustomers(), listAdminOrders()]);
      setCustomers(customerRows);
      setOrders(orderRows);
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const ordersFor = (customer: AdminCustomer) =>
    orders
      .filter((order) => order.customer?.id === customer.id || order.customer_id === customer.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = customers.filter((customer) =>
      `${customer.full_name ?? ''} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.city ?? ''}`
        .toLowerCase()
        .includes(term));
    return [...filtered].sort((a, b) => {
      if (sort === 'value') return b.order_value - a.order_value;
      if (sort === 'orders') return b.order_count - a.order_count;
      if (sort === 'name') return (a.full_name ?? '').localeCompare(b.full_name ?? '');
      const aLast = ordersFor(a)[0]?.created_at ?? '';
      const bLast = ordersFor(b)[0]?.created_at ?? '';
      return bLast.localeCompare(aLast);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, orders, search, sort]);

  const selected = customers.find((customer) => customer.id === selectedId);
  const selectedOrders = selected ? ordersFor(selected) : [];

  const columns: Array<Column<AdminCustomer>> = [
    {
      key: 'customer',
      label: 'Customer',
      render: (customer) => (
        <span className="adm-cell-stack">
          <strong>{customer.full_name || 'Name not set'}</strong>
          <small>{customer.email || 'No email'}</small>
        </span>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (customer) => customer.phone ? (
        <span className="adm-contact-links" onClick={(event) => event.stopPropagation()}>
          <a href={`tel:${customer.phone.replace(/[^0-9+]/g, '')}`}>
            <PhoneRegular aria-hidden="true" />
            {customer.phone}
          </a>
          <a
            href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp ${customer.full_name ?? 'customer'}`}
          >
            <ChatRegular aria-hidden="true" />
            WhatsApp
          </a>
        </span>
      ) : <span className="adm-missing">Not set</span>,
    },
    {
      key: 'location',
      label: 'Location',
      render: (customer) => [customer.city, customer.province].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'orders',
      label: 'Orders',
      align: 'right',
      render: (customer) => <span className="adm-num">{customer.order_count}</span>,
    },
    {
      key: 'value',
      label: 'Lifetime value',
      align: 'right',
      render: (customer) => <span className="adm-num">{money(customer.order_value)}</span>,
    },
    {
      key: 'last',
      label: 'Last order',
      render: (customer) => {
        const last = ordersFor(customer)[0];
        return last
          ? <span className="adm-cell-stack"><span>{new Date(last.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span><small>#{last.order_number.replace(/^#/, '')}</small></span>
          : <span className="adm-missing">No orders</span>;
      },
    },
    {
      key: 'joined',
      label: 'Joined',
      render: (customer) => new Date(customer.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Sales / Customers"
        title="Customers"
        description="People who created a storefront account. Order values come from their real orders."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}

      <FilterBar count={`${rows.length} of ${customers.length} customers`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, phone…" label="Search customers" />
        <SelectFilter value={sort} onChange={(value) => setSort(value as SortKey)} label="Sort customers">
          <option value="recent">Most recent order</option>
          <option value="value">Lifetime value</option>
          <option value="orders">Order count</option>
          <option value="name">Name A–Z</option>
        </SelectFilter>
      </FilterBar>

      <DataTable
        ariaLabel="Customers"
        columns={columns}
        rows={rows}
        rowKey={(customer) => customer.id}
        loading={busy}
        onRowClick={(customer) => setSelectedId(customer.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<PeopleRegular />} title="No customers yet" body="Customer accounts appear here after a real sign-up." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected?.full_name || 'Customer'}
        description={selected?.email ?? undefined}
      >
        {selected && (
          <>
            <div className="adm-profile-strip">
              <span className="adm-avatar is-large">{(selected.full_name ?? selected.email ?? '?').slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{selected.email || 'No email recorded'}</strong>
                <span>{[selected.city, selected.province].filter(Boolean).join(', ') || 'Location not set'}</span>
              </div>
            </div>

            <div className="adm-profile-stats">
              <div><span>Orders</span><strong className="adm-num">{selected.order_count}</strong></div>
              <div><span>Lifetime value</span><strong className="adm-num">{money(selected.order_value)}</strong></div>
              <div><span>Joined</span><strong>{new Date(selected.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            </div>

            {selected.phone && (
              <div className="adm-detail-actions">
                <a className="adm-btn adm-btn--quiet" href={`tel:${selected.phone.replace(/[^0-9+]/g, '')}`}>
                  <PhoneRegular aria-hidden="true" /> Call {selected.phone}
                </a>
                <a
                  className="adm-btn adm-btn--quiet"
                  href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ChatRegular aria-hidden="true" /> WhatsApp
                </a>
              </div>
            )}

            <section className="adm-detail-section">
              <h3>Order history</h3>
              {selectedOrders.length === 0 ? (
                <p className="adm-panel-empty">This customer has not placed an order yet.</p>
              ) : (
                <ul className="adm-mini-orders">
                  {selectedOrders.map((order) => (
                    <li key={order.id}>
                      <span className="adm-cell-stack">
                        <strong>#{order.order_number.replace(/^#/, '')}</strong>
                        <small>{new Date(order.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</small>
                      </span>
                      <StatusPill status={order.status} />
                      <b className="adm-num">{money(order.total)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}
