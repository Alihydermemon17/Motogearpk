import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AddRegular,
  ArrowUploadRegular,
  BoxMultipleRegular,
  CheckmarkCircleRegular,
  DismissRegular,
  EditRegular,
  ImageRegular,
  MoreHorizontalRegular,
  SearchRegular,
} from '@fluentui/react-icons';
import { api } from '../../api';
import { listAdminSuppliers, type AdminSupplier } from '../../api/admin';
import type { AdminProductInput, AvailabilityStatus, BikeModel, Category, Product } from '../../api/types';
import { supabase } from '../../lib/supabase';
import type { Navigate } from '../AdminDashboard';
import { useLeaveGuard } from '../AdminDashboard';
import {
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  ErrorBanner,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  SelectFilter,
  StatusPill,
  ToastHost,
  failureText,
  money,
  useToast,
  type Column,
} from '../components/ui';

const PAGE_SIZE = 25;

const emptyInput: AdminProductInput = {
  name: '',
  slug: '',
  sku: '',
  categoryId: null,
  brand: '',
  shortDescription: '',
  description: '',
  specifications: {},
  sellingPrice: 0,
  discountPrice: null,
  supplierId: null,
  supplierProductUrl: '',
  supplierSku: '',
  supplierCost: null,
  shippingCostEstimate: null,
  availabilityStatus: 'CHECK_REQUIRED',
  estimatedSupplierQuantity: null,
  warranty: '',
  returnEligibility: '',
  published: false,
  seoTitle: '',
  seoDescription: '',
  archivedAt: null,
};

type EditorImage = { url: string; alt: string };

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

const productStatus = (product: Product) =>
  product.archivedAt ? 'ARCHIVED' : product.featured ? 'PUBLISHED' : 'DRAFT';

const effectivePrice = (product: Product) => product.pricePk;

const marginOf = (product: Product) => {
  if (product.supplierCost == null) return null;
  return effectivePrice(product) - product.supplierCost;
};

