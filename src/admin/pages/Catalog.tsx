import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AddRegular,
  EditRegular,
  GridRegular,
  TagRegular,
  VehicleTruckBagRegular,
} from '@fluentui/react-icons';
import { api } from '../../api';
import {
  listAdminBikes,
  listAdminCategories,
  listAdminSuppliers,
  listSupplierProducts,
  saveAdminBike,
  saveAdminCategory,
  saveAdminSupplier,
  saveSupplierProduct,
  setSupplierAvailability,
  type AdminSupplierProduct,
  type DashboardBikeInput,
  type DashboardCategoryInput,
  type DashboardSupplierInput,
  type DashboardSupplierProductInput,
} from '../../api/admin';
import type { Product } from '../../api/types';
import {
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  ErrorBanner,
  FilterBar,
  PageHeader,
  SearchInput,
  StatusPill,
  ToastHost,
  failureText,
  money,
  nice,
  useToast,
  type Column,
} from '../components/ui';

type CategoryRow = Awaited<ReturnType<typeof listAdminCategories>>[number];
type BikeRow = Awaited<ReturnType<typeof listAdminBikes>>[number];
type SupplierRow = Awaited<ReturnType<typeof listAdminSuppliers>>[number];

const categoryImages: Record<string, string> = {
  'Lighting & Electrics': '/img/cat-lighting.jpg',
  'Riding Gear': '/img/cat-gear.jpg',
  'Performance Parts': '/img/cat-performance.jpg',
  'Bike Care & Accessories': '/img/cat-care.jpg',
};

const blankCategory: DashboardCategoryInput = {
  name: '', slug: '', description: '', active: true, seo_title: '', seo_description: '',
};
const blankBike: DashboardBikeInput = { name: '', slug: '', brand: '', engine_capacity: '', active: true };
const blankSupplier: DashboardSupplierInput = {
  name: '', website: '', url: '', country: '', contact_information: {}, rating: null,
  reliability_notes: '', shipping_information: '', api_status: 'MANUAL', active: true,
};
const blankSupplierProduct: DashboardSupplierProductInput = {
  supplier_id: '', product_id: '', supplier_product_url: '', supplier_sku: '',
  supplier_cost: null, moq: null, supplier_rating: null, product_quality_notes: '',
};

/* --- Categories ---------------------------------------------------------- */

