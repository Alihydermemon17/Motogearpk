import { useEffect, useState, type ReactNode } from 'react';
import {
  AddRegular,
  BotRegular,
  CheckmarkCircleRegular,
  ChatRegular,
  StarFilled,
  StarRegular,
} from '@fluentui/react-icons';
import {
  createApprovalRequest,
  decideApprovalRequest,
  listAdminFeedback,
  listAdminReviews,
  listApprovalRequests,
  listAutomationLogs,
  setReviewVisibility,
  updateFeedback,
  type AdminFeedback,
  type AdminReview,
} from '../../api/admin';
import {
  CountTabs,
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
  nice,
  timeAgo,
  useToast,
  type Column,
} from '../components/ui';

type ApprovalRow = Awaited<ReturnType<typeof listApprovalRequests>>[number];
type AutomationRow = Awaited<ReturnType<typeof listAutomationLogs>>[number];

const stars = (rating: number) => (
  <span className="adm-stars" aria-label={`${rating} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, index) =>
      index < rating
        ? <StarFilled key={index} aria-hidden="true" />
        : <StarRegular key={index} aria-hidden="true" />,
    )}
  </span>
);

/* --- Reviews ------------------------------------------------------------- */

export function ReviewsPage() {
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAdminReviews());
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visible = rows.filter((row) => {
    if (tab === 'PUBLISHED' && !row.is_visible) return false;
    if (tab === 'UNPUBLISHED' && row.is_visible) return false;
    if (!search.trim()) return true;
    return `${row.title} ${row.body} ${row.product_name ?? ''} ${row.customer_name ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const selected = rows.find((row) => row.id === selectedId);

  const toggle = async (row: AdminReview) => {
    try {
      await setReviewVisibility(row.id, !row.is_visible);
      toast.success(row.is_visible ? 'Review hidden from the product page.' : 'Review published.');
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    }
  };

  const columns: Array<Column<AdminReview>> = [
    {
      key: 'product',
      label: 'Product',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>{row.product_name ?? 'Product removed'}</strong>
          <small>{row.customer_name ?? 'Customer account removed'}</small>
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (row) => stars(row.rating),
    },
    {
      key: 'review',
      label: 'Review',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong className="adm-clamp">{row.title || 'No title'}</strong>
          <small className="adm-clamp">{row.body}</small>
        </span>
      ),
    },
    {
      key: 'verified',
      label: 'Purchase',
      render: (row) => row.verified_purchase
        ? <span className="adm-flag is-ok">Verified</span>
        : <span className="adm-flag">Unverified</span>,
    },
    {
      key: 'submitted',
      label: 'Submitted',
      render: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }),
    },
    {
      key: 'status',
      label: 'Visibility',
      render: (row) => <StatusPill status={row.is_visible ? 'PUBLISHED' : 'HIDDEN'} label={row.is_visible ? 'Published' : 'Awaiting'} />,
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Engagement / Reviews"
        title="Reviews"
        description="Real customer reviews only. Publishing shows the review on its product page."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar>
        <CountTabs
          label="Filter reviews by visibility"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'ALL', label: 'All', count: rows.length },
            { key: 'UNPUBLISHED', label: 'Awaiting', count: rows.filter((row) => !row.is_visible).length },
            { key: 'PUBLISHED', label: 'Published', count: rows.filter((row) => row.is_visible).length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search review or product…" label="Search reviews" />
      </FilterBar>
      <DataTable
        ariaLabel="Reviews"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={(row) => setSelectedId(row.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<StarRegular />} title="No reviews" body="Reviews appear here after a customer submits one on a product page." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected?.title || 'Review'}
        description={selected?.product_name ?? undefined}
        footer={selected && (
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => void toggle(selected)}>
            {selected.is_visible ? 'Hide from product page' : 'Publish review'}
          </button>
        )}
      >
        {selected && (
          <>
            <div className="adm-review-head">
              {stars(selected.rating)}
              <StatusPill status={selected.is_visible ? 'PUBLISHED' : 'HIDDEN'} label={selected.is_visible ? 'Published' : 'Awaiting moderation'} />
            </div>
            <p className="adm-review-body">{selected.body}</p>
            <dl className="adm-key-values">
              <div><dt>Customer</dt><dd>{selected.customer_name ?? 'Account removed'}</dd></div>
              <div><dt>Product</dt><dd>{selected.product_name ?? 'Product removed'}</dd></div>
              <div><dt>Order</dt><dd>{selected.order_number ?? 'No order linked'}</dd></div>
              <div><dt>Order status</dt><dd>{selected.order_status ? nice(selected.order_status) : '—'}</dd></div>
              <div><dt>Submitted</dt><dd>{new Date(selected.created_at).toLocaleString('en-PK')}</dd></div>
              <div><dt>Purchase</dt><dd>{selected.verified_purchase ? 'Verified order' : 'Not verified'}</dd></div>
            </dl>
          </>
        )}
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- Feedback ------------------------------------------------------------ */

const feedbackStatuses = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const;

export function FeedbackPage() {
  const [rows, setRows] = useState<AdminFeedback[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'>('OPEN');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAdminFeedback());
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visible = rows.filter((row) => {
    if (tab !== 'ALL' && row.status !== tab) return false;
    if (!search.trim()) return true;
    return `${row.message} ${row.customer_name ?? ''} ${row.category}`.toLowerCase().includes(search.toLowerCase());
  });
  const selected = rows.find((row) => row.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status);
    setNotes(selected.internal_notes ?? '');
  }, [selected]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateFeedback(selected.id, status, notes);
      toast.success('Feedback updated.');
      setSelectedId('');
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<Column<AdminFeedback>> = [
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>{row.customer_name ?? 'Account removed'}</strong>
          <small>{row.category}</small>
        </span>
      ),
    },
    {
      key: 'message',
      label: 'Feedback',
      render: (row) => <span className="adm-clamp">{row.message}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (row) => row.rating ? stars(row.rating) : <span className="adm-missing">—</span>,
    },
    {
      key: 'created',
      label: 'Received',
      render: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }),
    },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Engagement / Feedback"
        title="Feedback"
        description="Messages customers send about the store. Internal notes never reach the customer."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar>
        <CountTabs
          label="Filter feedback by status"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'ALL', label: 'All', count: rows.length },
            ...feedbackStatuses.map((value) => ({
              key: value,
              label: nice(value),
              count: rows.filter((row) => row.status === value).length,
            })),
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search feedback…" label="Search feedback" />
      </FilterBar>
      <DataTable
        ariaLabel="Customer feedback"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={(row) => setSelectedId(row.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<ChatRegular />} title="No feedback" body="Customer feedback appears here after a real submission." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title="Feedback"
        description={selected?.customer_name ?? undefined}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setSelectedId('')} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save feedback'}
            </button>
          </>
        }
      >
        {selected && (
          <>
            <p className="adm-review-body">{selected.message}</p>
            <div className="adm-form-grid">
              <label className="adm-field">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                  {feedbackStatuses.map((value) => <option key={value} value={value}>{nice(value)}</option>)}
                </select>
              </label>
              <label className="adm-field is-wide">
                <span>Internal notes</span>
                <textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
            <dl className="adm-key-values">
              <div><dt>Category</dt><dd>{selected.category}</dd></div>
              <div><dt>Received</dt><dd>{new Date(selected.created_at).toLocaleString('en-PK')}</dd></div>
              <div><dt>Order</dt><dd>{selected.order_id ?? 'No order linked'}</dd></div>
            </dl>
          </>
        )}
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- Approvals ----------------------------------------------------------- */