export function ProductsPage({ navigate }: { navigate: Navigate }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bikes, setBikes] = useState<BikeModel[]>([]);
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [missingCost, setMissingCost] = useState(false);
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archiveTargets, setArchiveTargets] = useState<Product[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const toast = useToast();

  // Editor state
  const [form, setForm] = useState<AdminProductInput>(emptyInput);
  const [baseline, setBaseline] = useState('');
  const [images, setImages] = useState<EditorImage[]>([]);
  const [bikeIds, setBikeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const dragIndex = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      const [productRows, categoryRows, bikeRows, supplierRows] = await Promise.all([
        api.listAdminProducts(),
        api.listCategories(),
        api.listBikeModels(),
        listAdminSuppliers(),
      ]);
      setProducts(productRows);
      setCategories(categoryRows);
      setBikes(bikeRows);
      setSuppliers(supplierRows);
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // Deep links from Overview: filter the table to the issue that was clicked.
    const params = new URLSearchParams(window.location.search);
    const availability = params.get('availability');
    const cost = params.get('cost');
    if (availability) setAvailabilityFilter(availability);
    if (cost === 'missing') setMissingCost(true);
  }, []);

  const categoryName = (id: string | null | undefined) =>
    categories.find((row) => row.id === id)?.name ?? 'Uncategorised';

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = products.filter((product) => {
      const status = productStatus(product);
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && product.categoryId !== categoryFilter) return false;
      if (availabilityFilter !== 'ALL' && product.availabilityStatus !== availabilityFilter) return false;
      if (missingCost && product.supplierCost != null) return false;
      if (term && !`${product.name} ${product.sku ?? ''} ${product.brand ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      switch (sort) {
        case 'price-asc': return a.pricePk - b.pricePk;
        case 'price-desc': return b.pricePk - a.pricePk;
        case 'margin': return (marginOf(b) ?? -Infinity) - (marginOf(a) ?? -Infinity);
        case 'newest': return b.id.localeCompare(a.id);
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [products, search, categoryFilter, statusFilter, availabilityFilter, missingCost, sort]);

  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [search, categoryFilter, statusFilter, availabilityFilter, missingCost, sort]);

  const startCreate = () => {
    const next = { ...emptyInput };
    setEditing(null);
    setForm(next);
    setBaseline(JSON.stringify({ form: next, images: [], bikeIds: [] }));
    setImages([]);
    setBikeIds([]);
    setFormError('');
    setUrlDraft('');
    setDrawerOpen(true);
  };

  const startEdit = (product: Product) => {
    const next: AdminProductInput = {
      ...emptyInput,
      name: product.name,
      slug: product.slug,
      sku: product.sku ?? '',
      categoryId: product.categoryId ?? null,
      brand: product.brand ?? '',
      description: product.description,
      shortDescription: product.shortDescription ?? '',
      specifications: Object.fromEntries(product.specs.map((spec) => [spec.label, spec.value])),
      sellingPrice: product.originalPrice ?? product.pricePk,
      discountPrice: product.discountPrice ?? null,
      supplierId: product.supplierId ?? null,
      supplierProductUrl: product.supplierProductUrl ?? '',
      supplierSku: product.supplierSku ?? '',
      supplierCost: product.supplierCost ?? null,
      shippingCostEstimate: product.shippingCostEstimate ?? null,
      availabilityStatus: product.availabilityStatus ?? 'CHECK_REQUIRED',
      estimatedSupplierQuantity: product.stock ?? null,
      warranty: product.warranty ?? '',
      returnEligibility: product.returnEligibility ?? '',
      published: product.featured,
      seoTitle: product.seoTitle ?? '',
      seoDescription: product.seoDescription ?? '',
      archivedAt: product.archivedAt ?? null,
    };
    const nextImages = (product.images ?? []).map((image) => ({
      url: image.url,
      alt: image.alt || product.name,
    }));
    const nextBikes = (product.compatibleBikes ?? []).map((bike) => bike.id);
    setEditing(product);
    setForm(next);
    setImages(nextImages);
    setBikeIds(nextBikes);
    setBaseline(JSON.stringify({ form: next, images: nextImages, bikeIds: nextBikes }));
    setFormError('');
    setUrlDraft('');
    setDrawerOpen(true);
  };

  const dirty = drawerOpen && JSON.stringify({ form, images, bikeIds }) !== baseline;

  useLeaveGuard(dirty);

  const closeDrawer = (force = false) => {
    if (!force && dirty) {
      setDiscardOpen(true);
      return;
    }
    setDrawerOpen(false);
    setDiscardOpen(false);
    setEditing(null);
    setForm(emptyInput);
    setImages([]);
    setBikeIds([]);
  };

  const setField = <K extends keyof AdminProductInput>(field: K, value: AdminProductInput[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setFormError('');
    if (!form.name.trim() || !form.slug.trim() || !form.sku.trim() || !form.brand.trim()) {
      setFormError('Name, slug, SKU and brand are required.');
      return;
    }
    if (!form.sellingPrice || form.sellingPrice <= 0) {
      setFormError('Selling price must be greater than zero.');
      return;
    }
    setSaving(true);
    try {
      const product = editing
        ? await api.updateProduct(editing.id, form)
        : await api.createProduct(form);
      await api.setProductImages(
        product.id,
        images.map((image, index) => ({ url: image.url, alt: image.alt || form.name, sortOrder: index })),
      );
      await api.setProductBikeModels(product.id, bikeIds);
      toast.success(editing ? 'Product saved.' : 'Product created.');
      setBaseline(JSON.stringify({ form, images, bikeIds }));
      await load();
      setDrawerOpen(false);
      setEditing(null);
    } catch (reason: unknown) {
      const message = failureText(reason);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTargets.length) return;
    setArchiving(true);
    try {
      for (const product of archiveTargets) {
        await api.updateProduct(product.id, {
          published: false,
          archivedAt: new Date().toISOString(),
        });
      }
      toast.success(
        archiveTargets.length === 1
          ? `${archiveTargets[0].name} archived.`
          : `${archiveTargets.length} products archived.`,
      );
      setSelected(new Set());
      setArchiveTargets([]);
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setArchiving(false);
    }
  };

  const restore = async (product: Product) => {
    try {
      await api.updateProduct(product.id, { archivedAt: null });
      toast.success(`${product.name} restored as a draft.`);
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!supabase) {
      toast.error('Image storage is not configured. Paste an image URL instead.');
      return;
    }
    setUploading(true);
    try {
      const uploaded: EditorImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `products/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from('product-images')
          .upload(path, file, { cacheControl: '31536000', upsert: false });
        if (error) throw new Error('IMAGE_STORAGE');
        const { data } = supabase.storage.from('product-images').getPublicUrl(path);
        uploaded.push({ url: data.publicUrl, alt: form.name });
      }
      setImages((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded.`);
    } catch (reason: unknown) {
      const storageIssue = reason instanceof Error && reason.message === 'IMAGE_STORAGE';
      toast.error(storageIssue
        ? 'The product-images storage bucket is not available yet. Paste a public image URL instead.'
        : failureText(reason));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    setImages((current) => [...current, { url, alt: form.name }]);
    setUrlDraft('');
  };

  const moveImage = (from: number, to: number) => {
    setImages((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const columns: Array<Column<Product>> = [
    {
      key: 'product',
      label: 'Product',
      width: '30%',
      render: (product) => (
        <span className="adm-product-cell">
          <span className="adm-thumb">
            {product.image ? (
              <img src={product.image} alt="" loading="lazy" />
            ) : (
              <BoxMultipleRegular aria-hidden="true" />
            )}
          </span>
          <span className="adm-cell-stack">
            <strong>{product.name}</strong>
            <small>/{product.slug}</small>
          </span>
        </span>
      ),
    },
    { key: 'sku', label: 'SKU', render: (product) => <span className="adm-mono">{product.sku || '—'}</span> },
    { key: 'category', label: 'Category', render: (product) => categoryName(product.categoryId) },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (product) => (
        <span className="adm-cell-stack align-right">
          <strong className="adm-num">{money(product.pricePk)}</strong>
          {product.originalPrice && product.originalPrice > product.pricePk && (
            <small className="adm-strike">{money(product.originalPrice)}</small>
          )}
        </span>
      ),
    },
    {
      key: 'cost',
      label: 'Supplier cost',
      align: 'right',
      render: (product) => product.supplierCost == null
        ? <span className="adm-missing">Not set</span>
        : <span className="adm-num">{money(product.supplierCost)}</span>,
    },
    {
      key: 'margin',
      label: 'Margin',
      align: 'right',
      render: (product) => {
        const margin = marginOf(product);
        if (margin == null) return <span className="adm-missing">—</span>;
        const price = effectivePrice(product);
        const percent = price > 0 ? Math.round((margin / price) * 100) : 0;
        return (
          <span className="adm-cell-stack align-right">
            <strong className="adm-num">{money(margin)}</strong>
            <small>{percent}%</small>
          </span>
        );
      },
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (product) => <StatusPill status={product.availabilityStatus ?? 'CHECK_REQUIRED'} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (product) => {
        const status = productStatus(product);
        return <StatusPill status={status} label={status === 'PUBLISHED' ? 'Published' : status === 'ARCHIVED' ? 'Archived' : 'Draft'} />;
      },
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: '150px',
      render: (product) => (
        <span className="adm-row-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => startEdit(product)}>
            <EditRegular aria-hidden="true" />
            Edit
          </button>
          <details className="adm-row-menu">
            <summary aria-label={`More actions for ${product.name}`} title="More actions">
              <MoreHorizontalRegular />
            </summary>
            <div role="menu">
              {product.archivedAt ? (
                <button type="button" role="menuitem" onClick={() => void restore(product)}>
                  Restore as draft
                </button>
              ) : (
                <button type="button" role="menuitem" className="is-danger" onClick={() => setArchiveTargets([product])}>
                  Archive product
                </button>
              )}
            </div>
          </details>
        </span>
      ),
    },
  ];

  const price = form.discountPrice ?? form.sellingPrice;
  const margin = form.supplierCost == null ? null : price - form.supplierCost;
  const marginPercent = price > 0 && margin != null ? Math.round((margin / price) * 100) : null;
  const bikeBrands = Array.from(new Set(bikes.map((bike) => bike.brand).filter(Boolean))) as string[];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Catalog / Products"
        title="Products"
        description="Listings, pricing, sourcing and availability. Supplier quantity is not warehouse stock."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={startCreate}>
            <AddRegular aria-hidden="true" />
            Add product
          </button>
        }
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}

      <FilterBar
        count={`${visible.length} of ${products.length} products`}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU…" label="Search products by name or SKU" />
        <SelectFilter value={categoryFilter} onChange={setCategoryFilter} label="Filter by category">
          <option value="ALL">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </SelectFilter>
        <SelectFilter value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </SelectFilter>
        <SelectFilter value={availabilityFilter} onChange={setAvailabilityFilter} label="Filter by availability">
          <option value="ALL">Any availability</option>
          <option value="AVAILABLE">Available</option>
          <option value="CHECK_REQUIRED">Check required</option>
          <option value="UNAVAILABLE">Unavailable</option>
        </SelectFilter>
        <button
          type="button"
          className={`adm-toggle${missingCost ? ' is-on' : ''}`}
          aria-pressed={missingCost}
          onClick={() => setMissingCost((value) => !value)}
        >
          Missing supplier cost
        </button>
        <SelectFilter value={sort} onChange={setSort} label="Sort products">
          <option value="name">Name A–Z</option>
          <option value="price-desc">Price: high to low</option>
          <option value="price-asc">Price: low to high</option>
          <option value="margin">Margin: high to low</option>
        </SelectFilter>
      </FilterBar>

      {selected.size > 0 && (
        <div className="adm-bulkbar" role="status">
          <span>{selected.size} selected</span>
          <button
            type="button"
            className="adm-btn adm-btn--tiny adm-btn--danger-quiet"
            onClick={() => setArchiveTargets(products.filter((product) => selected.has(product.id)))}
          >
            Archive selected
          </button>
          <button type="button" className="adm-link" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <DataTable
        ariaLabel="Products"
        columns={columns}
        rows={pageRows}
        rowKey={(product) => product.id}
        loading={busy}
        onRowClick={startEdit}
        rowTitle={(product) => `Edit ${product.name}`}
        selectedIds={selected}
        onToggleRow={(product) => setSelected((current) => {
          const next = new Set(current);
          if (next.has(product.id)) next.delete(product.id);
          else next.add(product.id);
          return next;
        })}
        onToggleAll={() => setSelected((current) => current.size === pageRows.length
          ? new Set()
          : new Set(pageRows.map((product) => product.id)))}
        empty={
          <EmptyState
            title="No products match"
            body="Clear the filters or add a listing. Archived products are hidden from the customer catalog."
            actionLabel="Clear filters"
            onAction={() => {
              setSearch('');
              setCategoryFilter('ALL');
              setStatusFilter('ALL');
              setAvailabilityFilter('ALL');
              setMissingCost(false);
            }}
          />
        }
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />

      <Drawer
        open={drawerOpen}
        onClose={() => closeDrawer()}
        title={editing ? editing.name : 'Add product'}
        description={editing ? `/${editing.slug}` : 'Create a catalog listing. Nothing is published until you switch it on.'}
        size="wide"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => closeDrawer()} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
            </button>
          </>
        }
      >
        {formError && <div className="adm-inline-error" role="alert">{formError}</div>}

        <section className="adm-form-section">
          <h3>Basics</h3>
          <div className="adm-form-grid">
            <Field label="Product name" wide>
              <input value={form.name} onChange={(event) => setField('name', event.target.value)} />
            </Field>
            <Field label="Slug" hint="Used in the product URL.">
              <input value={form.slug} onChange={(event) => setField('slug', event.target.value)} />
            </Field>
            <Field label="SKU">
              <input value={form.sku} onChange={(event) => setField('sku', event.target.value)} />
            </Field>
            <Field label="Brand">
              <input value={form.brand} onChange={(event) => setField('brand', event.target.value)} />
            </Field>
            <Field label="Category">
              <select value={form.categoryId ?? ''} onChange={(event) => setField('categoryId', event.target.value || null)}>
                <option value="">Uncategorised</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Short description" wide>
              <input value={form.shortDescription} onChange={(event) => setField('shortDescription', event.target.value)} />
            </Field>
            <Field label="Description" wide>
              <textarea rows={5} value={form.description} onChange={(event) => setField('description', event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="adm-form-section">
          <h3>Pricing &amp; cost</h3>
          <div className="adm-form-grid">
            <Field label="Selling price (PKR)">
              <input type="number" min="0" value={form.sellingPrice || ''} onChange={(event) => setField('sellingPrice', Number(event.target.value))} />
            </Field>
            <Field label="Discount price (PKR)">
              <input type="number" min="0" value={form.discountPrice ?? ''} onChange={(event) => setField('discountPrice', event.target.value ? Number(event.target.value) : null)} />
            </Field>
            <Field label="Supplier cost (PKR)">
              <input type="number" min="0" value={form.supplierCost ?? ''} onChange={(event) => setField('supplierCost', event.target.value ? Number(event.target.value) : null)} />
            </Field>
            <Field label="Shipping estimate (PKR)">
              <input type="number" min="0" value={form.shippingCostEstimate ?? ''} onChange={(event) => setField('shippingCostEstimate', event.target.value ? Number(event.target.value) : null)} />
            </Field>
          </div>
          <div className={`adm-margin-preview${margin == null ? ' is-missing' : ''}`}>
            <span>Live margin</span>
            <strong className="adm-num">{margin == null ? 'Supplier cost missing' : money(margin)}</strong>
            {marginPercent != null && <span>{marginPercent}% of the customer price</span>}
          </div>
        </section>

        <section className="adm-form-section">
          <h3>Images</h3>
          <div
            className="adm-image-manager"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void upload(event.dataTransfer.files);
            }}
          >
            {images.map((image, index) => (
              <div
                key={`${image.url}-${index}`}
                className="adm-image-card"
                draggable
                onDragStart={() => { dragIndex.current = index; }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex.current != null && dragIndex.current !== index) {
                    moveImage(dragIndex.current, index);
                  }
                  dragIndex.current = null;
                }}
              >
                <div className="adm-image-thumb">
                  <img src={image.url} alt="" loading="lazy" />
                  {index === 0 && <span className="adm-image-primary">Primary</span>}
                </div>
                <input
                  className="adm-image-alt"
                  value={image.alt}
                  onChange={(event) => setImages((current) => current.map((row, position) =>
                    position === index ? { ...row, alt: event.target.value } : row))}
                  placeholder="Alt text"
                  aria-label={`Alt text for image ${index + 1}`}
                />
                <div className="adm-image-tools">
                  {index !== 0 && (
                    <button type="button" onClick={() => moveImage(index, 0)}>Set primary</button>
                  )}
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => setImages((current) => current.filter((_, position) => position !== index))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <label className="adm-image-drop">
              <ArrowUploadRegular aria-hidden="true" />
              <strong>{uploading ? 'Uploading…' : 'Drop or upload'}</strong>
              <span>JPG, PNG or WebP</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => void upload(event.target.files)}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="adm-image-url">
            <input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="https://… image URL"
              aria-label="Add image by URL"
            />
            <button type="button" className="adm-btn adm-btn--quiet" onClick={addUrl} disabled={!urlDraft.trim()}>
              Add by URL
            </button>
          </div>
          <p className="adm-hint">Drag images to reorder. The first image is used on cards and as the product's main photo.</p>
        </section>

        <section className="adm-form-section">
          <h3>Fitment</h3>
          {bikes.length === 0 ? (
            <p className="adm-hint">No bike models are recorded yet. Add them under Bike models first.</p>
          ) : (
            <div className="adm-fitment">
              {bikeBrands.map((brand) => (
                <div key={brand} className="adm-fitment-group">
                  <p>{brand}</p>
                  <div>
                    {bikes.filter((bike) => bike.brand === brand).map((bike) => (
                      <label key={bike.id} className="adm-check">
                        <input
                          type="checkbox"
                          checked={bikeIds.includes(bike.id)}
                          onChange={(event) => setBikeIds((current) =>
                            event.target.checked ? [...current, bike.id] : current.filter((id) => id !== bike.id))}
                        />
                        {bike.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="adm-form-section">
          <h3>Supplier &amp; availability</h3>
          <div className="adm-form-grid">
            <Field label="Supplier">
              <select value={form.supplierId ?? ''} onChange={(event) => setField('supplierId', event.target.value || null)}>
                <option value="">Unassigned</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </Field>
            <Field label="Availability">
              <select value={form.availabilityStatus} onChange={(event) => setField('availabilityStatus', event.target.value as AvailabilityStatus)}>
                <option value="AVAILABLE">Available</option>
                <option value="CHECK_REQUIRED">Check required</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </Field>
            <Field label="Supplier product URL">
              <input value={form.supplierProductUrl} onChange={(event) => setField('supplierProductUrl', event.target.value)} />
            </Field>
            <Field label="Supplier SKU">
              <input value={form.supplierSku} onChange={(event) => setField('supplierSku', event.target.value)} />
            </Field>
            <Field label="Supplier quantity estimate" hint="Supplier availability, not MotoGear PK inventory.">
              <input type="number" min="0" value={form.estimatedSupplierQuantity ?? ''} onChange={(event) => setField('estimatedSupplierQuantity', event.target.value ? Number(event.target.value) : null)} />
            </Field>
            <Field label="Published in shop">
              <span className="adm-switch-row">
                <input
                  type="checkbox"
                  className="adm-switch"
                  checked={form.published}
                  onChange={(event) => setField('published', event.target.checked)}
                  aria-label="Published in shop"
                />
                <span>{form.published ? 'Visible to customers' : 'Draft only'}</span>
              </span>
            </Field>
          </div>
        </section>

        <section className="adm-form-section">
          <h3>Warranty &amp; returns</h3>
          <div className="adm-form-grid">
            <Field label="Warranty" wide>
              <input value={form.warranty} onChange={(event) => setField('warranty', event.target.value)} />
            </Field>
            <Field label="Return eligibility" wide>
              <input value={form.returnEligibility} onChange={(event) => setField('returnEligibility', event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="adm-form-section">
          <h3>SEO</h3>
          <div className="adm-form-grid">
            <Field label="SEO title" wide>
              <input value={form.seoTitle ?? ''} onChange={(event) => setField('seoTitle', event.target.value)} />
            </Field>
            <Field label="SEO description" wide>
              <textarea rows={3} value={form.seoDescription ?? ''} onChange={(event) => setField('seoDescription', event.target.value)} />
            </Field>
          </div>
        </section>
      </Drawer>

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        body="This product has edits that have not been saved. Closing now will lose them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => closeDrawer(true)}
        onCancel={() => setDiscardOpen(false)}
      />

      <ConfirmDialog
        open={archiveTargets.length > 0}
        title={archiveTargets.length === 1 ? `Archive ${archiveTargets[0]?.name}?` : `Archive ${archiveTargets.length} products?`}
        body={
          <>
            <p>Archived products are hidden from the customer catalog and cannot be added to a cart.</p>
            <p>You can restore a product later as an unpublished draft. Nothing is deleted.</p>
          </>
        }
        confirmLabel={archiveTargets.length === 1 ? 'Archive product' : 'Archive products'}
        tone="danger"
        busy={archiving}
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiveTargets([])}
      />

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`adm-field${wide ? ' is-wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
