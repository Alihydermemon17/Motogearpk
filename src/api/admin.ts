import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import type { AdminOrderStatus } from './types';

type Tables = Database['public']['Tables'];
type JsonValue = string | number | boolean | null | { [key: string]: JsonValue | undefined } | JsonValue[];
type CategoryRow = Tables['categories']['Row'];
type BikeRow = Tables['bike_models']['Row'];
type SupplierRow = Tables['suppliers']['Row'];
type SupplierProductRow = Tables['supplier_products']['Row'];
type SupplierAvailabilityRow = Tables['supplier_availability']['Row'];
type ProductRow = Tables['products']['Row'];
type OrderRow = Tables['orders']['Row'];
type OrderItemRow = Tables['order_items']['Row'];
type ProfileRow = Tables['profiles']['Row'];
type ReviewRow = Tables['reviews']['Row'];
type FeedbackRow = Tables['customer_feedback']['Row'];
type ApprovalRow = Tables['approval_requests']['Row'];
type AutomationLogRow = Tables['automation_logs']['Row'];
type SettingRow = Tables['business_settings']['Row'];

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

const dashboardMetricsSchema = z.object({
  total_orders: z.number(),
  pending_orders: z.number(),
  confirmed_orders: z.number(),
  delivered_orders: z.number(),
  cancelled_orders: z.number(),
  revenue: z.number(),
  estimated_profit: z.number(),
  published_products: z.number(),
  unavailable_products: z.number(),
  total_customers: z.number(),
  total_reviews: z.number(),
  pending_approvals: z.number(),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;
export type AdminOrderItem = OrderItemRow & { product_name_lookup: string | null; supplier_name: string | null; supplier_cost: number | null };
export type AdminOrderBundle = OrderRow & { customer: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'phone' | 'city' | 'province'> | null; items: AdminOrderItem[] };
export type AdminCustomer = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'phone' | 'city' | 'province' | 'created_at'> & { order_count: number; order_value: number };
export type AdminReview = ReviewRow & { product_name: string | null; customer_name: string | null; order_number: string | null; order_status: OrderRow['status'] | null };
export type AdminFeedback = FeedbackRow & { customer_name: string | null };
export type AdminSupplierProduct = SupplierProductRow & { product_name: string | null; supplier_name: string | null; availability: SupplierAvailabilityRow | null };

export interface DashboardCategoryInput {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  seo_title: string;
  seo_description: string;
}

export interface DashboardBikeInput {
  name: string;
  slug: string;
  brand: string;
  engine_capacity: string;
  active: boolean;
}

export interface DashboardSupplierInput {
  name: string;
  website: string;
  url: string;
  country: string;
  contact_information: Record<string, JsonValue>;
  rating: number | null;
  reliability_notes: string;
  shipping_information: string;
  api_status: string;
  active: boolean;
}

export interface DashboardSupplierProductInput {
  supplier_id: string;
  product_id: string;
  supplier_product_url: string;
  supplier_sku: string;
  supplier_cost: number | null;
  moq: number | null;
  supplier_rating: number | null;
  product_quality_notes: string;
}

export type BusinessSettingKey = 'business_name' | 'currency' | 'delivery_fee' | 'support_phone' | 'support_email' | 'whatsapp_number' | 'return_policy_summary' | 'default_warranty_text';
export type BusinessSettings = Record<BusinessSettingKey, string>;

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await client().rpc('admin_dashboard_metrics');
  if (error) throw error;
  return dashboardMetricsSchema.parse(data);
}

export async function listAdminCategories(): Promise<CategoryRow[]> {
  const { data, error } = await client().from('categories').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function saveAdminCategory(input: DashboardCategoryInput, id?: string): Promise<CategoryRow> {
  const db = client();
  const result = id
    ? await db.from('categories').update(input).eq('id', id).select('*').single()
    : await db.from('categories').insert(input).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listAdminBikes(): Promise<BikeRow[]> {
  const { data, error } = await client().from('bike_models').select('*').order('brand').order('name');
  if (error) throw error;
  return data;
}

export async function saveAdminBike(input: DashboardBikeInput, id?: string): Promise<BikeRow> {
  const db = client();
  const result = id
    ? await db.from('bike_models').update(input).eq('id', id).select('*').single()
    : await db.from('bike_models').insert(input).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listAdminSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await client().from('suppliers').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function saveAdminSupplier(input: DashboardSupplierInput, id?: string): Promise<SupplierRow> {
  const db = client();
  const result = id
    ? await db.from('suppliers').update(input).eq('id', id).select('*').single()
    : await db.from('suppliers').insert(input).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listSupplierProducts(): Promise<AdminSupplierProduct[]> {
  const db = client();
  const { data: supplierProducts, error } = await db.from('supplier_products').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  if (!supplierProducts.length) return [];
  const productIds = [...new Set(supplierProducts.map((row) => row.product_id))];
  const supplierIds = [...new Set(supplierProducts.map((row) => row.supplier_id))];
  const supplierProductIds = supplierProducts.map((row) => row.id);
  const [productsResult, suppliersResult, availabilityResult] = await Promise.all([
    db.from('products').select('id,name').in('id', productIds),
    db.from('suppliers').select('id,name').in('id', supplierIds),
    db.from('supplier_availability').select('*').in('supplier_product_id', supplierProductIds).order('checked_at', { ascending: false }),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (suppliersResult.error) throw suppliersResult.error;
  if (availabilityResult.error) throw availabilityResult.error;
  const products = new Map(productsResult.data.map((row) => [row.id, row.name]));
  const suppliers = new Map(suppliersResult.data.map((row) => [row.id, row.name]));
  const latestAvailability = new Map<string, SupplierAvailabilityRow>();
  for (const row of availabilityResult.data) if (!latestAvailability.has(row.supplier_product_id)) latestAvailability.set(row.supplier_product_id, row);
  return supplierProducts.map((row) => ({ ...row, product_name: products.get(row.product_id) ?? null, supplier_name: suppliers.get(row.supplier_id) ?? null, availability: latestAvailability.get(row.id) ?? null }));
}

export async function saveSupplierProduct(input: DashboardSupplierProductInput, id?: string): Promise<SupplierProductRow> {
  const db = client();
  const result = id
    ? await db.from('supplier_products').update(input).eq('id', id).select('*').single()
    : await db.from('supplier_products').insert(input).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}

export async function setSupplierAvailability(supplierProductId: string, availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'CHECK_REQUIRED', estimatedQuantity: number | null): Promise<void> {
  const { error } = await client().from('supplier_availability').insert({ supplier_product_id: supplierProductId, availability_status: availabilityStatus, estimated_quantity: estimatedQuantity });
  if (error) throw error;
}

export async function listAdminOrders(): Promise<AdminOrderBundle[]> {
  const db = client();
  const { data: orders, error } = await db.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  if (!orders.length) return [];
  const orderIds = orders.map((order) => order.id);
  const profileIds = [...new Set(orders.map((order) => order.customer_id))];
  const [itemsResult, profilesResult] = await Promise.all([
    db.from('order_items').select('*').in('order_id', orderIds).order('created_at'),
    db.from('profiles').select('id,full_name,email,phone,city,province').in('id', profileIds),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const productIds = [...new Set(itemsResult.data.flatMap((item) => item.product_id ? [item.product_id] : []))];
  const productsResult = productIds.length ? await db.from('products').select('id,name,supplier_id,supplier_cost').in('id', productIds) : { data: [], error: null };
  if (productsResult.error) throw productsResult.error;
  const supplierIds = [...new Set(productsResult.data.flatMap((product) => product.supplier_id ? [product.supplier_id] : []))];
  const suppliersResult = supplierIds.length ? await db.from('suppliers').select('id,name').in('id', supplierIds) : { data: [], error: null };
  if (suppliersResult.error) throw suppliersResult.error;
  const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  const products = new Map(productsResult.data.map((product) => [product.id, product]));
  const suppliers = new Map(suppliersResult.data.map((supplier) => [supplier.id, supplier.name]));
  const itemsByOrder = new Map<string, AdminOrderItem[]>();
  for (const item of itemsResult.data) {
    const product = item.product_id ? products.get(item.product_id) : undefined;
    (itemsByOrder.get(item.order_id) ?? (itemsByOrder.set(item.order_id, []), itemsByOrder.get(item.order_id)!)).push({
      ...item,
      product_name_lookup: product?.name ?? null,
      supplier_name: product?.supplier_id ? suppliers.get(product.supplier_id) ?? null : null,
      supplier_cost: product?.supplier_cost ?? null,
    });
  }
  return orders.map((order) => ({
    ...order,
    customer: profiles.get(order.customer_id) ?? null,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

export async function updateAdminOrder(orderId: string, status: AdminOrderStatus, trackingNumber: string, courier: string, internalNotes: string): Promise<OrderRow> {
  const { data, error } = await client().rpc('admin_update_order', {
    p_order_id: orderId,
    p_status: status,
    p_tracking_number: trackingNumber || null,
    p_courier: courier || null,
    p_internal_notes: internalNotes || null,
  });
  if (error) throw error;
  return data;
}

export async function listAdminCustomers(): Promise<AdminCustomer[]> {
  const db = client();
  const [profilesResult, ordersResult] = await Promise.all([
    db.from('profiles').select('id,full_name,email,phone,city,province,created_at').order('created_at', { ascending: false }),
    db.from('orders').select('customer_id,total'),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (ordersResult.error) throw ordersResult.error;
  const orderStats = new Map<string, { count: number; value: number }>();
  for (const order of ordersResult.data) {
    const current = orderStats.get(order.customer_id) ?? { count: 0, value: 0 };
    current.count += 1;
    current.value += order.total;
    orderStats.set(order.customer_id, current);
  }
  return profilesResult.data.map((profile) => ({
    ...profile,
    order_count: orderStats.get(profile.id)?.count ?? 0,
    order_value: orderStats.get(profile.id)?.value ?? 0,
  }));
}

export async function listAdminReviews(): Promise<AdminReview[]> {
  const db = client();
  const { data, error } = await db.from('reviews').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const productIds = [...new Set(data.map((review) => review.product_id))];
  const customerIds = [...new Set(data.flatMap((review) => review.customer_id ? [review.customer_id] : []))];
  const orderIds = [...new Set(data.flatMap((review) => review.order_id ? [review.order_id] : []))];
  const [products, profiles, orders] = await Promise.all([
    db.from('products').select('id,name').in('id', productIds),
    customerIds.length ? db.from('profiles').select('id,full_name').in('id', customerIds) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? db.from('orders').select('id,order_number,status').in('id', orderIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (products.error) throw products.error;
  if (profiles.error) throw profiles.error;
  if (orders.error) throw orders.error;
  const productNames = new Map(products.data.map((row) => [row.id, row.name]));
  const profileNames = new Map(profiles.data.map((row) => [row.id, row.full_name]));
  const orderContext = new Map(orders.data.map((row) => [row.id, { number: row.order_number, status: row.status }]));
  return data.map((review) => {
    const order = review.order_id ? orderContext.get(review.order_id) : undefined;
    return {
      ...review,
      product_name: productNames.get(review.product_id) ?? null,
      customer_name: review.customer_id ? profileNames.get(review.customer_id) ?? null : null,
      order_number: order?.number ?? null,
      order_status: order?.status ?? null,
    };
  });
}

export async function setReviewVisibility(reviewId: string, visible: boolean): Promise<void> {
  const { error } = await client().from('reviews').update({ is_visible: visible }).eq('id', reviewId);
  if (error) throw error;
}

export async function listAdminFeedback(): Promise<AdminFeedback[]> {
  const db = client();
  const { data, error } = await db.from('customer_feedback').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const customerIds = [...new Set(data.map((entry) => entry.customer_id))];
  const { data: profiles, error: profileError } = await db.from('profiles').select('id,full_name').in('id', customerIds);
  if (profileError) throw profileError;
  const names = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
  return data.map((entry) => ({ ...entry, customer_name: names.get(entry.customer_id) ?? null }));
}

export async function updateFeedback(feedbackId: string, status: FeedbackRow['status'], internalNotes: string): Promise<void> {
  const { error } = await client().from('customer_feedback').update({ status, internal_notes: internalNotes || null }).eq('id', feedbackId);
  if (error) throw error;
}

export async function listApprovalRequests(): Promise<ApprovalRow[]> {
  const { data, error } = await client().from('approval_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createApprovalRequest(input: Pick<ApprovalRow, 'request_type' | 'subject' | 'details' | 'metadata'>): Promise<ApprovalRow> {
  const db = client();
  const { data: userResult, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  const { data, error } = await db.from('approval_requests').insert({ ...input, requested_by: userResult.user.id }).select('*').single();
  if (error) throw error;
  return data;
}

export async function decideApprovalRequest(id: string, status: 'APPROVED' | 'REJECTED', notes: string): Promise<void> {
  const db = client();
  const { data: userResult, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  const { error } = await db.from('approval_requests').update({ status, decision_notes: notes || null, decided_by: userResult.user.id, decided_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function listAutomationLogs(): Promise<AutomationLogRow[]> {
  const { data, error } = await client().from('automation_logs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBusinessSettings(): Promise<Partial<BusinessSettings>> {
  const { data, error } = await client().from('business_settings').select('*');
  if (error) throw error;
  const settings: Partial<BusinessSettings> = {};
  for (const row of data) {
    const key = row.setting_key as BusinessSettingKey;
    if (key in businessSettingKeys) settings[key] = typeof row.setting_value === 'string' || typeof row.setting_value === 'number' ? String(row.setting_value) : '';
  }
  return settings;
}

const businessSettingKeys: Record<BusinessSettingKey, true> = {
  business_name: true,
  currency: true,
  delivery_fee: true,
  support_phone: true,
  support_email: true,
  whatsapp_number: true,
  return_policy_summary: true,
  default_warranty_text: true,
};

export async function saveBusinessSettings(settings: BusinessSettings): Promise<void> {
  const db = client();
  const { data: userResult, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  const rows = Object.entries(settings).map(([setting_key, setting_value]) => ({
    setting_key,
    setting_value: setting_key === 'delivery_fee' && setting_value.trim() ? Number(setting_value) : setting_value,
    is_public: ['business_name', 'currency', 'delivery_fee', 'support_phone', 'support_email', 'whatsapp_number'].includes(setting_key),
    updated_by: userResult.user.id,
  }));
  const { error } = await db.from('business_settings').upsert(rows, { onConflict: 'setting_key' });
  if (error) throw error;
}

export async function getPublicBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await client().from('business_settings').select('setting_key,setting_value').in('setting_key', [
    'business_name', 'currency', 'delivery_fee', 'support_phone', 'support_email', 'whatsapp_number', 'return_policy_summary', 'default_warranty_text'
  ]);
  if (error) throw error;
  const values: Partial<BusinessSettings> = {};
  for (const row of data) {
    const key = row.setting_key as BusinessSettingKey;
    if (key in businessSettingKeys) values[key] = typeof row.setting_value === 'string' || typeof row.setting_value === 'number' ? String(row.setting_value) : '';
  }
  return {
    business_name: values.business_name ?? 'MotoGear PK',
    currency: values.currency ?? 'PKR',
    delivery_fee: values.delivery_fee ?? '250',
    support_phone: values.support_phone ?? '',
    support_email: values.support_email ?? '',
    whatsapp_number: values.whatsapp_number ?? '',
    return_policy_summary: values.return_policy_summary ?? '',
    default_warranty_text: values.default_warranty_text ?? '',
  };
}