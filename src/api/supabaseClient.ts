import { supabase } from '../lib/supabase';
import type { ApiClient, AdminProductInput, AdminSupplier, AvailabilityStatus, BikeModel, CatalogFilters, Category, Order, Product, ProductImage } from './types';

type Row = Record<string, unknown>;

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function toRow(value: object): Row {
  const row: Row = {};
  for (const key of Object.keys(value)) row[key] = Reflect.get(value, key) as unknown;
  return row;
}

function productFromRow(row: Row, images: ProductImage[] = [], compatibleBikes: BikeModel[] = []): Product {
  const specifications = row.specifications && typeof row.specifications === 'object' ? row.specifications as Record<string, unknown> : {};
  return {
    id: String(row.id),
    sku: String(row.sku ?? ''),
    slug: String(row.slug),
    name: String(row.name),
    pricePk: numberValue(row.discount_price ?? row.selling_price),
    category: String(row.category_name ?? 'Uncategorised') as Product['category'],
    categoryId: row.category_id as string | null | undefined,
    featured: Boolean(row.published),
    status: String(row.availability_status ?? 'CHECK_REQUIRED'),
    stock: numberValue(row.estimated_supplier_quantity),
    image: images[0]?.url ?? '',
    description: String(row.description ?? row.short_description ?? ''),
    specs: Object.entries(specifications).map(([label, value]) => ({ label, value: String(value) })),
    brand: String(row.brand ?? ''),
    shortDescription: String(row.short_description ?? ''),
    discountPrice: row.discount_price === null || row.discount_price === undefined ? null : numberValue(row.discount_price),
    originalPrice: numberValue(row.selling_price),
    availabilityStatus: row.availability_status as AvailabilityStatus | undefined,
    images,
    compatibleBikes,
    warranty: row.warranty as string | null | undefined,
    returnEligibility: row.return_eligibility as string | null | undefined,
    supplierCost: row.supplier_cost === null || row.supplier_cost === undefined ? null : numberValue(row.supplier_cost),
    shippingCostEstimate: row.shipping_cost_estimate === null || row.shipping_cost_estimate === undefined ? null : numberValue(row.shipping_cost_estimate),
    estimatedProfit: numberValue(row.estimated_profit),
    archivedAt: row.archived_at as string | null | undefined,
    seoTitle: row.seo_title as string | null | undefined,
    seoDescription: row.seo_description as string | null | undefined,
  };
}

async function imagesFor(productIds: string[]): Promise<Record<string, ProductImage[]>> {
  if (!productIds.length) return {};
  const { data, error } = await client().from('public_product_images').select('id, product_id, image_url, alt_text, sort_order').in('product_id', productIds).order('sort_order');
  if (error) throw error;
  return (data as Row[]).reduce<Record<string, ProductImage[]>>((result, row) => {
    const productId = String(row.product_id);
    (result[productId] ??= []).push({ id: String(row.id), url: String(row.image_url), alt: String(row.alt_text ?? '') });
    return result;
  }, {});
}

async function bikesFor(productIds: string[]): Promise<Record<string, BikeModel[]>> {
  if (!productIds.length) return {};
  const { data, error } = await client().from('public_product_bikes').select('product_id, bike_model_id, name, slug, brand, engine_capacity').in('product_id', productIds);
  if (error) throw error;
  return (data as Row[]).reduce<Record<string, BikeModel[]>>((result, row) => {
    const productId = String(row.product_id);
    (result[productId] ??= []).push({ id: String(row.bike_model_id), name: String(row.name), slug: String(row.slug), brand: row.brand as string | null, engineCapacity: row.engine_capacity as string | null });
    return result;
  }, {});
}

async function hydrate(rows: Row[]): Promise<Product[]> {
  const ids = rows.map((row) => String(row.id));
  const [images, bikes] = await Promise.all([imagesFor(ids), bikesFor(ids)]);
  return rows.map((row) => productFromRow(row, images[String(row.id)] ?? [], bikes[String(row.id)] ?? []));
}

function orderStatus(status: string): Order['status'] {
  if (status === 'DELIVERED') return 'Delivered';
  if (status === 'SUPPLIER_SHIPPED' || status === 'IN_TRANSIT') return 'Shipped';
  return 'Processing';
}

async function orders(): Promise<Order[]> {
  const { data, error } = await client().from('orders')
    .select('id, total, status, created_at, shipping_full_name')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    totalPk: row.total,
    status: orderStatus(row.status),
    createdAt: row.created_at,
    customer: row.shipping_full_name,
  }));
}

