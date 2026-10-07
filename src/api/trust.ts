import { supabase, type Database, type FaqTopic, type ReturnReason, type ReturnRequestStatus, type SupportCategory, type SupportConversationStatus } from '../lib/supabase';

type Tables = Database['public']['Tables'];
export type ProductReview = Database['public']['Views']['public_product_reviews']['Row'];
export type ReturnRequest = Tables['return_requests']['Row'];
export type FaqEntry = Tables['faq_entries']['Row'];
export type SupportConversation = Tables['support_conversations']['Row'];
export type SupportMessage = Tables['support_messages']['Row'];
export type SupportInternalNote = Tables['support_internal_notes']['Row'];
export type CustomerFeedback = Tables['customer_feedback']['Row'];
export type ReviewableOrder = Pick<Tables['orders']['Row'], 'id' | 'order_number' | 'created_at'>;
export type SupportOrderOption = Pick<Tables['orders']['Row'], 'id' | 'order_number' | 'status' | 'created_at'>;

export type AdminReturnRequest = ReturnRequest & { order_number: string | null; product_name: string | null; customer_name: string | null };
export type AdminSupportConversation = SupportConversation & { customer_name: string | null; order_number: string | null };

export interface PublicReviewSummary {
  reviews: ProductReview[];
  averageRating: number | null;
  reviewCount: number;
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface PublicTrustSettings {
  deliveryFee: number | null;
  estimatedDeliveryTime: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  returnPolicySummary: string | null;
}

export interface FaqInput {
  topic: FaqTopic;
  question: string;
  answer: string;
  active: boolean;
  sort_order: number;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to continue.');
  return data.user.id;
}

export async function getPublicProductReviews(productId: string): Promise<PublicReviewSummary> {
  // TEMP: Dummy reviews for layout preview
  const dummyReviews: ProductReview[] = [
    { id: '1', product_id: productId, rating: 5, title: 'Excellent quality helmet', body: 'Bought this helmet last month and it feels very solid and comfortable. Great value for money in Pakistan.', verified_purchase: true, created_at: '2026-09-28T10:00:00Z' },
    { id: '2', product_id: productId, rating: 4, title: 'Good fit but tight', body: 'Quality is good but the size runs a bit small. I recommend ordering one size up. Overall satisfied with the purchase.', verified_purchase: true, created_at: '2026-09-25T14:30:00Z' },
    { id: '3', product_id: productId, rating: 5, title: 'Worth every rupee', body: 'Very impressed with the material and stitching. Delivery was fast and packaging was secure. Will buy again.', verified_purchase: true, created_at: '2026-09-20T09:15:00Z' },
    { id: '4', product_id: productId, rating: 3, title: 'Average product', body: 'Product is okay for the price but not premium quality. Works fine for daily commuting but I expected better finishing.', verified_purchase: false, created_at: '2026-09-15T16:45:00Z' },
    { id: '5', product_id: productId, rating: 4, title: 'Decent for city rides', body: 'Comfortable for short rides in the city. The visor is clear and the ventilation is decent. Good for the price point.', verified_purchase: true, created_at: '2026-09-10T11:20:00Z' },
  ];
  const ratingCounts: PublicReviewSummary['ratingCounts'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of dummyReviews) {
    ratingCounts[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
  }
  return {
    reviews: dummyReviews,
    averageRating: dummyReviews.reduce((sum, r) => sum + r.rating, 0) / dummyReviews.length,
    reviewCount: dummyReviews.length,
    ratingCounts,
  };
}

export async function listReviewableOrders(productId: string): Promise<ReviewableOrder[]> {
  const customerId = await currentUserId();
  const db = client();
  const { data: orders, error: orderError } = await db.from('orders')
    .select('id,order_number,created_at')
    .eq('customer_id', customerId)
    .eq('status', 'DELIVERED')
    .order('created_at', { ascending: false });
  if (orderError) throw orderError;
  if (!orders.length) return [];
  const orderIds = orders.map((order) => order.id);
  const { data: items, error: itemError } = await db.from('order_items')
    .select('order_id')
    .eq('product_id', productId)
    .in('order_id', orderIds);
  if (itemError) throw itemError;
  const eligibleIds = new Set(items.map((item) => item.order_id));
  return orders.filter((order) => eligibleIds.has(order.id));
}

export async function customerReviewForProduct(productId: string): Promise<Tables['reviews']['Row'] | null> {
  const customerId = await currentUserId();
  const { data, error } = await client().from('reviews').select('*')
    .eq('product_id', productId)
    .eq('customer_id', customerId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitProductReview(input: { productId: string; orderId: string; rating: number; title: string; body: string }): Promise<void> {
  const customerId = await currentUserId();
  const { error } = await client().from('reviews').insert({
    product_id: input.productId,
    customer_id: customerId,
    order_id: input.orderId,
    rating: input.rating,
    title: input.title.trim(),
    body: input.body.trim(),
  });
  if (error) throw error;
}

export async function listCustomerReturnRequests(orderId: string): Promise<ReturnRequest[]> {
  const { data, error } = await client().from('return_requests').select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createReturnRequest(input: { orderId: string; orderItemId: string; reason: ReturnReason; description: string }): Promise<ReturnRequest> {
  const customerId = await currentUserId();
  const { data, error } = await client().from('return_requests').insert({
    order_id: input.orderId,
    order_item_id: input.orderItemId,
    customer_id: customerId,
    reason: input.reason,
    description: input.description.trim(),
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function submitOrderFeedback(input: { orderId: string; productId: string | null; rating: number; message: string }): Promise<void> {
  const customerId = await currentUserId();
  const { error } = await client().from('customer_feedback').insert({
    customer_id: customerId,
    order_id: input.orderId,
    product_id: input.productId,
    category: 'POST_ORDER',
    rating: input.rating,
    message: input.message.trim(),
  });
  if (error) throw error;
}

export async function customerFeedbackForOrder(orderId: string): Promise<CustomerFeedback[]> {
  const { data, error } = await client().from('customer_feedback').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listSupportOrderOptions(): Promise<SupportOrderOption[]> {
  const customerId = await currentUserId();
  const { data, error } = await client().from('orders').select('id,order_number,status,created_at')
    .eq('customer_id', customerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPublicFaqs(): Promise<FaqEntry[]> {
  const { data, error } = await client().from('faq_entries').select('*').eq('active', true)
    .order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

export async function listAdminFaqs(): Promise<FaqEntry[]> {
  const { data, error } = await client().from('faq_entries').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data;
}

export async function saveFaq(input: FaqInput, id?: string): Promise<FaqEntry> {
  const db = client();
  const result = id
    ? await db.from('faq_entries').update(input).eq('id', id).select('*').single()
    : await db.from('faq_entries').insert(input).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

export async function getPublicTrustSettings(): Promise<PublicTrustSettings> {
  const keys = ['delivery_fee', 'estimated_delivery_time', 'support_email', 'support_phone', 'return_policy_summary'];
  const { data, error } = await client().from('business_settings')
    .select('setting_key,setting_value')
    .eq('is_public', true)
    .in('setting_key', keys);
  if (error) throw error;
  const values = new Map(data.map((row) => [row.setting_key, row.setting_value]));
  const text = (key: string) => {
    const value = values.get(key);
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() || null : null;
  };
  const fee = text('delivery_fee');
  return {
    deliveryFee: fee !== null && Number.isFinite(Number(fee)) ? Number(fee) : null,
    estimatedDeliveryTime: text('estimated_delivery_time'),
    supportEmail: text('support_email'),
    supportPhone: text('support_phone'),
    returnPolicySummary: text('return_policy_summary'),
  };
}

export async function listCustomerSupportConversations(): Promise<SupportConversation[]> {
  const { data, error } = await client().from('support_conversations').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCustomerSupportConversation(id: string): Promise<{ conversation: SupportConversation; messages: SupportMessage[] }> {
  const db = client();
  const [conversationResult, messagesResult] = await Promise.all([
    db.from('support_conversations').select('*').eq('id', id).maybeSingle(),
    db.from('support_messages').select('*').eq('conversation_id', id).order('created_at'),
  ]);
  if (conversationResult.error) throw conversationResult.error;
  if (messagesResult.error) throw messagesResult.error;
  if (!conversationResult.data) throw new Error('Support conversation not found.');
  return { conversation: conversationResult.data, messages: messagesResult.data };
}

export async function createSupportConversation(input: { category: SupportCategory; subject: string; orderId: string | null; initialMessage: string }): Promise<string> {
  const customerId = await currentUserId();
  const db = client();
  const { data: conversation, error: conversationError } = await db.from('support_conversations').insert({
    customer_id: customerId,
    related_order_id: input.orderId,
    category: input.category,
    subject: input.subject.trim(),
  }).select('id').single();
  if (conversationError) throw conversationError;
  await sendCustomerSupportMessage(conversation.id, input.initialMessage);
  return conversation.id;
}

export async function sendCustomerSupportMessage(conversationId: string, body: string): Promise<void> {
  const { error } = await client().from('support_messages').insert({
    conversation_id: conversationId,
    body: body.trim(),
    is_internal: false,
  });
  if (error) throw error;
}

export async function listAdminReturnRequests(): Promise<AdminReturnRequest[]> {
  const db = client();
  const { data: requests, error } = await db.from('return_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  if (!requests.length) return [];
  const orderIds = [...new Set(requests.map((row) => row.order_id))];
  const itemIds = [...new Set(requests.map((row) => row.order_item_id))];
  const customerIds = [...new Set(requests.map((row) => row.customer_id))];
  const [orders, items, profiles] = await Promise.all([
    db.from('orders').select('id,order_number').in('id', orderIds),
    db.from('order_items').select('id,product_name').in('id', itemIds),
    db.from('profiles').select('id,full_name').in('id', customerIds),
  ]);
  if (orders.error) throw orders.error;
  if (items.error) throw items.error;
  if (profiles.error) throw profiles.error;
  const orderNames = new Map(orders.data.map((row) => [row.id, row.order_number]));
  const itemNames = new Map(items.data.map((row) => [row.id, row.product_name]));
  const customerNames = new Map(profiles.data.map((row) => [row.id, row.full_name]));
  return requests.map((row) => ({
    ...row,
    order_number: orderNames.get(row.order_id) ?? null,
    product_name: itemNames.get(row.order_item_id) ?? null,
    customer_name: customerNames.get(row.customer_id) ?? null,
  }));
}

export async function updateReturnRequest(id: string, status: ReturnRequestStatus, internalNotes: string): Promise<void> {
  const adminId = await currentUserId();
  const { error } = await client().from('return_requests').update({
    status,
    internal_notes: internalNotes.trim() || null,
    decided_by: adminId,
    decided_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function listAdminSupportConversations(): Promise<AdminSupportConversation[]> {
  const db = client();
  const { data, error } = await db.from('support_conversations').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const customerIds = [...new Set(data.map((row) => row.customer_id))];
  const orderIds = [...new Set(data.flatMap((row) => row.related_order_id ? [row.related_order_id] : []))];
  const [profiles, orders] = await Promise.all([
    db.from('profiles').select('id,full_name').in('id', customerIds),
    orderIds.length ? db.from('orders').select('id,order_number').in('id', orderIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error) throw profiles.error;
  if (orders.error) throw orders.error;
  const names = new Map(profiles.data.map((row) => [row.id, row.full_name]));
  const numbers = new Map(orders.data.map((row) => [row.id, row.order_number]));
  return data.map((row) => ({ ...row, customer_name: names.get(row.customer_id) ?? null, order_number: row.related_order_id ? numbers.get(row.related_order_id) ?? null : null }));
}

export async function getAdminSupportConversation(id: string): Promise<{ messages: SupportMessage[]; notes: SupportInternalNote[] }> {
  const db = client();
  const [messages, notes] = await Promise.all([
    db.from('support_messages').select('*').eq('conversation_id', id).order('created_at'),
    db.from('support_internal_notes').select('*').eq('conversation_id', id).order('created_at'),
  ]);
  if (messages.error) throw messages.error;
  if (notes.error) throw notes.error;
  return { messages: messages.data, notes: notes.data };
}

export async function replyAsAdmin(conversationId: string, body: string): Promise<void> {
  const { error } = await client().from('support_messages').insert({ conversation_id: conversationId, body: body.trim(), is_internal: false });
  if (error) throw error;
}

export async function addSupportInternalNote(conversationId: string, body: string): Promise<void> {
  const { error } = await client().from('support_internal_notes').insert({ conversation_id: conversationId, body: body.trim() });
  if (error) throw error;
}

export async function updateSupportConversationStatus(id: string, status: SupportConversationStatus): Promise<void> {
  const { error } = await client().from('support_conversations').update({ status }).eq('id', id);
  if (error) throw error;
}