export function CategoriesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DashboardCategoryInput>(blankCategory);
  const [editingId, setEditingId] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<CategoryRow | null>(null);
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      const [categoryRows, productRows] = await Promise.all([listAdminCategories(), api.listAdminProducts()]);
      setRows(categoryRows);
      setProducts(productRows);
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = rows.filter((row) => `${row.name} ${row.slug}`.toLowerCase().includes(search.toLowerCase()));
  const countFor = (id: string) => products.filter((product) => product.categoryId === id).length;

  const start = (row?: CategoryRow) => {
    setEditingId(row?.id);
    setForm(row ? {
      name: row.name, slug: row.slug, description: row.description ?? '',
      active: row.active, seo_title: row.seo_title ?? '', seo_description: row.seo_description ?? '',
    } : blankCategory);
    setFormError('');
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setFormError('Name and slug are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await saveAdminCategory(form, editingId);
      toast.success(editingId ? 'Category saved.' : 'Category added.');
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

  const toggle = async () => {
    if (!confirm) return;
    try {
      await saveAdminCategory({
        name: confirm.name, slug: confirm.slug, description: confirm.description ?? '',
        active: !confirm.active, seo_title: confirm.seo_title ?? '', seo_description: confirm.seo_description ?? '',
      }, confirm.id);
      toast.success(confirm.active ? 'Category disabled.' : 'Category enabled.');
      setConfirm(null);
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    }
  };

  const columns: Array<Column<CategoryRow>> = [
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className="adm-product-cell">
          <span className="adm-thumb">
            {categoryImages[row.name]
              ? <img src={categoryImages[row.name]} alt="" loading="lazy" />
              : <TagRegular aria-hidden="true" />}
          </span>
          <span className="adm-cell-stack"><strong>{row.name}</strong><small>/{row.slug}</small></span>
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => <span className="adm-clamp">{row.description || '—'}</span>,
    },
    {
      key: 'products',
      label: 'Products',
      align: 'right',
      render: (row) => <span className="adm-num">{countFor(row.id)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusPill status={row.active ? 'ACTIVE' : 'DISABLED'} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <span className="adm-row-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => start(row)}>
            <EditRegular aria-hidden="true" /> Edit
          </button>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => setConfirm(row)}>
            {row.active ? 'Disable' : 'Enable'}
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Catalog / Categories"
        title="Categories"
        description="The four storefront departments and how they appear in the shop."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => start()}>
            <AddRegular aria-hidden="true" /> Add category
          </button>
        }
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar count={`${visible.length} categories`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" label="Search categories" />
      </FilterBar>
      <DataTable
        ariaLabel="Categories"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={start}
        empty={<EmptyState icon={<TagRegular />} title="No categories" body="Add a category when you are ready. Ordering depends on real catalog structure, so nothing is seeded." actionLabel="Add category" onAction={() => start()} />}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit category' : 'Add category'}
        description="Slugs are used in shop URLs."
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save category' : 'Add category'}
            </button>
          </>
        }
      >
        {formError && <div className="adm-inline-error" role="alert">{formError}</div>}
        <div className="adm-form-grid">
          <Field label="Category name" wide>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Slug">
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
          </Field>
          <Field label="Description">
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="SEO title" wide>
            <input value={form.seo_title} onChange={(event) => setForm({ ...form, seo_title: event.target.value })} />
          </Field>
          <Field label="SEO description" wide>
            <textarea rows={3} value={form.seo_description} onChange={(event) => setForm({ ...form, seo_description: event.target.value })} />
          </Field>
          <label className="adm-check is-wide">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Enabled in the storefront
          </label>
        </div>
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.active ? `Disable ${confirm?.name}?` : `Enable ${confirm?.name}?`}
        body={confirm?.active
          ? 'The category stays in the database but is hidden from category navigation. Products keep their category.'
          : 'The category will appear in storefront navigation again.'}
        confirmLabel={confirm?.active ? 'Disable category' : 'Enable category'}
        tone={confirm?.active ? 'danger' : 'primary'}
        onConfirm={() => void toggle()}
        onCancel={() => setConfirm(null)}
      />
      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- Bike models --------------------------------------------------------- */

