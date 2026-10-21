import { useEffect, useState, type FormEvent } from 'react';
import {
  Badge, Body1, Button, Card, Caption1, Checkbox, Field, Input, MessageBar,
  MessageBarBody, Select, Subtitle1, Textarea, Title3,
} from '@fluentui/react-components';
import { Option } from './SelectOption';
import { AddRegular, ArrowSyncRegular, SaveRegular } from '@fluentui/react-icons';
import type { FaqTopic, ReturnRequestStatus, SupportConversationStatus } from '../lib/supabase';
import {
  addSupportInternalNote, getAdminSupportConversation, listAdminFaqs,
  listAdminReturnRequests, listAdminSupportConversations, replyAsAdmin,
  saveFaq, updateReturnRequest, updateSupportConversationStatus,
  type AdminReturnRequest, type AdminSupportConversation, type FaqEntry,
  type SupportInternalNote, type SupportMessage,
} from '../api/trust';

const messageText = (reason: unknown) => reason instanceof Error ? reason.message : 'The request could not be completed.';
const titleCase = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const returnStatuses: ReturnRequestStatus[] = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'REFUNDED', 'REPLACEMENT_SENT', 'CLOSED'];
const supportStatuses: SupportConversationStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];
const faqTopics: Array<[FaqTopic, string]> = [
  ['PRODUCTS', 'Products'], ['ORDERS', 'Orders'], ['DELIVERY', 'Delivery'], ['RETURNS', 'Returns'], ['WARRANTY', 'Warranty'],
  ['COMPATIBILITY', 'Compatibility'], ['INSTALLATION', 'Installation'], ['PAYMENT', 'Payment'], ['SUPPLIER_FULFILLMENT', 'Supplier fulfilment'],
  ['SUPPORT', 'Support'],
];

