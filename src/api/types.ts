export type ProductCategory = 'Street' | 'Sport' | 'Commuter' | 'Utility' | 'Adventure';
export type OrderStatus = 'Processing' | 'Shipped' | 'Delivered';
export type AdminOrderStatus = 'PENDING' | 'CONFIRMED' | 'SUPPLIER_PROCESSING' | 'SUPPLIER_SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED';
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'CHECK_REQUIRED';

export interface CatalogFilters {
  search?: string;
  categorySlug?: string;
  bikeModelId?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: AvailabilityStatus;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name';
}

export interface ProductImage { id: string; url: string; alt: string; }
export interface BikeModel { id: string; name: string; slug: string; brand: string | null; engineCapacity: string | null; }

export interface Product {
  id: string;
  slug: string;
  name: string;
  pricePk: number;
  category: ProductCategory;
  categoryId?: string | null;
  featured: boolean;
  status: string;
  stock: number;
  image: string;
  description: string;
  specs: { label: string; value: string }[];
  brand?: string;
  shortDescription?: string;
  discountPrice?: number | null;
  originalPrice?: number;
  availabilityStatus?: AvailabilityStatus;
  images?: ProductImage[];
  compatibleBikes?: BikeModel[];
  warranty?: string | null;
  returnEligibility?: string | null;
  sku?: string;
  supplierId?: string | null;
  supplierProductUrl?: string | null;
  supplierSku?: string | null;
  supplierCost?: number | null;
  shippingCostEstimate?: number | null;
  estimatedProfit?: number;
  archivedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface AdminProductInput {
  name: string;
  slug: string;
  sku: string;
  categoryId: string | null;
  brand: string;
  shortDescription: string;
  description: string;
  specifications: Record<string, string>;
  sellingPrice: number;
  discountPrice: number | null;
  supplierId: string | null;
  supplierProductUrl: string;
  supplierSku: string;
  supplierCost: number | null;
  shippingCostEstimate: number | null;
  availabilityStatus: AvailabilityStatus;
  estimatedSupplierQuantity: number | null;
  warranty: string;
  returnEligibility: string;
  published: boolean;
  seoTitle?: string;
  seoDescription?: string;
  archivedAt?: string | null;
}

export interface Category { id: string; name: string; slug: string; description?: string | null; active?: boolean; seoTitle?: string | null; seoDescription?: string | null; }
export interface AdminSupplier { id: string; name: string; website: string | null; url?: string | null; country?: string | null; contactInformation?: Record<string, unknown>; rating?: number | null; reliabilityNotes?: string | null; shippingInformation?: string | null; apiStatus?: string; active: boolean; }
export interface Order { id: string; totalPk: number; status: OrderStatus; createdAt: string; customer?: string; }
export interface HealthResponse { status: 'healthy' | 'degraded' | 'unhealthy'; services: Record<string, string>; }
export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  getCatalog(filters?: CatalogFilters): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  getProductsByIds(ids: string[]): Promise<Product[]>;
  getAccountOrders(): Promise<Order[]>;
  getAdminOrders(): Promise<Order[]>;
  listCategories(): Promise<Category[]>;
  listBikeModels(): Promise<BikeModel[]>;
  listSuppliers(): Promise<AdminSupplier[]>;
  listAdminProducts(): Promise<Product[]>;
  createProduct(input: AdminProductInput): Promise<Product>;
  updateProduct(id: string, input: Partial<AdminProductInput>): Promise<Product>;
  setProductImages(productId: string, images: Array<{ url: string; alt: string; sortOrder: number }>): Promise<void>;
  setProductBikeModels(productId: string, bikeModelIds: string[]): Promise<void>;
}
