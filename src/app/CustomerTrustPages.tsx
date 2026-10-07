import { useEffect, useState, type FormEvent } from 'react';
import {
  Badge, Body1, Button, Card, Caption1, Field, Input, MessageBar, MessageBarBody,
  Option, Select, Skeleton, SkeletonItem, Subtitle1, Textarea, Title1, Title3,
} from '@fluentui/react-components';
import { ArrowRightRegular, CheckmarkCircleRegular, LockClosedRegular } from '@fluentui/react-icons';
import type { Product } from '../api/types';
import type { CustomerOrder, CustomerOrderItem } from '../api/customer';
import type { FaqTopic, ReturnReason, SupportCategory, SupportConversationStatus } from '../lib/supabase';
import { useCustomerAuth } from './CustomerState';
import {
  createReturnRequest, createSupportConversation, customerFeedbackForOrder,
  customerReviewForProduct, getCustomerSupportConversation, getPublicProductReviews,
  getPublicTrustSettings, listCustomerReturnRequests, listCustomerSupportConversations,
  listReviewableOrders, listSupportOrderOptions, sendCustomerSupportMessage,
  submitOrderFeedback, submitProductReview, type PublicReviewSummary, type PublicTrustSettings,
  type ReviewableOrder, type SupportConversation, type SupportMessage, type SupportOrderOption,
} from '../api/trust';
import { formatBusinessMoney } from '../lib/businessDisplay';

type Navigate = (path: string) => void;
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : 'The request could not be completed.';
const statusText = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const reasons: Array<[ReturnReason, string]> = [
  ['DAMAGED', 'Product damaged'], ['NOT_WORKING', 'Product not working'], ['WRONG_PRODUCT', 'Wrong product'],
  ['COMPATIBILITY', 'Compatibility issue'], ['DIFFERENT_FROM_LISTING', 'Different from listing'], ['MISSING_ITEM', 'Missing item'], ['OTHER', 'Other'],
];
const supportCategories: Array<[SupportCategory, string]> = [
  ['PRODUCT_QUESTION', 'Product question'], ['COMPATIBILITY', 'Compatibility'], ['ORDER_STATUS', 'Order status'],
  ['DELIVERY', 'Delivery'], ['WARRANTY', 'Warranty'], ['RETURN', 'Return'], ['REFUND', 'Refund'], ['COMPLAINT', 'Complaint'], ['OTHER', 'Other'],
];
const faqTopics: Array<[FaqTopic, string]> = [
  ['PRODUCTS', 'Products'], ['ORDERS', 'Orders'], ['DELIVERY', 'Delivery'], ['RETURNS', 'Returns'], ['WARRANTY', 'Warranty'],
  ['COMPATIBILITY', 'Compatibility'], ['INSTALLATION', 'Installation'], ['PAYMENT', 'Payment'], ['SUPPLIER_FULFILLMENT', 'Supplier fulfilment'],
];