export function AdminReturnsPage() {
  const [rows, setRows] = useState<AdminReturnRequest[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<ReturnRequestStatus>('REQUESTED');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setRows(await listAdminReturnRequests()); } catch (reason: unknown) { setError(messageText(reason)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const selected = rows.find((row) => row.id === selectedId);
  useEffect(() => { if (selected) { setStatus(selected.status); setNotes(selected.internal_notes ?? ''); } }, [selected]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    if (['APPROVED', 'REFUNDED'].includes(status) && !window.confirm(`Set this request to ${titleCase(status)}? This records an admin decision only; it does not issue a payment or perform a refund.`)) return;
    setSaving(true); setError(''); setNotice('');
    try { await updateReturnRequest(selected.id, status, notes); setNotice('Return request decision saved. No payment action was performed.'); await load(); }
    catch (reason: unknown) { setError(messageText(reason)); }
    finally { setSaving(false); }
  };
  return <div className="admin-page-content trust-admin-page">
    <div className="admin-section-title"><Body1>Review each customer request before recording a decision. No refunds are issued automatically.</Body1><Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => void load()}>Refresh</Button></div>
    <AdminNotice error={error} success={notice} />
    {loading ? <AdminLoading /> : rows.length ? <div className="trust-admin-layout"><div className="admin-record-list">{rows.map((row) => <button type="button" className={`admin-order-select${row.id === selectedId ? ' selected' : ''}`} key={row.id} onClick={() => setSelectedId(row.id)}><span><strong>{row.order_number ?? row.order_id}</strong><Caption1>{row.customer_name ?? 'Customer'} · {row.product_name ?? 'Item unavailable'}</Caption1></span><span><Badge>{titleCase(row.status)}</Badge><Caption1>{titleCase(row.reason)}</Caption1></span></button>)}</div>
      {selected ? <Card className="admin-order-detail"><Caption1>{selected.order_number ?? selected.order_id}</Caption1><Title3>{selected.product_name ?? 'Order item'}</Title3><Body1>{selected.customer_name ?? selected.customer_id}</Body1><Badge>{titleCase(selected.reason)}</Badge><Body1>{selected.description || 'No additional description.'}</Body1><Caption1>Submitted {new Date(selected.created_at).toLocaleString()}</Caption1>
        <form className="trust-form" onSubmit={(event) => void save(event)}><Field label="Request status"><Select value={status} onChange={(_, data) => setStatus(data.value as ReturnRequestStatus)}>{returnStatuses.map((value) => <Option key={value} value={value} text={titleCase(value)}>{titleCase(value)}</Option>)}</Select></Field><Field label="Admin-only notes"><Textarea value={notes} onChange={(_, data) => setNotes(data.value)} /></Field><Button appearance="primary" type="submit" icon={<SaveRegular />} disabled={saving}>{saving ? 'Saving…' : 'Save decision'}</Button></form>
      </Card> : <EmptyAdmin title="Select a request" detail="Request details will appear here." />}</div> : <EmptyAdmin title="No return requests" detail="Customer requests will appear here after submission." />}
  </div>;
}

export function AdminSupportPage() {
  const [rows, setRows] = useState<AdminSupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<SupportConversationStatus>('OPEN');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notes, setNotes] = useState<SupportInternalNote[]>([]);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const conversations = await listAdminSupportConversations(); setRows(conversations);
      if (selectedId) {
        const [thread, selected] = await Promise.all([getAdminSupportConversation(selectedId), Promise.resolve(conversations.find((row) => row.id === selectedId))]);
        setMessages(thread.messages); setNotes(thread.notes); if (selected) setStatus(selected.status);
      }
    } catch (reason: unknown) { setError(messageText(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const select = async (row: AdminSupportConversation) => {
    setSelectedId(row.id); setStatus(row.status); setError('');
    try { const thread = await getAdminSupportConversation(row.id); setMessages(thread.messages); setNotes(thread.notes); }
    catch (reason: unknown) { setError(messageText(reason)); }
  };
  const changeStatus = async (next: SupportConversationStatus) => {
    if (!selectedId) return;
    setSaving(true); setError(''); setNotice('');
    try { await updateSupportConversationStatus(selectedId, next); setStatus(next); setNotice('Conversation status updated.'); await load(); }
    catch (reason: unknown) { setError(messageText(reason)); }
    finally { setSaving(false); }
  };
  const sendReply = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedId) return;
    setSaving(true); setError(''); setNotice('');
    try { await replyAsAdmin(selectedId, reply); setReply(''); setNotice('Reply sent to the customer.'); await load(); }
    catch (reason: unknown) { setError(messageText(reason)); }
    finally { setSaving(false); }
  };
  const saveNote = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedId) return;
    setSaving(true); setError(''); setNotice('');
    try { await addSupportInternalNote(selectedId, internalNote); setInternalNote(''); setNotice('Internal note saved.'); await load(); }
    catch (reason: unknown) { setError(messageText(reason)); }
    finally { setSaving(false); }
  };
  const selected = rows.find((row) => row.id === selectedId);
  return <div className="admin-page-content trust-admin-page">
    <div className="admin-section-title"><Body1>Customer replies are visible to the customer; internal notes are restricted to admins.</Body1><Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => void load()}>Refresh</Button></div>
    <AdminNotice error={error} success={notice} />
    {loading ? <AdminLoading /> : rows.length ? <div className="trust-admin-layout"><div className="admin-record-list">{rows.map((row) => <button type="button" className={`admin-order-select${row.id === selectedId ? ' selected' : ''}`} key={row.id} onClick={() => void select(row)}><span><strong>{row.subject}</strong><Caption1>{row.customer_name ?? row.customer_id} · {row.order_number ?? 'No linked order'}</Caption1></span><Badge>{titleCase(row.status)}</Badge></button>)}</div>
      {selected ? <Card className="admin-order-detail"><div className="support-conversation-head"><div><Caption1>{titleCase(selected.category)} · {selected.order_number ?? 'No linked order'}</Caption1><Title3>{selected.subject}</Title3></div><Badge>{titleCase(status)}</Badge></div>
        <Field label="Conversation status"><Select value={status} onChange={(_, data) => void changeStatus(data.value as SupportConversationStatus)} disabled={saving}>{supportStatuses.map((value) => <Option key={value} value={value} text={titleCase(value)}>{titleCase(value)}</Option>)}</Select></Field>
        <div className="support-message-list">{messages.map((message) => <Card className="support-message" key={message.id}><div className="trust-record-heading"><strong>{message.sender_role === 'ADMIN' ? 'MotoGear PK' : 'Customer'}</strong><Caption1>{new Date(message.created_at).toLocaleString()}</Caption1></div><Body1>{message.body}</Body1></Card>)}</div>
        <form className="trust-form" onSubmit={(event) => void sendReply(event)}><Field label="Reply to customer" required><Textarea value={reply} onChange={(_, data) => setReply(data.value)} required /></Field><Button appearance="primary" type="submit" disabled={saving || !reply.trim()}>Send reply</Button></form>
        <div className="support-internal-notes"><Subtitle1>Admin-only notes</Subtitle1>{notes.map((note) => <Card className="trust-record" key={note.id}><Body1>{note.body}</Body1><Caption1>{new Date(note.created_at).toLocaleString()}</Caption1></Card>)}<form className="trust-form" onSubmit={(event) => void saveNote(event)}><Field label="Add internal note" required><Textarea value={internalNote} onChange={(_, data) => setInternalNote(data.value)} required /></Field><Button appearance="secondary" type="submit" disabled={saving || !internalNote.trim()}>Save internal note</Button></form></div>
      </Card> : <EmptyAdmin title="Select a conversation" detail="Conversation messages will appear here." />}</div> : <EmptyAdmin title="No conversations" detail="Customer support conversations will appear here." />}
  </div>;
}