function productPayload(input: Partial<AdminProductInput>) {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.slug === undefined ? {} : { slug: input.slug }),
    ...(input.sku === undefined ? {} : { sku: input.sku }),
    ...(input.categoryId === undefined ? {} : { category_id: input.categoryId }),
    ...(input.brand === undefined ? {} : { brand: input.brand }),
    ...(input.shortDescription === undefined ? {} : { short_description: input.shortDescription }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.specifications === undefined ? {} : { specifications: input.specifications }),
    ...(input.sellingPrice === undefined ? {} : { selling_price: input.sellingPrice }),
    ...(input.discountPrice === undefined ? {} : { discount_price: input.discountPrice }),
    ...(input.supplierId === undefined ? {} : { supplier_id: input.supplierId }),
    ...(input.supplierProductUrl === undefined ? {} : { supplier_product_url: input.supplierProductUrl }),
    ...(input.supplierSku === undefined ? {} : { supplier_sku: input.supplierSku }),
    ...(input.supplierCost === undefined ? {} : { supplier_cost: input.supplierCost }),
    ...(input.shippingCostEstimate === undefined ? {} : { shipping_cost_estimate: input.shippingCostEstimate }),
    ...(input.availabilityStatus === undefined ? {} : { availability_status: input.availabilityStatus }),
    ...(input.estimatedSupplierQuantity === undefined ? {} : { estimated_supplier_quantity: input.estimatedSupplierQuantity }),
    ...(input.warranty === undefined ? {} : { warranty: input.warranty }),
    ...(input.returnEligibility === undefined ? {} : { return_eligibility: input.returnEligibility }),
    ...(input.published === undefined ? {} : { published: input.published }),
    ...(input.seoTitle === undefined ? {} : { seo_title: input.seoTitle }),
    ...(input.seoDescription === undefined ? {} : { seo_description: input.seoDescription }),
    ...(input.archivedAt === undefined ? {} : { archived_at: input.archivedAt }),
  };
}