export function ProductReviews({ product, navigate }: { product: Product; navigate: Navigate }) {
  const auth = useCustomerAuth();
  const [summary, setSummary] = useState<PublicReviewSummary | null>(null);
  const [orders, setOrders] = useState<ReviewableOrder[]>([]);
  const [ownReview, setOwnReview] = useState<Awaited<ReturnType<typeof customerReviewForProduct>>>(null);
  const [orderId, setOrderId] = useState('');
  const [rating, setRating] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setBusy(true); setError('');
    try {
      const publicSummary = await getPublicProductReviews(product.id);
      setSummary(publicSummary);
      if (auth.user) {
        const [eligible, review] = await Promise.all([listReviewableOrders(product.id), customerReviewForProduct(product.id)]);
        setOrders(eligible); setOwnReview(review);
        setOrderId((current) => current || eligible[0]?.id || '');
      }
    } catch (reason: unknown) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [product.id, auth.user?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await submitProductReview({ productId: product.id, orderId, rating: Number(rating), title, body });
      setNotice('Review submitted for moderation.'); setTitle(''); setBody(''); setRating(''); await load();
    } catch (reason: unknown) { setError(errorText(reason)); }
    finally { setSaving(false); }
  };

  return <section className="trust-section customer-reviews" aria-labelledby="product-reviews-title">
    <div className="section-head"><div><Caption1 className="section-kicker">CUSTOMER REVIEWS</Caption1><Title3 id="product-reviews-title">Reviews</Title3></div>
      {summary && <Badge appearance="tint">{summary.averageRating === null ? 'No rating yet' : `${summary.averageRating.toFixed(1)} / 5`} · {summary.reviewCount} {summary.reviewCount === 1 ? 'review' : 'reviews'}</Badge>}
    </div>
    {error && <MessageBar intent="error"><MessageBarBody>{error} <Button appearance="transparent" onClick={() => void load()}>Try again</Button></MessageBarBody></MessageBar>}
    {!busy && summary && summary.reviewCount > 0 && <div className="review-breakdown" aria-label="Rating breakdown">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = summary.ratingCounts[stars as 1 | 2 | 3 | 4 | 5];
        return <div className="review-breakdown-row" key={stars}><span>{stars} stars</span><progress max={summary.reviewCount} value={count} aria-label={`${count} ${stars}-star reviews`} /><span>{count}</span></div>;
      })}
    </div>}
    {busy ? <Skeleton><SkeletonItem /><SkeletonItem /><SkeletonItem /></Skeleton> : summary?.reviews.length ? <div className="trust-record-list">
      {summary.reviews.map((review) => <Card className="trust-record" key={review.id}>
        <div className="trust-record-heading"><strong>{review.rating} / 5</strong><Caption1>{new Date(review.created_at).toLocaleDateString()}</Caption1>{review.verified_purchase && <Badge color="success" icon={<CheckmarkCircleRegular />}>Verified Purchase</Badge>}</div>
        {review.title && <Subtitle1>{review.title}</Subtitle1>}<Body1>{review.body}</Body1>
      </Card>)}
    </div> : <Card className="empty-state trust-empty"><Title3>No reviews yet</Title3><Body1>Customer reviews will appear after they are submitted and approved.</Body1></Card>}
    {!auth.user && <div className="trust-form-note"><Body1>Only customers with a delivered order for this product can submit a review.</Body1><Button appearance="secondary" icon={<LockClosedRegular />} onClick={() => navigate('/login')}>Sign in</Button></div>}
    {auth.user && ownReview && <MessageBar intent="info"><MessageBarBody>{ownReview.is_visible ? 'You have already reviewed this product.' : 'Your submitted review is waiting for moderation.'}</MessageBarBody></MessageBar>}
    {auth.user && !ownReview && !busy && orders.length === 0 && <Caption1 className="trust-muted">A review form will be available after a delivered order containing this product.</Caption1>}
    {auth.user && !ownReview && orders.length > 0 && <form className="trust-form" onSubmit={(event) => void submit(event)}>
      <Subtitle1>Write a review</Subtitle1>
      <Field label="Eligible delivered order" required><Select value={orderId} onChange={(_, data) => setOrderId(data.value)} required>{orders.map((order) => <Option key={order.id} value={order.id} text={order.order_number}>{order.order_number} · {new Date(order.created_at).toLocaleDateString()}</Option>)}</Select></Field>
      <Field label="Rating" required><Select value={rating} onChange={(_, data) => setRating(data.value)} required><Option value="" text="Choose a rating">Choose a rating</Option>{[5, 4, 3, 2, 1].map((value) => <Option key={value} value={String(value)} text={`${value} / 5`}>{value} / 5</Option>)}</Select></Field>
      <Field label="Title"><Input maxLength={120} value={title} onChange={(_, data) => setTitle(data.value)} /></Field>
      <Field label="Review" required><Textarea maxLength={3000} value={body} onChange={(_, data) => setBody(data.value)} required /></Field>
      <Button appearance="primary" type="submit" disabled={saving || !orderId || !rating || !body.trim()}>{saving ? 'Submitting…' : 'Submit review'}</Button>
    </form>}
    {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
  </section>;
}

export function DeliveryInfo({ order, deliveryFee, navigate }: { order?: CustomerOrder; deliveryFee?: number | null; navigate?: Navigate }) {
  const [settings, setSettings] = useState<PublicTrustSettings | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getPublicTrustSettings().then((value) => { if (active) setSettings(value); }).catch((reason: unknown) => { if (active) setError(errorText(reason)); });
    return () => { active = false; };
  }, []);
  const fee = deliveryFee ?? settings?.deliveryFee ?? null;
  return <section className="delivery-info trust-section" aria-label="Delivery and support information">
    <div className="delivery-info-title"><CheckmarkCircleRegular /><Subtitle1>Delivery & support</Subtitle1></div>
    <div className="delivery-info-grid">
      {fee !== null && <div><Caption1>Delivery fee</Caption1><strong>{formatBusinessMoney(fee)}</strong></div>}
      {settings?.estimatedDeliveryTime && <div><Caption1>Estimated delivery</Caption1><strong>{settings.estimatedDeliveryTime}</strong></div>}
      {order && <div><Caption1>Order status</Caption1><strong>{statusText(order.status)}</strong></div>}
      {order?.courier && <div><Caption1>Courier</Caption1><strong>{order.courier}</strong></div>}
      {order?.tracking_number && <div><Caption1>Tracking number</Caption1><strong>{order.tracking_number}</strong></div>}
      {settings?.supportEmail && <div><Caption1>Customer support</Caption1><a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></div>}
      {settings?.supportPhone && <div><Caption1>Support phone</Caption1><a href={`tel:${settings.supportPhone}`}>{settings.supportPhone}</a></div>}
    </div>
    {error && <Caption1 className="trust-muted">Delivery details could not be loaded.</Caption1>}
    {navigate && <div className="delivery-info-actions"><Button appearance="subtle" onClick={() => navigate('/faq')}>FAQs</Button><Button appearance="subtle" onClick={() => navigate('/support')}>Contact support</Button></div>}
  </section>;
}