export function BikesPage() {
  const [rows, setRows] = useState<BikeRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [form, setForm] = useState<DashboardBikeInput>(blankBike);
  const [editingId, setEditingId] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      setRows(await listAdminBikes());
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const brands = Array.from(new Set(rows.map((row) => row.brand).filter(Boolean))) as string[];
  const visible = rows.filter((row) =>
    (brandFilter === 'ALL' || row.brand === brandFilter) &&
    `${row.name} ${row.brand ?? ''} ${row.engine_capacity ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const start = (row?: BikeRow) => {
    setEditingId(row?.id);
    setForm(row ? {
      name: row.name, slug: row.slug, brand: row.brand ?? '',
      engine_capacity: row.engine_capacity ?? '', active: row.active,
    } : blankBike);
    setFormError('');
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setFormError('Model name and slug are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await saveAdminBike(form, editingId);
      toast.success(editingId ? 'Bike model saved.' : 'Bike model added.');
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

  const columns: Array<Column<BikeRow>> = [
    {
      key: 'model',
      label: 'Model',
      render: (row) => (
        <span className="adm-product-cell">
          <span className="adm-thumb"><GridRegular aria-hidden="true" /></span>
          <span className="adm-cell-stack"><strong>{row.name}</strong><small>/{row.slug}</small></span>
        </span>
      ),
    },
    { key: 'brand', label: 'Make', render: (row) => row.brand || '—' },
    { key: 'engine', label: 'Engine', render: (row) => row.engine_capacity || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.active ? 'ACTIVE' : 'DISABLED'} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <span className="adm-row-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => start(row)}>
            <EditRegular aria-hidden="true" /> Edit
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Catalog / Bike models"
        title="Bike models"
        description="The compatibility list customers pick from. Only add models you actually support."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => start()}>
            <AddRegular aria-hidden="true" /> Add model
          </button>
        }
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar count={`${visible.length} models`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search model or make…" label="Search bike models" />
        <select className="adm-select" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} aria-label="Filter by make">
          <option value="ALL">All makes</option>
          {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </select>
      </FilterBar>
      <DataTable
        ariaLabel="Bike models"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={start}
        empty={<EmptyState icon={<GridRegular />} title="No bike models" body="Add the models your parts actually fit. Nothing is preloaded." actionLabel="Add model" onAction={() => start()} />}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit bike model' : 'Add bike model'}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save model' : 'Add model'}
            </button>
          </>
        }
      >
        {formError && <div className="adm-inline-error" role="alert">{formError}</div>}
        <div className="adm-form-grid">
          <Field label="Make">
            <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="Honda" />
          </Field>
          <Field label="Model">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="CD 70" />
          </Field>
          <Field label="Slug">
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
          </Field>
          <Field label="Engine capacity">
            <input value={form.engine_capacity} onChange={(event) => setForm({ ...form, engine_capacity: event.target.value })} placeholder="70cc" />
          </Field>
          <label className="adm-check is-wide">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Enabled in compatibility filters
          </label>
        </div>
      </Drawer>
      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

/* --- Suppliers ----------------------------------------------------------- */

export function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [links, setLinks] = useState<AdminSupplierProduct[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DashboardSupplierInput>(blankSupplier);
  const [contactText, setContactText] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState<DashboardSupplierProductInput>(blankSupplierProduct);
  const [linkSaving, setLinkSaving] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { status: 'AVAILABLE' | 'UNAVAILABLE' | 'CHECK_REQUIRED'; quantity: string }>>({});
  const toast = useToast();

  const load = async () => {
    setBusy(true);
    setLoadError('');
    try {
      const [supplierRows, productRows, linkRows] = await Promise.all([
        listAdminSuppliers(),
        api.listAdminProducts(),
        listSupplierProducts(),
      ]);
      setRows(supplierRows);
      setCatalog(productRows);
      setLinks(linkRows);
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
      toast.error(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visible = rows.filter((row) => `${row.name} ${row.country ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const start = (row?: SupplierRow) => {
    setEditingId(row?.id);
    setForm(row ? {
      name: row.name, website: row.website ?? '', url: row.url ?? '', country: row.country ?? '',
      contact_information: (row.contact_information ?? {}) as DashboardSupplierInput['contact_information'],
      rating: row.rating, reliability_notes: row.reliability_notes ?? '',
      shipping_information: row.shipping_information ?? '', api_status: row.api_status, active: row.active,
    } : blankSupplier);
    setContactText(row ? JSON.stringify(row.contact_information ?? {}, null, 2) : '');
    setFormError('');
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }
    let contact: Record<string, unknown> = {};
    try {
      contact = contactText.trim() ? JSON.parse(contactText) as Record<string, unknown> : {};
      if (!contact || typeof contact !== 'object' || Array.isArray(contact)) throw new Error('not an object');
    } catch {
      setFormError('Contact information must be a JSON object, or left empty.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await saveAdminSupplier({ ...form, contact_information: contact as DashboardSupplierInput['contact_information'] }, editingId);
      toast.success(editingId ? 'Supplier saved.' : 'Supplier added.');
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

  const saveLink = async () => {
    if (!linkForm.supplier_id || !linkForm.product_id) {
      setFormError('Choose a supplier and a product.');
      return;
    }
    setLinkSaving(true);
    try {
      await saveSupplierProduct(linkForm);
      toast.success('Supplier product link added.');
      setLinkOpen(false);
      setLinkForm(blankSupplierProduct);
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setLinkSaving(false);
    }
  };

  const recordCheck = async (row: AdminSupplierProduct) => {
    const value = availability[row.id] ?? {
      status: row.availability?.availability_status ?? 'CHECK_REQUIRED',
      quantity: row.availability?.estimated_quantity == null ? '' : String(row.availability.estimated_quantity),
    };
    try {
      await setSupplierAvailability(row.id, value.status, value.quantity === '' ? null : Number(value.quantity));
      toast.success('Availability check recorded.');
      await load();
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    }
  };

  const supplierColumns: Array<Column<SupplierRow>> = [
    {
      key: 'supplier',
      label: 'Supplier',
      render: (row) => (
        <span className="adm-product-cell">
          <span className="adm-thumb"><VehicleTruckBagRegular aria-hidden="true" /></span>
          <span className="adm-cell-stack">
            <strong>{row.name}</strong>
            <small>{row.website || row.url || 'No website recorded'}</small>
          </span>
        </span>
      ),
    },
    { key: 'country', label: 'Country', render: (row) => row.country || '—' },
    { key: 'rating', label: 'Rating', align: 'right', render: (row) => row.rating == null ? '—' : `${row.rating} / 5` },
    { key: 'api', label: 'Integration', render: (row) => row.api_status },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.active ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <span className="adm-row-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="adm-btn adm-btn--tiny" onClick={() => start(row)}>
            <EditRegular aria-hidden="true" /> Edit
          </button>
        </span>
      ),
    },
  ];

  const linkColumns: Array<Column<AdminSupplierProduct>> = [
    {
      key: 'product',
      label: 'Product',
      render: (row) => (
        <span className="adm-cell-stack"><strong>{row.product_name ?? 'Product removed'}</strong><small>{row.supplier_name ?? 'Supplier removed'} · {row.supplier_sku || 'No supplier SKU'}</small></span>
      ),
    },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => <span className="adm-num">{row.supplier_cost == null ? '—' : money(row.supplier_cost)}</span> },
    {
      key: 'checked',
      label: 'Last checked',
      render: (row) => row.availability?.checked_at ? new Date(row.availability.checked_at).toLocaleDateString('en-PK') : 'Never',
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (row) => {
        const value = availability[row.id] ?? {
          status: row.availability?.availability_status ?? 'CHECK_REQUIRED',
          quantity: row.availability?.estimated_quantity == null ? '' : String(row.availability.estimated_quantity),
        };
        return (
          <span className="adm-inline-edit" onClick={(event) => event.stopPropagation()}>
            <select
              className="adm-select"
              value={value.status}
              aria-label={`Availability for ${row.product_name ?? 'product'}`}
              onChange={(event) => setAvailability({ ...availability, [row.id]: { ...value, status: event.target.value as typeof value.status } })}
            >
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
              <option value="CHECK_REQUIRED">Check required</option>
            </select>
            <input
              className="adm-input is-tiny"
              type="number"
              min="0"
              placeholder="Qty"
              aria-label="Estimated supplier quantity"
              value={value.quantity}
              onChange={(event) => setAvailability({ ...availability, [row.id]: { ...value, quantity: event.target.value } })}
            />
            <button type="button" className="adm-btn adm-btn--tiny" onClick={() => void recordCheck(row)}>Record</button>
          </span>
        );
      },
    },
  ];

  return (
    <div className="adm-page">
      <PageHeader
        crumb="Catalog / Suppliers"
        title="Suppliers"
        description="Where stock is sourced. Availability is recorded by hand."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={busy}
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => start()}>
            <AddRegular aria-hidden="true" /> Add supplier
          </button>
        }
      />
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => void load()} />
      )}
      <FilterBar count={`${visible.length} suppliers`}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier or country…" label="Search suppliers" />
      </FilterBar>
      <DataTable
        ariaLabel="Suppliers"
        columns={supplierColumns}
        rows={visible}
        rowKey={(row) => row.id}
        loading={busy}
        onRowClick={start}
        empty={<EmptyState icon={<VehicleTruckBagRegular />} title="No suppliers" body="Supplier records stay empty until real business information is entered." actionLabel="Add supplier" onAction={() => start()} />}
      />

      <section className="adm-subsection">
        <div className="adm-subsection-head">
          <div>
            <h2>Sourcing links</h2>
            <p>Which supplier sells which product, and when it was last checked.</p>
          </div>
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setLinkOpen(true)}>
            <AddRegular aria-hidden="true" /> Add link
          </button>
        </div>
        <DataTable
          ariaLabel="Supplier product links"
          columns={linkColumns}
          rows={links}
          rowKey={(row) => row.id}
          loading={busy}
          empty={<EmptyState title="No sourcing links" body="Connect a product to a supplier to track its cost and availability." />}
        />
        <p className="adm-hint">Supplier quantity is an estimate from the supplier, not MotoGear PK warehouse stock.</p>
      </section>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit supplier' : 'Add supplier'}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save supplier' : 'Add supplier'}
            </button>
          </>
        }
      >
        {formError && <div className="adm-inline-error" role="alert">{formError}</div>}
        <div className="adm-form-grid">
          <Field label="Supplier name" wide>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Website"><input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></Field>
          <Field label="Supplier URL"><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} /></Field>
          <Field label="Country"><input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
          <Field label="Rating (0–5)">
            <input type="number" min="0" max="5" step="0.1" value={form.rating ?? ''} onChange={(event) => setForm({ ...form, rating: event.target.value ? Number(event.target.value) : null })} />
          </Field>
          <Field label="API status"><input value={form.api_status} onChange={(event) => setForm({ ...form, api_status: event.target.value })} /></Field>
          <Field label="Contact information (JSON)" wide hint="Only scalar values are stored.">
            <textarea rows={4} value={contactText} onChange={(event) => setContactText(event.target.value)} placeholder={'{ "email": "", "phone": "" }'} />
          </Field>
          <Field label="Shipping information" wide>
            <textarea rows={2} value={form.shipping_information} onChange={(event) => setForm({ ...form, shipping_information: event.target.value })} />
          </Field>
          <Field label="Reliability notes" wide>
            <textarea rows={2} value={form.reliability_notes} onChange={(event) => setForm({ ...form, reliability_notes: event.target.value })} />
          </Field>
          <label className="adm-check is-wide">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Active supplier
          </label>
        </div>
      </Drawer>

      <Drawer
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add sourcing link"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--quiet" onClick={() => setLinkOpen(false)} disabled={linkSaving}>Cancel</button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void saveLink()} disabled={linkSaving}>
              {linkSaving ? 'Saving…' : 'Add link'}
            </button>
          </>
        }
      >
        <div className="adm-form-grid">
          <Field label="Supplier" wide>
            <select value={linkForm.supplier_id} onChange={(event) => setLinkForm({ ...linkForm, supplier_id: event.target.value })}>
              <option value="">Select supplier</option>
              {rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </Field>
          <Field label="Product" wide>
            <select value={linkForm.product_id} onChange={(event) => setLinkForm({ ...linkForm, product_id: event.target.value })}>
              <option value="">Select product</option>
              {catalog.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </Field>
          <Field label="Supplier product URL" wide>
            <input value={linkForm.supplier_product_url} onChange={(event) => setLinkForm({ ...linkForm, supplier_product_url: event.target.value })} />
          </Field>
          <Field label="Supplier SKU"><input value={linkForm.supplier_sku} onChange={(event) => setLinkForm({ ...linkForm, supplier_sku: event.target.value })} /></Field>
          <Field label="Supplier cost (PKR)">
            <input type="number" min="0" value={linkForm.supplier_cost ?? ''} onChange={(event) => setLinkForm({ ...linkForm, supplier_cost: event.target.value ? Number(event.target.value) : null })} />
          </Field>
          <Field label="MOQ">
            <input type="number" min="0" value={linkForm.moq ?? ''} onChange={(event) => setLinkForm({ ...linkForm, moq: event.target.value ? Number(event.target.value) : null })} />
          </Field>
          <Field label="Quality notes" wide>
            <input value={linkForm.product_quality_notes} onChange={(event) => setLinkForm({ ...linkForm, product_quality_notes: event.target.value })} />
          </Field>
        </div>
      </Drawer>

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`adm-field${wide ? ' is-wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