const approvalTypes = ['PRODUCT_PUBLICATION', 'SUPPLIER_PURCHASE', 'REFUND', 'MAJOR_PRICE_CHANGE', 'PRODUCT_REMOVAL', 'OTHER'] as const;

export function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tab, setTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<{ request_type: typeof approvalTypes[number]; subject: string; details: string }>({
    request_type: 'PRODUCT_PUBLICATION',
    subject: '',
    details: '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listApprovalRequests());
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visible = rows.filter((row) => {
    if (tab !== 'ALL' && row.status !== tab) return false;
    if (!search.trim()) return true;
    return `${row.subject} ${row.details} ${row.request_type}`.toLowerCase().includes(search.toLowerCase());
  });
  const selected = rows.find((row) => row.id === selectedId);
  useEffect(() => { setNotes(selected?.decision_notes ?? ''); }, [selected]);

  const decide = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selected) return;
    setSaving(true);
    try {
      await decideApprovalRequest(selected.id, status, notes);
      toast.success(status === 'APPROVED' ? 'Request approved.' : 'Request rejected.');
      setSelectedId('');
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!draft.subject.trim()) {
      toast.error('Give the request a subject.');
      return;
    }
    setSaving(true);
    try {
      await createApprovalRequest({
        request_type: draft.request_type,
        subject: draft.subject,
        details: draft.details,
        metadata: {},
      });
      toast.success('Approval request created.');
      setCreateOpen(false);
      setDraft({ request_type: 'PRODUCT_PUBLICATION', subject: '', details: '' });
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<Column<ApprovalRow>> = [
    {
      key: 'subject',
      label: 'Request',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>{row.subject}</strong>
          <small>{nice(row.request_type)}</small>
        </span>
      ),
    },
    { key: 'created', label: 'Raised', render: (row) => timeAgo(new Date(row.created_at).getTime()) },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'decided', label: 'Decided', render: (row) => row.decided_at ? new Date(row.decided_at).toLocaleDateString('en-PK') : '—' },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="System / Approvals"
        title="Approvals"
        description="Changes that need a second pair of eyes. Approving performs no purchase."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => setCreateOpen(true)}>
            <AddRegular aria-hidden="true" /> Request approval
          </button>
        }
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar>
        <CountTabs
          label="Filter approvals by status"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'PENDING', label: 'Pending', count: rows.filter((row) => row.status === 'PENDING').length },
            { key: 'APPROVED', label: 'Approved', count: rows.filter((row) => row.status === 'APPROVED').length },
            { key: 'REJECTED', label: 'Rejected', count: rows.filter((row) => row.status === 'REJECTED').length },
            { key: 'ALL', label: 'All', count: rows.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search requests…" label="Search approvals" />
      </FilterBar>
      <DataTable
        ariaLabel="Approval requests"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={(row) => setSelectedId(row.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<CheckmarkCircleRegular />} title="Nothing waiting" body="Approval requests appear here when someone raises one." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected?.subject ?? 'Approval request'}
        description={selected ? nice(selected.request_type) : undefined}
        footer={selected?.status === 'PENDING' && (
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => void decide('REJECTED')} disabled={saving}>Reject</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void decide('APPROVED')} disabled={saving}>
              {saving ? 'Saving…' : 'Approve'}
            </button>
          </>
        )}
      >
        {selected && (
          <>
            <p className="adm-review-body">{selected.details || 'No extra details were provided.'}</p>
            <dl className="adm-key-values">
              <div><dt>Status</dt><dd><StatusPill status={selected.status} /></dd></div>
              <div><dt>Raised</dt><dd>{new Date(selected.created_at).toLocaleString('en-PK')}</dd></div>
              <div><dt>Decided</dt><dd>{selected.decided_at ? new Date(selected.decided_at).toLocaleString('en-PK') : 'Not decided'}</dd></div>
            </dl>
            {selected.status === 'PENDING' && (
              <label className="adm-field is-wide">
                <span>Decision notes</span>
                <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            )}
          </>
        )}
      </Drawer>

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Request approval"
        description="Raise something that needs a decision. No external action is triggered."
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void create()} disabled={saving}>
              {saving ? 'Saving…' : 'Raise request'}
            </button>
          </>
        }
      >
        <div className="adm-form-grid">
          <label className="adm-field">
            <span>Type</span>
            <select value={draft.request_type} onChange={(event) => setDraft({ ...draft, request_type: event.target.value as typeof draft.request_type })}>
              {approvalTypes.map((value) => <option key={value} value={value}>{nice(value)}</option>)}
            </select>
          </label>
          <label className="adm-field is-wide">
            <span>Subject</span>
            <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
          </label>
          <label className="adm-field is-wide">
            <span>Details</span>
            <textarea rows={5} value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} />
          </label>
        </div>
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- Automation logs ----------------------------------------------------- */