export function AdminFaqPage() {
  const blank: FaqInputState = { topic: 'ORDERS', question: '', answer: '', active: false, sort_order: 0 };
  const [rows, setRows] = useState<FaqEntry[]>([]);
  const [form, setForm] = useState<FaqInputState>(blank);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setRows(await listAdminFaqs()); } catch (reason: unknown) { setError(messageText(reason)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try { await saveFaq(form, editingId || undefined); setNotice(editingId ? 'FAQ updated.' : 'FAQ added.'); setForm(blank); setEditingId(''); await load(); }
    catch (reason: unknown) { setError(messageText(reason)); }
    finally { setSaving(false); }
  };
  const edit = (row: FaqEntry) => { setEditingId(row.id); setForm({ topic: row.topic, question: row.question, answer: row.answer, active: row.active, sort_order: row.sort_order }); };
  const toggle = async (row: FaqEntry) => { setError(''); setNotice(''); try { await saveFaq({ topic: row.topic, question: row.question, answer: row.answer, active: !row.active, sort_order: row.sort_order }, row.id); setNotice(row.active ? 'FAQ disabled.' : 'FAQ published.'); await load(); } catch (reason: unknown) { setError(messageText(reason)); } };
  return <div className="admin-page-content trust-admin-page">
    <AdminNotice error={error} success={notice} />
    <Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void submit(event)}>
      <Field label="Topic" required><Select value={form.topic} onChange={(_, data) => setForm({ ...form, topic: data.value as FaqTopic })}>{faqTopics.map(([value, label]) => <Option key={value} value={value} text={label}>{label}</Option>)}</Select></Field>
      <Field label="Display order" required><Input type="number" value={String(form.sort_order)} onChange={(_, data) => setForm({ ...form, sort_order: Number(data.value) })} required /></Field>
      <Field label="Question" required className="admin-wide"><Input value={form.question} onChange={(_, data) => setForm({ ...form, question: data.value })} required /></Field>
      <Field label="Answer" required className="admin-wide"><Textarea value={form.answer} onChange={(_, data) => setForm({ ...form, answer: data.value })} required /></Field>
      <Checkbox label="Published in help centre" checked={form.active} onChange={(_, data) => setForm({ ...form, active: Boolean(data.checked) })} />
      <div className="admin-inline-actions"><Button appearance="primary" type="submit" icon={<SaveRegular />} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save FAQ' : 'Add FAQ'}</Button>{editingId && <Button appearance="subtle" onClick={() => { setEditingId(''); setForm(blank); }}>Cancel edit</Button>}</div>
    </form></Card>
    <div className="admin-section-title"><Subtitle1>FAQ entries</Subtitle1><Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => void load()}>Refresh</Button></div>
    {loading ? <AdminLoading /> : rows.length ? <div className="admin-record-list">{rows.map((row) => <Card className="admin-record admin-multiline" key={row.id}><div className="admin-record-main"><Subtitle1>{row.question}</Subtitle1><Caption1>{faqTopics.find(([value]) => value === row.topic)?.[1]} · Order {row.sort_order} · {row.active ? 'Published' : 'Disabled'}</Caption1><Body1>{row.answer}</Body1></div><div className="admin-record-actions"><Button appearance="subtle" onClick={() => edit(row)}>Edit / reorder</Button><Button appearance="subtle" onClick={() => void toggle(row)}>{row.active ? 'Disable' : 'Publish'}</Button></div></Card>)}</div> : <EmptyAdmin title="No FAQ entries" detail="Add real answers from your customer policy; nothing has been seeded." />}
  </div>;
}

interface FaqInputState { topic: FaqTopic; question: string; answer: string; active: boolean; sort_order: number; }
function AdminNotice({ error, success }: { error?: string; success?: string }) { return <>{error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}{success && <MessageBar intent="success"><MessageBarBody>{success}</MessageBarBody></MessageBar>}</>; }
function AdminLoading() { return <div className="admin-loading" role="status">Loading live Supabase records…</div>; }
function EmptyAdmin({ title, detail }: { title: string; detail: string }) { return <Card className="empty-state admin-empty"><Title3>{title}</Title3><Body1>{detail}</Body1></Card>; }