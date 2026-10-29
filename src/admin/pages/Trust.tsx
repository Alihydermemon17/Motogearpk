import { useEffect, useState, type ReactNode } from 'react';
import {
  AddRegular,
  ArrowUndoRegular,
  ChatRegular,
  EditRegular,
  QuestionRegular,
  SendRegular,
} from '@fluentui/react-icons';
import type { FaqTopic, ReturnRequestStatus, SupportConversationStatus } from '../../lib/supabase';
import {
  addSupportInternalNote,
  getAdminSupportConversation,
  listAdminFaqs,
  listAdminReturnRequests,
  listAdminSupportConversations,
  replyAsAdmin,
  saveFaq,
  updateReturnRequest,
  updateSupportConversationStatus,
  type AdminReturnRequest,
  type AdminSupportConversation,
  type FaqEntry,
  type SupportInternalNote,
  type SupportMessage,
} from '../../api/trust';
import {
  ConfirmDialog,
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
  useToast,
  type Column,
} from '../components/ui';

/* --- Returns ------------------------------------------------------------- */

const returnStatuses: ReturnRequestStatus[] = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'REFUNDED',
  'REPLACEMENT_SENT',
  'CLOSED',
];

const returnTabs = [
  { key: 'ALL', label: 'All', match: () => true },
  { key: 'OPEN', label: 'Open', match: (status: string) => ['REQUESTED', 'UNDER_REVIEW'].includes(status) },
  { key: 'APPROVED', label: 'Approved', match: (status: string) => status === 'APPROVED' },
  { key: 'DONE', label: 'Completed', match: (status: string) => ['RETURNED', 'REFUNDED', 'REPLACEMENT_SENT', 'CLOSED'].includes(status) },
  { key: 'REJECTED', label: 'Rejected', match: (status: string) => status === 'REJECTED' },
];