export function CustomerReturnRequest({ order, items }: { order: CustomerOrder; items: CustomerOrderItem[] }) {
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listCustomerReturnRequests>>>([]);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState<ReturnReason | ''>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setRequests(await listCustomerReturnRequests(order.id)); }
    catch (failure: unknown) { setError(errorText(failure)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [order.id]);
  const activeItems = new Set(requests.filter((row) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'RETURNED'].includes(row.status)).map((row) => row.order_item_id));
  const eligibleItems = items.filter((item) => !activeItems.has(item.id));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await createReturnRequest({ orderId: order.id, orderItemId: itemId, reason: reason as ReturnReason, description });
      setNotice('Request submitted. An administrator will review it; no refund has been approved.');
      setDescription(''); setReason(''); await load();
    } catch (failure: unknown) { setError(errorText(failure)); }
    finally { setSaving(false); }
  };
  return <section className="trust-section order-action-section">
    <div className="section-head"><div><Caption1 className="section-kicker">RETURNS & REFUNDS</Caption1><Title3>Request a return</Title3></div></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {loading ? <Skeleton><SkeletonItem /><SkeletonItem /></Skeleton> : <>
      {requests.map((request) => <Card className="trust-record" key={request.id}><div className="trust-record-heading"><strong>{statusText(request.status)}</strong><Caption1>{reasons.find(([value]) => value === request.reason)?.[1] ?? request.reason}</Caption1></div><Body1>{request.description || 'No description provided.'}</Body1><Caption1>Submitted {new Date(request.created_at).toLocaleDateString()}</Caption1></Card>)}
      {order.status !== 'DELIVERED' ? <Caption1 className="trust-muted">Return requests are available for delivered orders. Contact support if you need help with this order.</Caption1>
        : eligibleItems.length === 0 ? <Caption1 className="trust-muted">{items.length ? 'Each eligible item already has an open request.' : 'No order items are available for a return request.'}</Caption1>
          : <form className="trust-form" onSubmit={(event) => void submit(event)}>
            <Field label="Order item" required><Select value={itemId} onChange={(_, data) => setItemId(data.value)} required><Option value="" text="Choose an item">Choose an item</Option>{eligibleItems.map((item) => <Option key={item.id} value={item.id} text={item.product_name}>{item.product_name} · Qty {item.quantity}</Option>)}</Select></Field>
            <Field label="Reason" required><Select value={reason} onChange={(_, data) => setReason(data.value as ReturnReason)} required><Option value="" text="Choose a reason">Choose a reason</Option>{reasons.map(([value, label]) => <Option key={value} value={value} text={label}>{label}</Option>)}</Select></Field>
            <Field label="Description"><Textarea maxLength={2000} value={description} onChange={(_, data) => setDescription(data.value)} /></Field>
            <Button appearance="primary" type="submit" disabled={saving || !itemId || !reason}>{saving ? 'Submitting…' : 'Submit for review'}</Button>
          </form>}
    </>}
    {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
  </section>;
}

