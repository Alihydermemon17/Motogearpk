import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'CHECK_REQUIRED';
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SUPPLIER_PROCESSING' | 'SUPPLIER_SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
type PaymentMethod = 'CASH_ON_DELIVERY';
export type ReturnReason = 'DAMAGED' | 'NOT_WORKING' | 'WRONG_PRODUCT' | 'COMPATIBILITY' | 'DIFFERENT_FROM_LISTING' | 'MISSING_ITEM' | 'OTHER';
export type ReturnRequestStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'REFUNDED' | 'REPLACEMENT_SENT' | 'CLOSED';
export type SupportConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type SupportCategory = 'PRODUCT_QUESTION' | 'COMPATIBILITY' | 'ORDER_STATUS' | 'DELIVERY' | 'WARRANTY' | 'RETURN' | 'REFUND' | 'COMPLAINT' | 'OTHER';
export type FaqTopic = 'PRODUCTS' | 'ORDERS' | 'DELIVERY' | 'RETURNS' | 'WARRANTY' | 'COMPATIBILITY' | 'INSTALLATION' | 'PAYMENT' | 'SUPPLIER_FULFILLMENT' | 'SUPPORT';
type Relationship<ForeignKey extends string, Column extends string, Relation extends string, ReferencedColumn extends string> = {
  foreignKeyName: ForeignKey;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Relation;
  referencedColumns: [ReferencedColumn];
};
type Table<Row, Insert, Relationships extends object[] = [], Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        { id: string; full_name: string; phone: string; email: string; address: string | null; city: string | null; province: string | null; created_at: string; updated_at: string },
        { id: string; full_name?: string; phone?: string; email?: string; address?: string | null; city?: string | null; province?: string | null; created_at?: string; updated_at?: string }
      >;
      orders: Table<
        { id: string; order_number: string; customer_id: string; subtotal: number; delivery_fee: number; discount_amount: number; total: number; payment_method: PaymentMethod; payment_status: PaymentStatus; payment_reference: string | null; payment_confirmed_at: string | null; payment_confirmed_by: string | null; status: OrderStatus; shipping_full_name: string; shipping_phone: string; shipping_email: string; shipping_address: string; shipping_city: string; shipping_province: string; customer_notes: string | null; internal_notes: string | null; tracking_number: string | null; courier: string | null; created_at: string; updated_at: string },
        { id?: string; order_number: string; customer_id: string; subtotal: number; delivery_fee: number; discount_amount?: number; total: number; payment_method?: PaymentMethod; payment_status?: PaymentStatus; payment_reference?: string | null; payment_confirmed_at?: string | null; payment_confirmed_by?: string | null; status?: OrderStatus; shipping_full_name: string; shipping_phone: string; shipping_email: string; shipping_address: string; shipping_city: string; shipping_province: string; customer_notes?: string | null; internal_notes?: string | null; tracking_number?: string | null; courier?: string | null; created_at?: string; updated_at?: string }
      >;
      order_items: Table<
        { id: string; order_id: string; product_id: string | null; product_name: string; product_sku: string; quantity: number; base_unit_price: number; unit_price: number; discount_amount: number; line_total: number; warranty: string | null; created_at: string },
        { id?: string; order_id: string; product_id?: string | null; product_name: string; product_sku: string; quantity: number; base_unit_price: number; unit_price: number; discount_amount?: number; line_total: number; warranty?: string | null; created_at?: string },
        [Relationship<'order_items_order_id_fkey', 'order_id', 'orders', 'id'>, Relationship<'order_items_product_id_fkey', 'product_id', 'products', 'id'>]
      >;
      order_status_history: Table<
        { id: string; order_id: string; status: OrderStatus; changed_at: string; changed_by: string | null },
        { id?: string; order_id: string; status: OrderStatus; changed_at?: string; changed_by?: string | null },
        [Relationship<'order_status_history_order_id_fkey', 'order_id', 'orders', 'id'>]
      >;
      categories: Table<
        { id: string; name: string; slug: string; description: string | null; active: boolean; seo_title: string | null; seo_description: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; slug: string; description?: string | null; active?: boolean; seo_title?: string | null; seo_description?: string | null; created_at?: string; updated_at?: string }
      >;
      bike_models: Table<
        { id: string; name: string; slug: string; brand: string | null; engine_capacity: string | null; active: boolean; created_at: string; updated_at: string },
        { id?: string; name: string; slug: string; brand?: string | null; engine_capacity?: string | null; active?: boolean; created_at?: string; updated_at?: string }
      >;
      suppliers: Table<
        { id: string; name: string; website: string | null; url: string | null; country: string | null; contact_information: Json; rating: number | null; reliability_notes: string | null; shipping_information: string | null; api_status: string; active: boolean; created_at: string; updated_at: string },
        { id?: string; name: string; website?: string | null; url?: string | null; country?: string | null; contact_information?: Json; rating?: number | null; reliability_notes?: string | null; shipping_information?: string | null; api_status?: string; active?: boolean; created_at?: string; updated_at?: string }
      >;
      products: Table<
        { id: string; name: string; slug: string; sku: string; category_id: string | null; brand: string; short_description: string | null; description: string | null; specifications: Json; selling_price: number; discount_price: number | null; supplier_id: string | null; supplier_product_url: string | null; supplier_sku: string | null; supplier_cost: number | null; shipping_cost_estimate: number | null; estimated_profit: number; availability_status: AvailabilityStatus; supplier_last_checked: string | null; estimated_supplier_quantity: number | null; warranty: string | null; return_eligibility: string | null; seo_title: string | null; seo_description: string | null; published: boolean; archived_at: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; slug: string; sku: string; category_id?: string | null; brand: string; short_description?: string | null; description?: string | null; specifications?: Json; selling_price: number; discount_price?: number | null; supplier_id?: string | null; supplier_product_url?: string | null; supplier_sku?: string | null; supplier_cost?: number | null; shipping_cost_estimate?: number | null; availability_status?: AvailabilityStatus; supplier_last_checked?: string | null; estimated_supplier_quantity?: number | null; warranty?: string | null; return_eligibility?: string | null; seo_title?: string | null; seo_description?: string | null; published?: boolean; archived_at?: string | null; created_at?: string; updated_at?: string },
        [Relationship<'products_category_id_fkey', 'category_id', 'categories', 'id'>, Relationship<'products_supplier_id_fkey', 'supplier_id', 'suppliers', 'id'>]
      >;
      product_images: Table<
        { id: string; product_id: string; image_url: string; alt_text: string | null; sort_order: number; created_at: string },
        { id?: string; product_id: string; image_url: string; alt_text?: string | null; sort_order?: number; created_at?: string },
        [Relationship<'product_images_product_id_fkey', 'product_id', 'products', 'id'>]
      >;
      product_bike_compatibility: Table<
        { product_id: string; bike_model_id: string },
        { product_id: string; bike_model_id: string },
        [Relationship<'product_bike_compatibility_product_id_fkey', 'product_id', 'products', 'id'>, Relationship<'product_bike_compatibility_bike_model_id_fkey', 'bike_model_id', 'bike_models', 'id'>]
      >;
      supplier_products: Table<
        { id: string; supplier_id: string; product_id: string; supplier_product_url: string | null; supplier_sku: string | null; supplier_cost: number | null; moq: number | null; supplier_rating: number | null; product_quality_notes: string | null; created_at: string; updated_at: string },
        { id?: string; supplier_id: string; product_id: string; supplier_product_url?: string | null; supplier_sku?: string | null; supplier_cost?: number | null; moq?: number | null; supplier_rating?: number | null; product_quality_notes?: string | null; created_at?: string; updated_at?: string },
        [Relationship<'supplier_products_supplier_id_fkey', 'supplier_id', 'suppliers', 'id'>, Relationship<'supplier_products_product_id_fkey', 'product_id', 'products', 'id'>]
      >;
      supplier_availability: Table<
        { id: string; supplier_product_id: string; availability_status: AvailabilityStatus; estimated_quantity: number | null; checked_at: string },
        { id?: string; supplier_product_id: string; availability_status?: AvailabilityStatus; estimated_quantity?: number | null; checked_at?: string },
        [Relationship<'supplier_availability_supplier_product_id_fkey', 'supplier_product_id', 'supplier_products', 'id'>]
      >;
      reviews: Table<
        { id: string; product_id: string; customer_id: string | null; order_id: string | null; rating: number; title: string; body: string; verified_purchase: boolean; is_visible: boolean; created_at: string; updated_at: string },
        { id?: string; product_id: string; customer_id?: string | null; order_id?: string | null; rating: number; title?: string; body: string; verified_purchase?: boolean; is_visible?: boolean; created_at?: string; updated_at?: string },
        [Relationship<'reviews_product_id_fkey', 'product_id', 'products', 'id'>, Relationship<'reviews_customer_id_fkey', 'customer_id', 'profiles', 'id'>]
      >;
      customer_feedback: Table<
        { id: string; customer_id: string; product_id: string | null; order_id: string | null; category: string; message: string; rating: number | null; status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'; internal_notes: string | null; created_at: string; updated_at: string },
        { id?: string; customer_id: string; product_id?: string | null; order_id?: string | null; category?: string; message: string; rating?: number | null; status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'; internal_notes?: string | null; created_at?: string; updated_at?: string },
        [Relationship<'customer_feedback_customer_id_fkey', 'customer_id', 'profiles', 'id'>, Relationship<'customer_feedback_product_id_fkey', 'product_id', 'products', 'id'>, Relationship<'customer_feedback_order_id_fkey', 'order_id', 'orders', 'id'>]
      >;
      approval_requests: Table<
        { id: string; request_type: 'PRODUCT_PUBLICATION' | 'SUPPLIER_PURCHASE' | 'REFUND' | 'MAJOR_PRICE_CHANGE' | 'PRODUCT_REMOVAL' | 'OTHER'; subject: string; details: string; metadata: Json; status: 'PENDING' | 'APPROVED' | 'REJECTED'; requested_by: string | null; decided_by: string | null; decision_notes: string | null; created_at: string; decided_at: string | null },
        { id?: string; request_type: 'PRODUCT_PUBLICATION' | 'SUPPLIER_PURCHASE' | 'REFUND' | 'MAJOR_PRICE_CHANGE' | 'PRODUCT_REMOVAL' | 'OTHER'; subject: string; details?: string; metadata?: Json; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; requested_by?: string | null; decided_by?: string | null; decision_notes?: string | null; created_at?: string; decided_at?: string | null }
      >;
      automation_logs: Table<
        { id: string; agent: string; task: string; action: string; status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL' | 'ESCALATED'; error: string | null; approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null; created_at: string; completed_at: string | null },
        { id?: string; agent: string; task: string; action: string; status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL' | 'ESCALATED'; error?: string | null; approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null; created_at?: string; completed_at?: string | null }
      >;
      business_settings: Table<
        { setting_key: string; setting_value: Json; is_public: boolean; updated_at: string; updated_by: string | null },
        { setting_key: string; setting_value: Json; is_public?: boolean; updated_at?: string; updated_by?: string | null }
      >;
      return_requests: Table<
        { id: string; order_id: string; order_item_id: string; customer_id: string; reason: ReturnReason; description: string; status: ReturnRequestStatus; internal_notes: string | null; decided_by: string | null; decided_at: string | null; created_at: string; updated_at: string },
        { id?: string; order_id: string; order_item_id: string; customer_id: string; reason: ReturnReason; description?: string; status?: ReturnRequestStatus; internal_notes?: string | null; decided_by?: string | null; decided_at?: string | null; created_at?: string; updated_at?: string }
      >;
      faq_entries: Table<
        { id: string; topic: FaqTopic; question: string; answer: string; active: boolean; sort_order: number; created_at: string; updated_at: string },
        { id?: string; topic: FaqTopic; question: string; answer: string; active?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
      >;
      support_conversations: Table<
        { id: string; customer_id: string; related_order_id: string | null; category: SupportCategory; subject: string; status: SupportConversationStatus; created_at: string; updated_at: string },
        { id?: string; customer_id: string; related_order_id?: string | null; category: SupportCategory; subject: string; status?: SupportConversationStatus; created_at?: string; updated_at?: string }
      >;
      support_messages: Table<
        { id: string; conversation_id: string; sender_id: string; sender_role: 'CUSTOMER' | 'ADMIN'; body: string; is_internal: boolean; created_at: string },
        { id?: string; conversation_id: string; sender_id?: string; sender_role?: 'CUSTOMER' | 'ADMIN'; body: string; is_internal?: boolean; created_at?: string }
      >;
      support_internal_notes: Table<
        { id: string; conversation_id: string; author_id: string; body: string; created_at: string },
        { id?: string; conversation_id: string; author_id?: string; body: string; created_at?: string }
      >;
    };
    Views: {
      public_products: {
        Row: { id: string; name: string; slug: string; sku: string; category_id: string | null; brand: string; short_description: string | null; description: string | null; specifications: Json; selling_price: number; discount_price: number | null; availability_status: AvailabilityStatus; warranty: string | null; return_eligibility: string | null; seo_title: string | null; seo_description: string | null; published: boolean; created_at: string; updated_at: string; category_name: string | null; category_slug: string | null };
        Relationships: [];
      };
      public_product_images: {
        Row: { id: string; product_id: string; image_url: string; alt_text: string | null; sort_order: number };
        Relationships: [];
      };
      public_product_bikes: {
        Row: { product_id: string; bike_model_id: string; name: string; slug: string; brand: string | null; engine_capacity: string | null };
        Relationships: [];
      };
      public_product_reviews: {
        Row: { id: string; product_id: string; rating: number; title: string; body: string; verified_purchase: boolean; created_at: string };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      set_updated_at: { Args: Record<PropertyKey, never>; Returns: unknown };
      handle_new_customer: { Args: Record<PropertyKey, never>; Returns: unknown };
      record_order_status_change: { Args: Record<PropertyKey, never>; Returns: unknown };
      _quote_customer_order: { Args: { p_items: Json }; Returns: Json };
      quote_customer_order: { Args: { p_items: Json }; Returns: Json };
      create_customer_order: { Args: { p_items: Json; p_shipping: Json; p_customer_notes?: string | null }; Returns: Json };
      admin_update_order: { Args: { p_order_id: string; p_status: OrderStatus; p_tracking_number?: string | null; p_courier?: string | null; p_internal_notes?: string | null }; Returns: Database['public']['Tables']['orders']['Row'] };
      admin_update_order_payment: { Args: { p_order_id: string; p_payment_status: PaymentStatus; p_reference?: string | null; p_note?: string | null }; Returns: Database['public']['Tables']['orders']['Row'] };
      admin_dashboard_metrics: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      availability_status: AvailabilityStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<never, never>;
  };
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const publicClientKey = publishableKey || anonKey;

export const isSupabaseConfigured = Boolean(url && publicClientKey);
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url as string, publicClientKey as string)
  : null;