export const supabaseClient: ApiClient = {
  async getHealth() {
    try {
      const { error } = await client().from('public_products').select('id').limit(1);
      return error ? { status: 'degraded', services: { catalog: error.message } } : { status: 'healthy', services: { catalog: 'operational' } };
    } catch {
      return { status: 'healthy', services: { catalog: 'demo_active' } };
    }
  },
  async getCatalog(filters: CatalogFilters = {}) {
    let rows: Row[] = [];
    try {
      let query = client().from('public_products').select('*');
      if (filters.search) query = query.or(`name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`);
      if (filters.categorySlug) query = query.eq('category_slug', filters.categorySlug);
      if (filters.minPrice !== undefined) query = query.gte('selling_price', filters.minPrice);
      if (filters.maxPrice !== undefined) query = query.lte('selling_price', filters.maxPrice);
      if (filters.availability) query = query.eq('availability_status', filters.availability);
      if (filters.sort === 'price_asc') query = query.order('selling_price', { ascending: true });
      else if (filters.sort === 'price_desc') query = query.order('selling_price', { ascending: false });
      else if (filters.sort === 'name') query = query.order('name', { ascending: true });
      else query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        rows = data.map(toRow);
      }
      if (filters.bikeModelId && rows.length > 0) {
        const compatibility = await client().from('public_product_bikes').select('product_id').eq('bike_model_id', filters.bikeModelId);
        if (!compatibility.error && compatibility.data) {
          const ids = new Set(compatibility.data.map((row) => String(row.product_id)));
          rows = rows.filter((row) => ids.has(String(row.id)));
        }
      }
    } catch {
      // Supabase is not populated or offline
    }

    const products = await hydrate(rows).catch(() => []);
    return products;
  },
  async getProduct(slug) {
    try {
      const { data, error } = await client().from('public_products').select('*').eq('slug', slug).maybeSingle();
      if (!error && data) {
        const products = await hydrate([data as Row]);
        if (products[0]) return products[0];
      }
    } catch {
      // Supabase is not configured or unreachable
    }
    return null;
  },
  async getProductsByIds(ids) {
    if (!ids.length) return [];
    let products: Product[] = [];
    try {
      const { data, error } = await client().from('public_products').select('*').in('id', ids);
      if (!error && data) {
        products = await hydrate((data ?? []).map(toRow));
      }
    } catch {
      // Supabase is not configured or unreachable
    }
    return products;
  },
  async getAccountOrders() { return orders(); },
  async getAdminOrders() { return orders(); },
  async listCategories() {
    const { data, error } = await client().from('categories').select('id, name, slug, description, active, seo_title, seo_description').eq('active', true).order('name');
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, slug: row.slug, description: row.description, active: row.active, seoTitle: row.seo_title, seoDescription: row.seo_description })) as Category[];
  },
  async listBikeModels() {
    const { data, error } = await client().from('bike_models').select('id, name, slug, brand, engine_capacity').eq('active', true).order('name');
    if (error) throw error;
    return (data as Row[]).map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), brand: row.brand as string | null, engineCapacity: row.engine_capacity as string | null }));
  },
  async listSuppliers() {
    const { data, error } = await client().from('suppliers').select('id, name, website, active').eq('active', true).order('name');
    if (error) throw error;
    return (data ?? []) as AdminSupplier[];
  },
  async listAdminProducts() {
    const { data, error } = await client().from('products').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map(toRow);
    const productIds = rows.map((row) => String(row.id));
    if (!productIds.length) return [];
    const [imageResult, compatibilityResult] = await Promise.all([
      client().from('product_images').select('id,product_id,image_url,alt_text,sort_order').in('product_id', productIds).order('sort_order'),
      client().from('product_bike_compatibility').select('product_id,bike_model_id').in('product_id', productIds),
    ]);
    if (imageResult.error) throw imageResult.error;
    if (compatibilityResult.error) throw compatibilityResult.error;
    const bikeIds = [...new Set(compatibilityResult.data.map((row) => row.bike_model_id))];
    const bikeResult = bikeIds.length ? await client().from('bike_models').select('id,name,slug,brand,engine_capacity').in('id', bikeIds) : { data: [], error: null };
    if (bikeResult.error) throw bikeResult.error;
    const imagesByProduct = new Map<string, ProductImage[]>();
    for (const image of imageResult.data) {
      const images = imagesByProduct.get(image.product_id) ?? [];
      images.push({ id: image.id, url: image.image_url, alt: image.alt_text ?? '' });
      imagesByProduct.set(image.product_id, images);
    }
    const bikeById = new Map(bikeResult.data.map((bike) => [bike.id, { id: bike.id, name: bike.name, slug: bike.slug, brand: bike.brand, engineCapacity: bike.engine_capacity }]));
    const bikesByProduct = new Map<string, BikeModel[]>();
    for (const link of compatibilityResult.data) {
      const bike = bikeById.get(link.bike_model_id);
      if (!bike) continue;
      const bikes = bikesByProduct.get(link.product_id) ?? [];
      bikes.push(bike);
      bikesByProduct.set(link.product_id, bikes);
    }
    return rows.map((row) => productFromRow(row, imagesByProduct.get(String(row.id)) ?? [], bikesByProduct.get(String(row.id)) ?? []));
  },
  async createProduct(input) {
    const payload = { ...productPayload(input), name: input.name, slug: input.slug, sku: input.sku, brand: input.brand, selling_price: input.sellingPrice };
    const { data, error } = await client().from('products').insert(payload).select('*').single();
    if (error) throw error;
    return productFromRow(data as Row);
  },
  async updateProduct(id, input) {
    const { data, error } = await client().from('products').update(productPayload(input)).eq('id', id).select('*').single();
    if (error) throw error;
    return productFromRow(data as Row);
  },
  async setProductImages(productId, images) {
    const db = client();
    const deleted = await db.from('product_images').delete().eq('product_id', productId);
    if (deleted.error) throw deleted.error;
    if (!images.length) return;
    const inserted = await db.from('product_images').insert(images.map((image) => ({ product_id: productId, image_url: image.url, alt_text: image.alt, sort_order: image.sortOrder })));
    if (inserted.error) throw inserted.error;
  },
  async setProductBikeModels(productId, bikeModelIds) {
    const db = client();
    const deleted = await db.from('product_bike_compatibility').delete().eq('product_id', productId);
    if (deleted.error) throw deleted.error;
    if (!bikeModelIds.length) return;
    const inserted = await db.from('product_bike_compatibility').insert(bikeModelIds.map((bikeModelId) => ({ product_id: productId, bike_model_id: bikeModelId })));
    if (inserted.error) throw inserted.error;
  },
};