export function ReturnsPage() {
  const [rows, setRows] = useState<AdminReturnRequest[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<ReturnRequestStatus>('REQUESTED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAdminReturnRequests());
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const activeTab = returnTabs.find((item) => item.key === tab) ?? returnTabs[0];
  const visible = rows.filter((row) => {
    if (!activeTab.match(row.status)) return false;
    if (!search.trim()) return true;
    return `${row.order_number ?? ''} ${row.customer_name ?? ''} ${row.product_name ?? ''} ${row.reason} ${row.status}`
      .toLowerCase()
      .includes(search.toLowerCase());
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
      await updateReturnRequest(selected.id, status, notes);
      toast.success('Return decision saved. No payment action was performed.');
      setSelectedId('');
      setConfirmOpen(false);
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (['APPROVED', 'REFUNDED'].includes(status)) {
      setConfirmOpen(true);
      return;
    }
    void save();
  };

  const columns: Array<Column<AdminReturnRequest>> = [
    {
      key: 'order',
      label: 'Request',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>#{row.order_number ?? row.order_id.slice(0, 8)}</strong>
          <small>{row.customer_name ?? 'Customer account removed'}</small>
        </span>
      ),
    },
    { key: 'product', label: 'Item', render: (row) => <span className="adm-clamp">{row.product_name ?? 'Item unavailable'}</span> },
    { key: 'reason', label: 'Reason', render: (row) => nice(row.reason) },
    { key: 'submitted', label: 'Submitted', render: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Sales / Returns"
        title="Returns"
        description="Decide return requests. Refunds are issued separately."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar>
        <CountTabs
          label="Filter returns by status"
          active={tab}
          onChange={setTab}
          tabs={returnTabs.map((item) => ({
            key: item.key,
            label: item.label,
            count: rows.filter((row) => item.match(row.status)).length,
          }))}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Order, customer or item…" label="Search returns" />
      </FilterBar>
      <DataTable
        ariaLabel="Return requests"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={(row) => setSelectedId(row.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<ArrowUndoRegular />} title="No return requests" body="Requests appear here after a customer submits one from an order." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected ? `Return · #${selected.order_number ?? selected.order_id.slice(0, 8)}` : 'Return'}
        description={selected?.product_name ?? undefined}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setSelectedId('')} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={requestSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save decision'}
            </button>
          </>
        }
      >
        {selected && (
          <>
            <dl className="adm-key-values">
              <div><dt>Customer</dt><dd>{selected.customer_name ?? 'Account removed'}</dd></div>
              <div><dt>Reason</dt><dd>{nice(selected.reason)}</dd></div>
              <div><dt>Submitted</dt><dd>{new Date(selected.created_at).toLocaleString('en-PK')}</dd></div>
              <div><dt>Decided</dt><dd>{selected.decided_at ? new Date(selected.decided_at).toLocaleString('en-PK') : 'Not decided'}</dd></div>
            </dl>
            <p className="adm-review-body">{selected.description || 'No additional description was provided.'}</p>
            <div className="adm-form-grid">
              <label className="adm-field">
                <span>Request status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as ReturnRequestStatus)}>
                  {returnStatuses.map((value) => <option key={value} value={value}>{nice(value)}</option>)}
                </select>
              </label>
              <label className="adm-field is-wide">
                <span>Admin-only notes</span>
                <textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
            <p className="adm-hint">Approving or refunding here records a decision only. It does not issue a payment.</p>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title={status === 'REFUNDED' ? 'Record this return as refunded?' : 'Approve this return?'}
        body="This records an admin decision. No money is moved and no courier is booked. Issue any refund in your payment channel separately."
        confirmLabel={status === 'REFUNDED' ? 'Record refunded' : 'Approve return'}
        onConfirm={() => void save()}
        onCancel={() => setConfirmOpen(false)}
      />

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- Support ------------------------------------------------------------- */

const supportStatuses: SupportConversationStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];

export function SupportPage() {
  const [rows, setRows] = useState<AdminSupportConversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notes, setNotes] = useState<SupportInternalNote[]>([]);
  const [status, setStatus] = useState<SupportConversationStatus>('OPEN');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [threadBusy, setThreadBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAdminSupportConversations());
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
    return `${row.subject} ${row.customer_name ?? ''} ${row.order_number ?? ''}`.toLowerCase().includes(search.toLowerCase());
  });

  const selected = rows.find((row) => row.id === selectedId);

  const openThread = async (id: string) => {
    setSelectedId(id);
    setThreadBusy(true);
    try {
      const thread = await getAdminSupportConversation(id);
      setMessages(thread.messages);
      setNotes(thread.notes);
      const row = rows.find((item) => item.id === id);
      if (row) setStatus(row.status);
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setThreadBusy(false);
    }
  };

  const changeStatus = async (next: SupportConversationStatus) => {
    if (!selected) return;
    setSending(true);
    try {
      await updateSupportConversationStatus(selected.id, next);
      setStatus(next);
      toast.success('Conversation status updated.');
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSending(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await replyAsAdmin(selected.id, reply);
      setReply('');
      toast.success('Reply sent to the customer.');
      const thread = await getAdminSupportConversation(selected.id);
      setMessages(thread.messages);
      setNotes(thread.notes);
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSending(false);
    }
  };

  const addNote = async () => {
    if (!selected || !note.trim()) return;
    setSending(true);
    try {
      await addSupportInternalNote(selected.id, note);
      setNote('');
      toast.success('Internal note saved.');
      const thread = await getAdminSupportConversation(selected.id);
      setNotes(thread.notes);
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSending(false);
    }
  };

  const columns: Array<Column<AdminSupportConversation>> = [
    {
      key: 'subject',
      label: 'Conversation',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>{row.subject}</strong>
          <small>{row.customer_name ?? 'Customer account removed'} · {nice(row.category)}</small>
        </span>
      ),
    },
    { key: 'order', label: 'Order', render: (row) => row.order_number ? `#${row.order_number.replace(/^#/, '')}` : '—' },
    { key: 'updated', label: 'Last message', render: (row) => new Date(row.updated_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Engagement / Support"
        title="Support"
        description="Customer conversations. Replies are visible to the customer; notes are admin-only."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar>
        <CountTabs
          label="Filter conversations by status"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'ALL', label: 'All', count: rows.length },
            ...supportStatuses.map((value) => ({
              key: value,
              label: nice(value),
              count: rows.filter((row) => row.status === value).length,
            })),
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search subject or customer…" label="Search support conversations" />
      </FilterBar>
      <DataTable
        ariaLabel="Support conversations"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={(row) => void openThread(row.id)}
        selectedId={selectedId}
        empty={<EmptyState icon={<ChatRegular />} title="No conversations" body="Customer support threads appear here after a real request." />}
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        size="wide"
        title={selected?.subject ?? 'Conversation'}
        description={selected ? `${selected.customer_name ?? 'Customer'} · ${selected.order_number ? `Order #${selected.order_number.replace(/^#/, '')}` : 'No linked order'}` : undefined}
      >
        {selected && (
          <>
            <div className="adm-inline-row">
              <label className="adm-field">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event) => void changeStatus(event.target.value as SupportConversationStatus)}
                  disabled={sending}
                >
                  {supportStatuses.map((value) => <option key={value} value={value}>{nice(value)}</option>)}
                </select>
              </label>
            </div>

            <section className="adm-thread" aria-label="Conversation messages" aria-busy={threadBusy}>
              {threadBusy && <p className="adm-hint">Loading the conversation…</p>}
              {!threadBusy && messages.length === 0 && <p className="adm-panel-empty">No messages recorded.</p>}
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`adm-message${message.sender_role === 'ADMIN' ? ' is-admin' : ''}`}
                >
                  <header>
                    <strong>{message.sender_role === 'ADMIN' ? 'MotoGear PK' : 'Customer'}</strong>
                    <span>{new Date(message.created_at).toLocaleString('en-PK')}</span>
                  </header>
                  <p>{message.body}</p>
                </article>
              ))}
            </section>

            <label className="adm-field is-wide">
              <span>Reply to customer</span>
              <textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} />
            </label>
            <div className="adm-detail-actions">
              <button type="button" className="adm-btn adm-btn--primary" onClick={() => void sendReply()} disabled={sending || !reply.trim()}>
                <SendRegular aria-hidden="true" />
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </div>

            <section className="adm-thread-notes">
              <h3>Admin-only notes</h3>
              {notes.length === 0 && <p className="adm-hint">No internal notes yet.</p>}
              {notes.map((row) => (
                <article key={row.id} className="adm-note">
                  <p>{row.body}</p>
                  <span>{new Date(row.created_at).toLocaleString('en-PK')}</span>
                </article>
              ))}
              <label className="adm-field is-wide">
                <span>Add internal note</span>
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <button type="button" className="adm-btn adm-btn--quiet" onClick={() => void addNote()} disabled={sending || !note.trim()}>
                Save internal note
              </button>
            </section>
          </>
        )}
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- FAQs ---------------------------------------------------------------- */

