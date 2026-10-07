import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

export type CustomerProfile = Database['public']['Tables']['profiles']['Row'];
export type CustomerOrder = Database['public']['Tables']['orders']['Row'];
export type CustomerOrderItem = Database['public']['Tables']['order_items']['Row'];
export type OrderStatusEvent = Database['public']['Tables']['order_status_history']['Row'];

export type CartRequestItem = {
  product_id: string;
  quantity: number;
  [key: string]: string | number;
};

export type ShippingDetails = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  [key: string]: string;
};

const quoteSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    product_sku: z.string(),
    quantity: z.number().int().positive(),
    base_unit_price: z.number().nonnegative(),
    unit_price: z.number().nonnegative(),
    discount_amount: z.number().nonnegative(),
    line_total: z.number().nonnegative(),
  })),
  subtotal: z.number().nonnegative(),
  delivery_fee: z.number().nonnegative(),
  discount_amount: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const createdOrderSchema = quoteSchema.extend({
  id: z.string().uuid(),
  order_number: z.string().min(1),
  payment_method: z.literal('CASH_ON_DELIVERY'),
  payment_status: z.literal('PENDING'),
  status: z.literal('PENDING'),
  created_at: z.string(),
});

export type CustomerOrderQuote = z.infer<typeof quoteSchema>;
export type CreatedCustomerOrder = z.infer<typeof createdOrderSchema>;

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable customer and order features.');
  return supabase;
}

export async function getCustomerProfile(userId: string): Promise<CustomerProfile> {
  const { data, error } = await client().from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateCustomerProfile(userId: string, details: Pick<CustomerProfile, 'full_name' | 'phone' | 'address' | 'city' | 'province'>): Promise<CustomerProfile> {
  const { data, error } = await client().from('profiles')
    .update(details)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerEmail(email: string): Promise<void> {
  const { error } = await client().auth.updateUser({ email });
  if (error) throw error;
}

export async function quoteCustomerOrder(items: CartRequestItem[]): Promise<CustomerOrderQuote> {
  const { data, error } = await client().rpc('quote_customer_order', { p_items: items });
  if (error) throw error;
  return quoteSchema.parse(data);
}

export async function createCustomerOrder(items: CartRequestItem[], shipping: ShippingDetails, customerNotes: string): Promise<CreatedCustomerOrder> {
  const { data, error } = await client().rpc('create_customer_order', {
    p_items: items,
    p_shipping: shipping,
    p_customer_notes: customerNotes.trim() || null,
  });
  if (error) throw error;
  return createdOrderSchema.parse(data);
}

export async function getCustomerOrders(): Promise<CustomerOrder[]> {
  const { data, error } = await client().from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export interface CustomerOrderDetails {
  order: CustomerOrder;
  items: CustomerOrderItem[];
  timeline: OrderStatusEvent[];
}

export async function getCustomerOrderDetails(orderId: string): Promise<CustomerOrderDetails> {
  const db = client();
  const { data: order, error: orderError } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error('Order not found.');
  const [itemsResult, timelineResult] = await Promise.all([
    db.from('order_items').select('*').eq('order_id', orderId).order('created_at'),
    db.from('order_status_history').select('*').eq('order_id', orderId).order('changed_at'),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (timelineResult.error) throw timelineResult.error;
  return { order, items: itemsResult.data, timeline: timelineResult.data };
}