export function OrderFeedbackForm({ order, items }: { order: CustomerOrder; items: CustomerOrderItem[] }) {
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof customerFeedbackForOrder>>>([]);
  const [rating, setRating] = useState('');
  const [message, setMessage] = useState('');
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setExisting(await customerFeedbackForOrder(order.id)); }
    catch (reason: unknown) { setError(errorText(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [order.id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await submitOrderFeedback({ orderId: order.id, productId: productId || null, rating: Number(rating), message });
      setNotice('Thanks. Your feedback was recorded.'); setMessage(''); setRating(''); setProductId(''); await load();
    } catch (reason: unknown) { setError(errorText(reason)); }
    finally { setSaving(false); }
  };
  return <section className="trust-section order-action-section">
    <div className="section-head"><div><Caption1 className="section-kicker">POST-ORDER</Caption1><Title3>Share feedback</Title3></div></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {loading ? <Skeleton><SkeletonItem /><SkeletonItem /></Skeleton> : existing.length ? <Card className="trust-record"><Badge>{existing[0].rating ? `${existing[0].rating} / 5` : 'Feedback received'}</Badge><Body1>{existing[0].message}</Body1><Caption1>Submitted {new Date(existing[0].created_at).toLocaleDateString()}</Caption1></Card>
      : <form className="trust-form" onSubmit={(event) => void submit(event)}>
        <Field label="Rating" required><Select value={rating} onChange={(_, data) => setRating(data.value)} required><Option value="" text="Choose a rating">Choose a rating</Option>{[5, 4, 3, 2, 1].map((value) => <Option key={value} value={String(value)} text={`${value} / 5`}>{value} / 5</Option>)}</Select></Field>
        {items.length > 1 && <Field label="Product context"><Select value={productId} onChange={(_, data) => setProductId(data.value)}><Option value="" text="Order overall">Order overall</Option>{items.filter((item) => item.product_id).map((item) => <Option key={item.id} value={item.product_id ?? ''} text={item.product_name}>{item.product_name}</Option>)}</Select></Field>}
        <Field label="Feedback" required><Textarea maxLength={2000} value={message} onChange={(_, data) => setMessage(data.value)} required /></Field>
        <Button appearance="secondary" type="submit" disabled={saving || !rating || !message.trim()}>{saving ? 'Submitting…' : 'Send feedback'}</Button>
      </form>}
    {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
  </section>;
}

export function FaqPage({ navigate }: { navigate: Navigate }) {
  const [faqs, setFaqs] = useState<Awaited<ReturnType<typeof import('../api/trust').listPublicFaqs>>>([]);
  const [topic, setTopic] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { const { listPublicFaqs } = await import('../api/trust'); setFaqs(await listPublicFaqs()); } catch (reason: unknown) { setError(errorText(reason)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const visible = faqs.filter((faq) => topic === 'ALL' || faq.topic === topic);
  return <div className="page-content narrow customer-trust-page">
    <div className="section-head"><div><Caption1 className="section-kicker">HELP CENTRE</Caption1><Title1>Frequently asked questions.</Title1></div><Button appearance="subtle" onClick={() => navigate('/support')}>Contact support</Button></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error} <Button appearance="transparent" onClick={() => void load()}>Try again</Button></MessageBarBody></MessageBar>}
    <div className="faq-topic-filter"><Select aria-label="Filter FAQs by topic" value={topic} onChange={(_, data) => setTopic(data.value)}><Option value="ALL" text="All topics">All topics</Option>{faqTopics.map(([value, label]) => <Option key={value} value={value} text={label}>{label}</Option>)}</Select></div>
    {loading ? <Skeleton><SkeletonItem /><SkeletonItem /><SkeletonItem /></Skeleton> : visible.length ? <div className="faq-list">{visible.map((faq) => <details className="faq-entry" key={faq.id}><summary><span>{faq.question}</span><Caption1>{faqTopics.find(([value]) => value === faq.topic)?.[1]}</Caption1></summary><Body1>{faq.answer}</Body1></details>)}</div> : <Card className="empty-state trust-empty"><Title3>No published answers yet</Title3><Body1>FAQ answers will appear here after MotoGear PK publishes them.</Body1></Card>}
  </div>;
}

export function SupportPage({ navigate, conversationId }: { navigate: Navigate; conversationId?: string }) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selected, setSelected] = useState<{ conversation: SupportConversation; messages: SupportMessage[] } | null>(null);
  const [orderOptions, setOrderOptions] = useState<SupportOrderOption[]>([]);
  const [category, setCategory] = useState<SupportCategory>('OTHER');
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [reply, setReply] = useState('');
  const [relatedOrderId, setRelatedOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [threads, orders] = await Promise.all([listCustomerSupportConversations(), listSupportOrderOptions()]);
      setConversations(threads); setOrderOptions(orders);
      if (conversationId) setSelected(await getCustomerSupportConversation(conversationId));
      else setSelected(null);
    } catch (reason: unknown) { setError(errorText(reason)); setSelected(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [conversationId]);
  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const id = await createSupportConversation({ category, subject, orderId: relatedOrderId || null, initialMessage });
      navigate(`/support/${id}`);
    } catch (reason: unknown) { setError(errorText(reason)); }
    finally { setSaving(false); }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!conversationId || !reply.trim()) return;
    setSaving(true); setError(''); setNotice('');
    try { await sendCustomerSupportMessage(conversationId, reply); setReply(''); setNotice('Message sent.'); await load(); }
    catch (reason: unknown) { setError(errorText(reason)); }
    finally { setSaving(false); }
  };
  return <div className="page-content customer-trust-page">
    <div className="section-head"><div><Caption1 className="section-kicker">CUSTOMER SUPPORT</Caption1><Title1>Support conversations.</Title1></div><Button appearance="subtle" onClick={() => navigate('/faq')}>Browse FAQs</Button></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error} <Button appearance="transparent" onClick={() => void load()}>Try again</Button></MessageBarBody></MessageBar>}
    <div className="support-layout">
      <aside className="support-list" aria-label="Your conversations">
        <Subtitle1>Your conversations</Subtitle1>
        {loading ? <Skeleton><SkeletonItem /><SkeletonItem /></Skeleton> : conversations.length ? conversations.map((conversation) => <button type="button" className={`support-thread-link${conversation.id === conversationId ? ' selected' : ''}`} key={conversation.id} onClick={() => navigate(`/support/${conversation.id}`)}><strong>{conversation.subject}</strong><Caption1>{statusText(conversation.status)} · {new Date(conversation.updated_at).toLocaleDateString()}</Caption1></button>) : <Caption1 className="trust-muted">No conversations yet.</Caption1>}
        <Button appearance="secondary" icon={<ArrowRightRegular />} onClick={() => navigate('/support')}>New conversation</Button>
      </aside>
      <section className="support-workspace">
        {!conversationId ? <form className="trust-form" onSubmit={(event) => void create(event)}><Subtitle1>Start a conversation</Subtitle1>
          <Field label="Category" required><Select value={category} onChange={(_, data) => setCategory(data.value as SupportCategory)}>{supportCategories.map(([value, label]) => <Option key={value} value={value} text={label}>{label}</Option>)}</Select></Field>
          <Field label="Related order (optional)"><Select value={relatedOrderId} onChange={(_, data) => setRelatedOrderId(data.value)}><Option value="" text="No order selected">No order selected</Option>{orderOptions.map((order) => <Option key={order.id} value={order.id} text={order.order_number}>{order.order_number} · {statusText(order.status)}</Option>)}</Select></Field>
          <Field label="Subject" required><Input maxLength={160} value={subject} onChange={(_, data) => setSubject(data.value)} required /></Field>
          <Field label="Message" required><Textarea maxLength={4000} value={initialMessage} onChange={(_, data) => setInitialMessage(data.value)} required /></Field>
          <Button appearance="primary" type="submit" disabled={saving || !subject.trim() || !initialMessage.trim()}>{saving ? 'Creating…' : 'Create conversation'}</Button>
        </form> : loading ? <Skeleton><SkeletonItem /><SkeletonItem /><SkeletonItem /></Skeleton> : selected ? <>
          <div className="support-conversation-head"><div><Caption1>{supportCategories.find(([value]) => value === selected.conversation.category)?.[1]}</Caption1><Title3>{selected.conversation.subject}</Title3></div><Badge>{statusText(selected.conversation.status)}</Badge></div>
          <div className="support-message-list">{selected.messages.map((message) => <Card className={`support-message${message.sender_role === 'CUSTOMER' ? ' own' : ''}`} key={message.id}><div className="trust-record-heading"><strong>{message.sender_role === 'ADMIN' ? 'MotoGear PK support' : 'You'}</strong><Caption1>{new Date(message.created_at).toLocaleString()}</Caption1></div><Body1>{message.body}</Body1></Card>)}{selected.messages.length === 0 && <Caption1 className="trust-muted">No messages in this conversation yet.</Caption1>}</div>
          {['CLOSED', 'RESOLVED'].includes(selected.conversation.status) ? <Caption1 className="trust-muted">This conversation is {statusText(selected.conversation.status).toLowerCase()}.</Caption1> : <form className="trust-form" onSubmit={(event) => void send(event)}><Field label="Reply" required><Textarea maxLength={4000} value={reply} onChange={(_, data) => setReply(data.value)} required /></Field><Button appearance="primary" type="submit" disabled={saving || !reply.trim()}>{saving ? 'Sending…' : 'Send message'}</Button></form>}
        </> : <Card className="empty-state trust-empty"><Title3>Conversation unavailable</Title3><Body1>This conversation may not exist or may not belong to your account.</Body1></Card>}
        {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      </section>
    </div>
  </div>;
}