const faqTopics: Array<[FaqTopic, string]> = [
  ['PRODUCTS', 'Products'],
  ['ORDERS', 'Orders'],
  ['DELIVERY', 'Delivery'],
  ['RETURNS', 'Returns'],
  ['WARRANTY', 'Warranty'],
  ['COMPATIBILITY', 'Compatibility'],
  ['INSTALLATION', 'Installation'],
  ['PAYMENT', 'Payment'],
  ['SUPPLIER_FULFILLMENT', 'Supplier fulfilment'],
  ['SUPPORT', 'Support'],
];

type FaqForm = { topic: FaqTopic; question: string; answer: string; active: boolean; sort_order: number };

const blankFaq: FaqForm = { topic: 'ORDERS', question: '', answer: '', active: false, sort_order: 0 };

export function FaqsPage() {
  const [rows, setRows] = useState<FaqEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('ALL');
  const [form, setForm] = useState<FaqForm>(blankFaq);
  const [editingId, setEditingId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAdminFaqs());
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
    if (topic !== 'ALL' && row.topic !== topic) return false;
    if (!search.trim()) return true;
    return `${row.question} ${row.answer}`.toLowerCase().includes(search.toLowerCase());
  });

  const start = (row?: FaqEntry) => {
    setEditingId(row?.id ?? '');
    setForm(row ? {
      topic: row.topic,
      question: row.question,
      answer: row.answer,
      active: row.active,
      sort_order: row.sort_order,
    } : blankFaq);
    setFormError('');
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      setFormError('Question and answer are both required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await saveFaq(form, editingId || undefined);
      toast.success(editingId ? 'FAQ saved.' : 'FAQ added.');
      setDrawerOpen(false);
      await load();
    } catch (reason: unknown) {
      const message = failureText(reason);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: FaqEntry) => {
    try {
      await saveFaq({
        topic: row.topic,
        question: row.question,
        answer: row.answer,
        active: !row.active,
        sort_order: row.sort_order,
      }, row.id);
      toast.success(row.active ? 'FAQ hidden from the help centre.' : 'FAQ published.');
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    }
  };

  const columns: Array<Column<FaqEntry>> = [
    {
      key: 'question',
      label: 'Question',
      render: (row) => (
        <span className="adm-cell-stack">
          <strong>{row.question}</strong>
          <small className="adm-clamp">{row.answer}</small>
        </span>
      ),
    },
    { key: 'topic', label: 'Topic', render: (row) => faqTopics.find(([value]) => value === row.topic)?.[1] ?? nice(row.topic) },
    { key: 'order', label: 'Order', align: 'right', render: (row) => <span className="adm-num">{row.sort_order}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.active ? 'PUBLISHED' : 'HIDDEN'} label={row.active ? 'Published' : 'Hidden'} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <span className="adm-row-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => start(row)}>
            <EditRegular aria-hidden="true" /> Edit
          </button>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => void toggle(row)}>
            {row.active ? 'Hide' : 'Publish'}
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Engagement / FAQs"
        title="FAQs"
        description="Answers shown in the help centre. Only publish policy you can stand behind."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => start()}>
            <AddRegular aria-hidden="true" /> Add FAQ
          </button>
        }
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar count={`${visible.length} of ${rows.length} entries`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search question or answer…" label="Search FAQs" />
        <SelectFilter value={topic} onChange={setTopic} label="Filter by topic">
          <option value="ALL">All topics</option>
          {faqTopics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectFilter>
      </FilterBar>
      <DataTable
        ariaLabel="FAQ entries"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={start}
        empty={<EmptyState icon={<QuestionRegular />} title="No FAQ entries" body="Add answers from your real policy. Nothing is seeded." actionLabel="Add FAQ" onAction={() => start()} />}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit FAQ' : 'Add FAQ'}
        description="Display order controls where the entry appears inside its topic."
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save FAQ' : 'Add FAQ'}
            </button>
          </>
        }
      >
        {formError && <div className="adm-inline-error" role="alert">{formError}</div>}
        <div className="adm-form-grid">
          <label className="adm-field">
            <span>Topic</span>
            <select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value as FaqTopic })}>
              {faqTopics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>Display order</span>
            <input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} />
          </label>
          <label className="adm-field is-wide">
            <span>Question</span>
            <input value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} />
          </label>
          <label className="adm-field is-wide">
            <span>Answer</span>
            <textarea rows={8} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
            <small>{form.answer.length} characters</small>
          </label>
          <label className="adm-check is-wide">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Published in the help centre
          </label>
        </div>
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* Keep the import list honest: these are used by the pages above. */
type _Unused = ReactNode;