const automationStatuses = ['RUNNING', 'SUCCESS', 'FAILED', 'WAITING_APPROVAL', 'ESCALATED'] as const;

export function AutomationLogsPage() {
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedId, setSelectedId] = useState('');
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAutomationLogs());
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visible = rows.filter((row) => {
    if (status !== 'ALL' && row.status !== status) return false;
    if (!search.trim()) return true;
    return `${row.agent} ${row.task} ${row.action}`.toLowerCase().includes(search.toLowerCase());
  });
  const selected = rows.find((row) => row.id === selectedId);

  const columns: Array<Column<AutomationRow>> = [
    {
      key: 'agent',
      label: 'Agent',
      render: (row) => (
        <span className="adm-cell-stack"><strong>{row.agent}</strong><small>{row.task}</small></span>
      ),
    },
    { key: 'action', label: 'Action', render: (row) => <span className="adm-clamp">{row.action}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'approval', label: 'Approval', render: (row) => row.approval_status ? <StatusPill status={row.approval_status} /> : '—' },
    { key: 'when', label: 'Started', render: (row) => timeAgo(new Date(row.created_at).getTime()) },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="System / Automation logs"
        title="Automation logs"
        description="Read-only history of automated runs. No agents are connected to this store yet."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar count={`${visible.length} runs`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search agent, task or action…" label="Search automation logs" />
        <SelectFilter value={status} onChange={setStatus} label="Filter by run status">
          <option value="ALL">All statuses</option>
          {automationStatuses.map((value) => <option key={value} value={value}>{nice(value)}</option>)}
        </SelectFilter>
      </FilterBar>
      <DataTable
        ariaLabel="Automation logs"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={(row) => setSelectedId(row.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<BotRegular />} title="No automation runs" body="Nothing automated has run. Logs will appear here if an agent is connected later." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected?.task ?? 'Automation run'}
        description={selected?.agent}
      >
        {selected && (
          <dl className="adm-key-values">
            <div><dt>Action</dt><dd>{selected.action}</dd></div>
            <div><dt>Status</dt><dd><StatusPill status={selected.status} /></dd></div>
            <div><dt>Approval</dt><dd>{selected.approval_status ? <StatusPill status={selected.approval_status} /> : 'Not required'}</dd></div>
            <div><dt>Started</dt><dd>{new Date(selected.created_at).toLocaleString('en-PK')}</dd></div>
            <div><dt>Completed</dt><dd>{selected.completed_at ? new Date(selected.completed_at).toLocaleString('en-PK') : 'Still running'}</dd></div>
            <div><dt>Error</dt><dd>{selected.error || 'None recorded'}</dd></div>
          </dl>
        )}
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}
