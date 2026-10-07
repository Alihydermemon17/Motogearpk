import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Badge, Body1, Button, Card, Checkbox, Caption1, Field, Input, MessageBar,
  MessageBarBody, Option, Select, Subtitle1, Textarea, Title1, Title3,
} from '@fluentui/react-components';
import {
  AddRegular, ArrowSyncRegular, CheckmarkRegular, ChevronRightRegular,
  DismissRegular, EditRegular, SaveRegular,
} from '@fluentui/react-icons';
import AdminProductsPage from './AdminProductsPage';
import { AdminFaqPage, AdminReturnsPage, AdminSupportPage } from './AdminTrustPages';
import { api } from '../api';
import {
  createApprovalRequest, decideApprovalRequest, getBusinessSettings,
  getDashboardMetrics, listAdminBikes, listAdminCategories, listAdminCustomers,
  listAdminFeedback, listAdminOrders, listAdminReviews, listAdminSuppliers,
  listApprovalRequests, listAutomationLogs, listSupplierProducts, saveAdminBike,
  saveAdminCategory, saveAdminSupplier, saveBusinessSettings, saveSupplierProduct,
  setReviewVisibility, setSupplierAvailability, updateAdminOrder, updateFeedback,
  type AdminCustomer, type AdminFeedback, type AdminOrderBundle, type AdminReview,
  type AdminSupplierProduct, type BusinessSettings, type DashboardBikeInput,
  type DashboardCategoryInput, type DashboardSupplierInput, type DashboardSupplierProductInput,
  type DashboardMetrics,
} from '../api/admin';
import type { AdminOrderStatus } from '../api/types';

type Navigate = (path: string) => void;
type RequestType = 'PRODUCT_PUBLICATION' | 'SUPPLIER_PURCHASE' | 'REFUND' | 'MAJOR_PRICE_CHANGE' | 'PRODUCT_REMOVAL' | 'OTHER';
type JsonValue = string | number | boolean | null | { [key: string]: JsonValue | undefined } | JsonValue[];
const money = (value: number) => `PKR ${value.toLocaleString('en-PK')}`;
const nice = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const failureText = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';

const adminLinks = [
  ['/admin', 'Overview'], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'],
  ['/admin/bikes', 'Bike models'], ['/admin/suppliers', 'Suppliers'], ['/admin/orders', 'Orders'],
  ['/admin/customers', 'Customers'], ['/admin/reviews', 'Reviews'], ['/admin/feedback', 'Feedback'],
  ['/admin/returns', 'Returns'], ['/admin/support', 'Support'], ['/admin/faqs', 'FAQs'],
  ['/admin/approvals', 'Approvals'], ['/admin/agents', 'AI command center'],
  ['/admin/automation-logs', 'Automation logs'], ['/admin/settings', 'Settings'],
] as const;

export default function AdminDashboard({ path, navigate }: { path: string; navigate: Navigate }) {
  const title = adminLinks.find(([href]) => href === path)?.[1] ?? 'Admin';
  return <div className="admin-shell page-content">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand"><Caption1>WORKSPACE</Caption1><Title3>MotoGear PK</Title3><Badge color="brand">ADMIN</Badge></div>
      <nav aria-label="Admin navigation" className="admin-nav">
        {adminLinks.map(([href, label]) => <Button key={href} appearance={href === path ? 'primary' : 'subtle'} className="admin-nav-link" onClick={() => navigate(href)}>{label}{href === path && <ChevronRightRegular />}</Button>)}
      </nav>
      <Button appearance="subtle" onClick={() => navigate('/')}>Return to storefront</Button>
    </aside>
    <section className="admin-workspace">
      <header className="admin-workspace-head"><div><Caption1 className="section-kicker">MOTOGEAR PK / OPERATIONS</Caption1><Title1>{title}</Title1></div><Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => window.location.reload()}>Reload</Button></header>
      {path === '/admin' && <DashboardPage navigate={navigate} />}
      {path === '/admin/products' && <AdminProductsPage />}
      {path === '/admin/categories' && <CategoriesPage />}
      {path === '/admin/bikes' && <BikesPage />}
      {path === '/admin/suppliers' && <SuppliersPage />}
      {path === '/admin/orders' && <OrdersPage />}
      {path === '/admin/customers' && <CustomersPage />}
      {path === '/admin/reviews' && <ReviewsPage />}
      {path === '/admin/feedback' && <FeedbackPage />}
      {path === '/admin/returns' && <AdminReturnsPage />}
      {path === '/admin/support' && <AdminSupportPage />}
      {path === '/admin/faqs' && <AdminFaqPage />}
      {path === '/admin/approvals' && <ApprovalsPage />}
      {path === '/admin/agents' && <AgentPlaceholder />}
      {path === '/admin/automation-logs' && <AutomationLogsPage />}
      {path === '/admin/settings' && <SettingsPage />}
      {!adminLinks.some(([href]) => href === path) && <EmptyPanel title="Admin page not found" detail="Choose a section from the operations menu." />}
    </section>
  </div>;
}

function DashboardPage({ navigate }: { navigate: Navigate }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try { setMetrics(await getDashboardMetrics()); }
    catch (reason: unknown) { setError(failureText(reason)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  if (busy) return <LoadingPanel />;
  if (error) return <ErrorPanel message={error} retry={() => void load()} />;
  if (!metrics) return <EmptyPanel title="Dashboard unavailable" detail="Metrics could not be loaded." />;
  const values: Array<[string, number | string, string, string]> = [
    ['Total orders', metrics.total_orders, 'All recorded orders', '/admin/orders'],
    ['Pending orders', metrics.pending_orders, 'Awaiting confirmation', '/admin/orders'],
    ['Confirmed orders', metrics.confirmed_orders, 'Accepted for processing', '/admin/orders'],
    ['Delivered orders', metrics.delivered_orders, 'Completed delivery', '/admin/orders'],
    ['Cancelled orders', metrics.cancelled_orders, 'Cancelled records', '/admin/orders'],
    ['Revenue', money(metrics.revenue), 'Paid orders only', '/admin/orders'],
    ['Estimated profit', money(metrics.estimated_profit), 'One unit per active listing', '/admin/products'],
    ['Published products', metrics.published_products, 'Visible catalog listings', '/admin/products'],
    ['Unavailable products', metrics.unavailable_products, 'Availability marked unavailable', '/admin/products'],
    ['Customers', metrics.total_customers, 'Registered profiles', '/admin/customers'],
    ['Reviews', metrics.total_reviews, 'Submitted review records', '/admin/reviews'],
    ['Pending approvals', metrics.pending_approvals, 'Waiting for admin decision', '/admin/approvals'],
  ];
  const noData = Object.values(metrics).every((value) => value === 0);
  return <div className="admin-page-content">
    {noData && <MessageBar intent="info"><MessageBarBody>No business records yet. Metrics below reflect the current empty database.</MessageBarBody></MessageBar>}
    <div className="admin-metric-grid">{values.map(([label, value, detail, href]) => <button type="button" className="admin-metric" key={label} onClick={() => navigate(href)}><Caption1>{label}</Caption1><strong>{value}</strong><span>{detail}</span></button>)}</div>
    <div className="admin-quick-links">{[['Products', '/admin/products'], ['Orders', '/admin/orders'], ['Suppliers', '/admin/suppliers'], ['Approvals', '/admin/approvals']].map(([label, href]) => <Button key={href} appearance="secondary" onClick={() => navigate(href)}>{label}</Button>)}</div>
  </div>;
}

function CategoriesPage() {
  const blank: DashboardCategoryInput = { name: '', slug: '', description: '', active: true, seo_title: '', seo_description: '' };
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdminCategories>>>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setRows(await listAdminCategories()); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); setNotice(''); try { await saveAdminCategory(form, editingId); setNotice(editingId ? 'Category updated.' : 'Category added.'); setForm(blank); setEditingId(undefined); await load(); } catch (reason: unknown) { setError(failureText(reason)); } finally { setSaving(false); } };
  const edit = (row: typeof rows[number]) => { setEditingId(row.id); setForm({ name: row.name, slug: row.slug, description: row.description ?? '', active: row.active, seo_title: row.seo_title ?? '', seo_description: row.seo_description ?? '' }); };
  const toggle = async (row: typeof rows[number]) => { try { await saveAdminCategory({ name: row.name, slug: row.slug, description: row.description ?? '', active: !row.active, seo_title: row.seo_title ?? '', seo_description: row.seo_description ?? '' }, row.id); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  return <div className="admin-page-content"><PageNotice error={error} success={notice} /><Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void save(event)}>
    <Field label="Category name" required><Input value={form.name} onChange={(_, value) => setForm({ ...form, name: value.value })} required /></Field>
    <Field label="Slug" required><Input value={form.slug} onChange={(_, value) => setForm({ ...form, slug: value.value })} required /></Field>
    <Field label="Description"><Input value={form.description} onChange={(_, value) => setForm({ ...form, description: value.value })} /></Field>
    <Field label="SEO title"><Input value={form.seo_title} onChange={(_, value) => setForm({ ...form, seo_title: value.value })} /></Field>
    <Field label="SEO description" className="admin-wide"><Textarea value={form.seo_description} onChange={(_, value) => setForm({ ...form, seo_description: value.value })} /></Field>
    <Checkbox label="Enabled in storefront" checked={form.active} onChange={(_, value) => setForm({ ...form, active: Boolean(value.checked) })} />
    <div className="admin-inline-actions"><Button type="submit" appearance="primary" icon={<SaveRegular />} disabled={saving}>{editingId ? 'Save category' : 'Add category'}</Button>{editingId && <Button appearance="subtle" onClick={() => { setForm(blank); setEditingId(undefined); }}>Cancel</Button>}</div>
  </form></Card>
    <SectionTitle title="Categories" count={busy ? undefined : rows.length} />
    {busy ? <LoadingPanel /> : rows.length ? <div className="admin-record-list">{rows.map((row) => <Card className="admin-record" key={row.id}><div className="admin-record-main"><Subtitle1>{row.name}</Subtitle1><Caption1>/{row.slug} · {row.active ? 'Enabled' : 'Disabled'}</Caption1></div><div className="admin-record-actions"><Button appearance="subtle" icon={<EditRegular />} onClick={() => edit(row)}>Edit</Button><Button appearance="subtle" onClick={() => void toggle(row)}>{row.active ? 'Disable' : 'Enable'}</Button></div></Card>)}</div> : <EmptyPanel title="No categories" detail="Add the first category when you are ready. No category records were preloaded." />}
  </div>;
}

function BikesPage() {
  const blank: DashboardBikeInput = { name: '', slug: '', brand: '', engine_capacity: '', active: true };
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdminBikes>>>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setRows(await listAdminBikes()); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const save = async (event: FormEvent) => { event.preventDefault(); setError(''); setNotice(''); try { await saveAdminBike(form, editingId); setNotice(editingId ? 'Bike model updated.' : 'Bike model added.'); setForm(blank); setEditingId(undefined); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  const edit = (row: typeof rows[number]) => { setEditingId(row.id); setForm({ name: row.name, slug: row.slug, brand: row.brand ?? '', engine_capacity: row.engine_capacity ?? '', active: row.active }); };
  const toggle = async (row: typeof rows[number]) => { try { await saveAdminBike({ name: row.name, slug: row.slug, brand: row.brand ?? '', engine_capacity: row.engine_capacity ?? '', active: !row.active }, row.id); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  return <div className="admin-page-content"><PageNotice error={error} success={notice} /><Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void save(event)}>
    <Field label="Model name" required><Input value={form.name} onChange={(_, value) => setForm({ ...form, name: value.value })} required /></Field>
    <Field label="Slug" required><Input value={form.slug} onChange={(_, value) => setForm({ ...form, slug: value.value })} required /></Field>
    <Field label="Brand"><Input value={form.brand} onChange={(_, value) => setForm({ ...form, brand: value.value })} /></Field>
    <Field label="Engine capacity"><Input value={form.engine_capacity} onChange={(_, value) => setForm({ ...form, engine_capacity: value.value })} /></Field>
    <Checkbox label="Enabled in compatibility filters" checked={form.active} onChange={(_, value) => setForm({ ...form, active: Boolean(value.checked) })} />
    <div className="admin-inline-actions"><Button type="submit" appearance="primary" icon={<SaveRegular />}>{editingId ? 'Save model' : 'Add model'}</Button>{editingId && <Button appearance="subtle" onClick={() => { setForm(blank); setEditingId(undefined); }}>Cancel</Button>}</div>
  </form></Card>
    <SectionTitle title="Bike models" count={busy ? undefined : rows.length} />
    {busy ? <LoadingPanel /> : rows.length ? <div className="admin-record-list">{rows.map((row) => <Card className="admin-record" key={row.id}><div className="admin-record-main"><Subtitle1>{row.name}</Subtitle1><Caption1>{[row.brand, row.engine_capacity, `/${row.slug}`, row.active ? 'Enabled' : 'Disabled'].filter(Boolean).join(' · ')}</Caption1></div><div className="admin-record-actions"><Button appearance="subtle" icon={<EditRegular />} onClick={() => edit(row)}>Edit</Button><Button appearance="subtle" onClick={() => void toggle(row)}>{row.active ? 'Disable' : 'Enable'}</Button></div></Card>)}</div> : <EmptyPanel title="No bike models" detail="Create actual supported models here; no sample models were inserted." />}
  </div>;
}

function SuppliersPage() {
  const blank: DashboardSupplierInput = { name: '', website: '', url: '', country: '', contact_information: {}, rating: null, reliability_notes: '', shipping_information: '', api_status: 'MANUAL', active: true };
  const productBlank: DashboardSupplierProductInput = { supplier_id: '', product_id: '', supplier_product_url: '', supplier_sku: '', supplier_cost: null, moq: null, supplier_rating: null, product_quality_notes: '' };
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAdminSuppliers>>>([]);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof api.listAdminProducts>>>([]);
  const [supplierProducts, setSupplierProducts] = useState<AdminSupplierProduct[]>([]);
  const [form, setForm] = useState(blank);
  const [productForm, setProductForm] = useState(productBlank);
  const [contactText, setContactText] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [availability, setAvailability] = useState<Record<string, { status: 'AVAILABLE' | 'UNAVAILABLE' | 'CHECK_REQUIRED'; quantity: string }>>({});
  const load = async () => { setBusy(true); setError(''); try { const [supplierRows, products, associations] = await Promise.all([listAdminSuppliers(), api.listAdminProducts(), listSupplierProducts()]); setRows(supplierRows); setCatalog(products); setSupplierProducts(associations); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const save = async (event: FormEvent) => { event.preventDefault(); setError(''); setNotice(''); try { const parsed: unknown = contactText.trim() ? JSON.parse(contactText) : {}; if (!isJsonObject(parsed)) throw new Error('Contact information must be a JSON object with scalar values.'); await saveAdminSupplier({ ...form, contact_information: parsed }, editingId); setForm(blank); setContactText(''); setEditingId(undefined); setNotice(editingId ? 'Supplier updated.' : 'Supplier added.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  const edit = (row: typeof rows[number]) => { setEditingId(row.id); setForm({ name: row.name, website: row.website ?? '', url: row.url ?? '', country: row.country ?? '', contact_information: row.contact_information as Record<string, JsonValue>, rating: row.rating, reliability_notes: row.reliability_notes ?? '', shipping_information: row.shipping_information ?? '', api_status: row.api_status, active: row.active }); setContactText(JSON.stringify(row.contact_information, null, 2)); };
  const saveProduct = async (event: FormEvent) => { event.preventDefault(); setError(''); setNotice(''); try { await saveSupplierProduct(productForm); setProductForm(productBlank); setNotice('Supplier product link added.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  const saveAvailability = async (row: AdminSupplierProduct) => { const value = availability[row.id] ?? { status: row.availability?.availability_status ?? 'CHECK_REQUIRED', quantity: row.availability?.estimated_quantity == null ? '' : String(row.availability.estimated_quantity) }; try { await setSupplierAvailability(row.id, value.status, value.quantity === '' ? null : Number(value.quantity)); setNotice('Availability check recorded.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  return <div className="admin-page-content"><PageNotice error={error} success={notice} />
    <Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void save(event)}>
      <Field label="Supplier name" required><Input value={form.name} onChange={(_, value) => setForm({ ...form, name: value.value })} required /></Field>
      <Field label="Website"><Input value={form.website} onChange={(_, value) => setForm({ ...form, website: value.value })} /></Field>
      <Field label="Supplier URL"><Input value={form.url} onChange={(_, value) => setForm({ ...form, url: value.value })} /></Field>
      <Field label="Country"><Input value={form.country} onChange={(_, value) => setForm({ ...form, country: value.value })} /></Field>
      <Field label="Rating (0-5)"><Input type="number" min="0" max="5" step="0.1" value={form.rating == null ? '' : String(form.rating)} onChange={(_, value) => setForm({ ...form, rating: value.value ? Number(value.value) : null })} /></Field>
      <Field label="API status"><Input value={form.api_status} onChange={(_, value) => setForm({ ...form, api_status: value.value })} /></Field>
      <Field label="Contact information JSON"><Textarea value={contactText} onChange={(_, value) => setContactText(value.value)} placeholder="{ &quot;email&quot;: &quot;&quot;, &quot;phone&quot;: &quot;&quot; }" /></Field>
      <Field label="Shipping information"><Textarea value={form.shipping_information} onChange={(_, value) => setForm({ ...form, shipping_information: value.value })} /></Field>
      <Field label="Reliability notes" className="admin-wide"><Textarea value={form.reliability_notes} onChange={(_, value) => setForm({ ...form, reliability_notes: value.value })} /></Field>
      <Checkbox label="Active supplier" checked={form.active} onChange={(_, value) => setForm({ ...form, active: Boolean(value.checked) })} />
      <div className="admin-inline-actions"><Button type="submit" appearance="primary" icon={<SaveRegular />}>{editingId ? 'Save supplier' : 'Add supplier'}</Button>{editingId && <Button appearance="subtle" onClick={() => { setForm(blank); setEditingId(undefined); setContactText(''); }}>Cancel</Button>}</div>
    </form></Card>
    <SectionTitle title="Suppliers" count={busy ? undefined : rows.length} />
    {busy ? <LoadingPanel /> : rows.length ? <div className="admin-record-list">{rows.map((row) => <Card className="admin-record" key={row.id}><div className="admin-record-main"><Subtitle1>{row.name}</Subtitle1><Caption1>{row.country || 'Country not set'} · {row.api_status} · {row.active ? 'Active' : 'Inactive'}</Caption1><Caption1>{row.website || row.url || 'No website recorded'}</Caption1></div><div className="admin-record-actions"><Button appearance="subtle" icon={<EditRegular />} onClick={() => edit(row)}>Edit</Button><Button appearance="subtle" onClick={() => void saveAdminSupplier({ name: row.name, website: row.website ?? '', url: row.url ?? '', country: row.country ?? '', contact_information: row.contact_information as Record<string, JsonValue>, rating: row.rating, reliability_notes: row.reliability_notes ?? '', shipping_information: row.shipping_information ?? '', api_status: row.api_status, active: !row.active }, row.id).then(() => load()).catch((reason: unknown) => setError(failureText(reason)))}>{row.active ? 'Deactivate' : 'Activate'}</Button></div></Card>)}</div> : <EmptyPanel title="No suppliers" detail="Supplier records remain empty until you enter real business information." />}
    <SectionTitle title="Supplier product records" count={busy ? undefined : supplierProducts.length} />
    <Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void saveProduct(event)}>
      <Field label="Supplier" required><Select value={productForm.supplier_id} onChange={(_, value) => setProductForm({ ...productForm, supplier_id: value.value })} required><Option value="">Select supplier</Option>{rows.map((row) => <Option key={row.id} value={row.id}>{row.name}</Option>)}</Select></Field>
      <Field label="Product" required><Select value={productForm.product_id} onChange={(_, value) => setProductForm({ ...productForm, product_id: value.value })} required><Option value="">Select product</Option>{catalog.map((row) => <Option key={row.id} value={row.id}>{row.name}</Option>)}</Select></Field>
      <Field label="Supplier product URL"><Input value={productForm.supplier_product_url} onChange={(_, value) => setProductForm({ ...productForm, supplier_product_url: value.value })} /></Field>
      <Field label="Supplier SKU"><Input value={productForm.supplier_sku} onChange={(_, value) => setProductForm({ ...productForm, supplier_sku: value.value })} /></Field>
      <Field label="Supplier cost (PKR)"><Input type="number" min="0" value={productForm.supplier_cost == null ? '' : String(productForm.supplier_cost)} onChange={(_, value) => setProductForm({ ...productForm, supplier_cost: value.value ? Number(value.value) : null })} /></Field>
      <Field label="MOQ"><Input type="number" min="0" value={productForm.moq == null ? '' : String(productForm.moq)} onChange={(_, value) => setProductForm({ ...productForm, moq: value.value ? Number(value.value) : null })} /></Field>
      <Field label="Supplier rating"><Input type="number" min="0" max="5" step="0.1" value={productForm.supplier_rating == null ? '' : String(productForm.supplier_rating)} onChange={(_, value) => setProductForm({ ...productForm, supplier_rating: value.value ? Number(value.value) : null })} /></Field>
      <Field label="Quality notes"><Input value={productForm.product_quality_notes} onChange={(_, value) => setProductForm({ ...productForm, product_quality_notes: value.value })} /></Field>
      <Button type="submit" appearance="primary" icon={<AddRegular />}>Add supplier product</Button>
    </form></Card>
    {!busy && supplierProducts.length > 0 && <div className="admin-record-list">{supplierProducts.map((row) => {
      const value = availability[row.id] ?? { status: row.availability?.availability_status ?? 'CHECK_REQUIRED', quantity: row.availability?.estimated_quantity == null ? '' : String(row.availability.estimated_quantity) };
      return <Card className="admin-record supplier-product-record" key={row.id}><div className="admin-record-main"><Subtitle1>{row.product_name ?? 'Product removed'}</Subtitle1><Caption1>{row.supplier_name} · {row.supplier_sku || 'No supplier SKU'} · {row.supplier_cost == null ? 'Cost not set' : money(row.supplier_cost)}</Caption1><Caption1>Last checked: {row.availability?.checked_at ? new Date(row.availability.checked_at).toLocaleString() : 'Never checked'}</Caption1></div><div className="supplier-availability-edit"><Select value={value.status} onChange={(_, result) => setAvailability({ ...availability, [row.id]: { ...value, status: result.value as typeof value.status } })}><Option value="AVAILABLE">Available</Option><Option value="UNAVAILABLE">Unavailable</Option><Option value="CHECK_REQUIRED">Check required</Option></Select><Input aria-label="Estimated supplier quantity" type="number" min="0" placeholder="Qty estimate" value={value.quantity} onChange={(_, result) => setAvailability({ ...availability, [row.id]: { ...value, quantity: result.value } })} /><Button appearance="secondary" onClick={() => void saveAvailability(row)}>Record check</Button></div></Card>;
    })}</div>}
    <Caption1 className="admin-muted">Supplier integrations are not connected. Availability is recorded manually.</Caption1>
  </div>;
}

function OrdersPage() {
  const [rows, setRows] = useState<AdminOrderBundle[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setRows(await listAdminOrders()); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const visible = rows.filter((row) => (filter === 'ALL' || row.status === filter) && (!search || `${row.order_number} ${row.shipping_full_name} ${row.shipping_phone}`.toLowerCase().includes(search.toLowerCase())));
  const selected = rows.find((row) => row.id === selectedId);
  return <div className="admin-page-content"><PageNotice error={error} success={notice} /><div className="admin-filter-row"><Field label="Search orders"><Input value={search} onChange={(_, value) => setSearch(value.value)} placeholder="Order number, customer, phone" /></Field><Field label="Status"><Select value={filter} onChange={(_, value) => setFilter(value.value)}><Option value="ALL">All statuses</Option>{orderStatuses.map((status) => <Option key={status} value={status}>{nice(status)}</Option>)}</Select></Field><Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => void load()}>Refresh</Button></div>
    {busy ? <LoadingPanel /> : visible.length ? <div className="admin-order-layout"><div className="admin-record-list">{visible.map((row) => <button className={`admin-order-select ${selectedId === row.id ? 'selected' : ''}`} key={row.id} onClick={() => setSelectedId(row.id)}><span><strong>{row.order_number}</strong><Caption1>{row.shipping_full_name} · {new Date(row.created_at).toLocaleDateString()}</Caption1></span><span><Badge>{nice(row.status)}</Badge><b>{money(row.total)}</b></span></button>)}</div>{selected ? <OrderDetail order={selected} saving={saving} onSave={async (next, tracking, courier, notes) => { setSaving(true); setError(''); setNotice(''); try { await updateAdminOrder(selected.id, next, tracking, courier, notes); setNotice('Order status and shipping information saved.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } finally { setSaving(false); } }} /> : <EmptyPanel title="Select an order" detail="Order details will appear here." />}</div> : <EmptyPanel title="No orders" detail="No real orders have been placed yet." />}
  </div>;
}

function OrderDetail({ order, saving, onSave }: { order: AdminOrderBundle; saving: boolean; onSave: (status: AdminOrderStatus, tracking: string, courier: string, notes: string) => Promise<void> }) {
  const [status, setStatus] = useState<AdminOrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [courier, setCourier] = useState(order.courier ?? '');
  const [notes, setNotes] = useState(order.internal_notes ?? '');
  useEffect(() => { setStatus(order.status); setTracking(order.tracking_number ?? ''); setCourier(order.courier ?? ''); setNotes(order.internal_notes ?? ''); }, [order]);
  const allowed = orderTransitions(order.status, order.payment_status);
  return <Card className="admin-order-detail"><div className="admin-order-detail-head"><div><Caption1>{order.order_number}</Caption1><Title3>{money(order.total)}</Title3></div><Badge>{nice(order.payment_status)}</Badge></div>
    <div className="admin-detail-grid"><div><Caption1>Customer</Caption1><strong>{order.customer?.full_name || order.shipping_full_name}</strong><span>{order.customer?.email || order.shipping_email}</span><span>{order.customer?.phone || order.shipping_phone}</span></div><div><Caption1>Ship to</Caption1><strong>{order.shipping_address}</strong><span>{order.shipping_city}, {order.shipping_province}</span></div></div>
    <SectionTitle title="Items and supplier" />
    {order.items.length ? order.items.map((item) => <div className="admin-line-item" key={item.id}><div><strong>{item.product_name}</strong><Caption1>{item.product_sku} · Qty {item.quantity} · {item.supplier_name ?? 'Supplier unassigned'}</Caption1></div><b>{money(item.line_total)}</b></div>) : <Caption1>No order items recorded.</Caption1>}
    <div className="admin-detail-grid"><div><Caption1>Subtotal / delivery</Caption1><strong>{money(order.subtotal)} / {money(order.delivery_fee)}</strong></div><div><Caption1>Payment</Caption1><strong>{nice(order.payment_method)} · {nice(order.payment_status)}</strong></div></div>
    <div className="admin-form-grid"><Field label="Order status"><Select value={status} onChange={(_, value) => setStatus(value.value as AdminOrderStatus)}>{allowed.map((item) => <Option key={item} value={item}>{nice(item)}</Option>)}</Select></Field><Field label="Courier"><Input value={courier} onChange={(_, value) => setCourier(value.value)} /></Field><Field label="Tracking number"><Input value={tracking} onChange={(_, value) => setTracking(value.value)} /></Field><Field label="Internal notes" className="admin-wide"><Textarea value={notes} onChange={(_, value) => setNotes(value.value)} /></Field></div>
    <Button appearance="primary" icon={<SaveRegular />} disabled={saving} onClick={() => void onSave(status, tracking, courier, notes)}>{saving ? 'Saving…' : 'Save allowed order updates'}</Button>
    <Caption1 className="admin-muted">Order totals and payment status are read-only. Status changes are checked by the database.</Caption1>
  </Card>;
}

function CustomersPage() {
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void listAdminCustomers().then(setRows).catch((reason: unknown) => setError(failureText(reason))).finally(() => setBusy(false)); }, []);
  const visible = rows.filter((row) => `${row.full_name} ${row.email} ${row.phone} ${row.city} ${row.province}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="admin-page-content"><PageNotice error={error} /><Field label="Search customers"><Input value={search} onChange={(_, value) => setSearch(value.value)} placeholder="Name, email, phone, location" /></Field>{busy ? <LoadingPanel /> : visible.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th>Orders</th><th>Order value</th><th>Joined</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.full_name || 'Name not provided'}</strong><small>{row.email}</small></td><td>{row.phone || '—'}</td><td>{[row.city, row.province].filter(Boolean).join(', ') || '—'}</td><td>{row.order_count}</td><td>{money(row.order_value)}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <EmptyPanel title="No customers" detail="Customer profiles will appear after real accounts are created." />}</div>;
}

function ReviewsPage() {
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setRows(await listAdminReviews()); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const toggle = async (row: AdminReview) => { setError(''); try { await setReviewVisibility(row.id, !row.is_visible); setNotice(row.is_visible ? 'Review hidden.' : 'Review published.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  return <div className="admin-page-content"><PageNotice error={error} success={notice} />{busy ? <LoadingPanel /> : rows.length ? <div className="admin-record-list">{rows.map((row) => <Card className="admin-record admin-multiline" key={row.id}><div className="admin-record-main"><Subtitle1>{row.title || `${row.rating} / 5`}</Subtitle1><Caption1>{row.product_name ?? 'Product unavailable'} · {row.customer_name ?? 'Customer account removed'} · {nice(row.rating.toString())} / 5</Caption1><Caption1>Order: {row.order_number ? `${row.order_number} · ${nice(row.order_status ?? '')}` : 'No linked order'}</Caption1><Body1>{row.body}</Body1><Caption1>{row.verified_purchase ? 'Verified purchase' : 'Not marked verified'} · {new Date(row.created_at).toLocaleString()}</Caption1></div><div className="admin-record-actions"><Badge color={row.is_visible ? 'success' : 'informative'}>{row.is_visible ? 'Visible' : 'Hidden'}</Badge><Button appearance="subtle" onClick={() => void toggle(row)}>{row.is_visible ? 'Hide review' : 'Make visible'}</Button></div></Card>)}</div> : <EmptyPanel title="No reviews" detail="There are no submitted reviews or ratings to moderate." />}</div>;
}

function FeedbackPage() {
  const [rows, setRows] = useState<AdminFeedback[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edits, setEdits] = useState<Record<string, { status: AdminFeedback['status']; notes: string }>>({});
  const load = async () => { setBusy(true); setError(''); try { const feedback = await listAdminFeedback(); setRows(feedback); setEdits(Object.fromEntries(feedback.map((row) => [row.id, { status: row.status, notes: row.internal_notes ?? '' }]))); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const save = async (row: AdminFeedback) => { const edit = edits[row.id]; if (!edit) return; try { await updateFeedback(row.id, edit.status, edit.notes); setNotice('Feedback status saved.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  return <div className="admin-page-content"><PageNotice error={error} success={notice} />{busy ? <LoadingPanel /> : rows.length ? <div className="admin-record-list">{rows.map((row) => { const edit = edits[row.id] ?? { status: row.status, notes: row.internal_notes ?? '' }; return <Card className="admin-record admin-multiline" key={row.id}><div className="admin-record-main"><Subtitle1>{row.customer_name ?? 'Customer account removed'} · {row.category}</Subtitle1><Body1>{row.message}</Body1><Caption1>{new Date(row.created_at).toLocaleString()} · Product {row.product_id ?? '—'} · Order {row.order_id ?? '—'}</Caption1><Textarea aria-label="Internal notes" placeholder="Internal notes" value={edit.notes} onChange={(_, value) => setEdits({ ...edits, [row.id]: { ...edit, notes: value.value } })} /></div><div className="admin-record-actions"><Select value={edit.status} onChange={(_, value) => setEdits({ ...edits, [row.id]: { ...edit, status: value.value as AdminFeedback['status'] } })}><Option value="OPEN">Open</Option><Option value="IN_REVIEW">In review</Option><Option value="RESOLVED">Resolved</Option><Option value="CLOSED">Closed</Option></Select><Button appearance="secondary" onClick={() => void save(row)}>Save</Button></div></Card>; })}</div> : <EmptyPanel title="No feedback" detail="Customer feedback will appear here when submitted." />}</div>;
}

function ApprovalsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listApprovalRequests>>>([]);
  const [type, setType] = useState<RequestType>('OTHER');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setRows(await listApprovalRequests()); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await createApprovalRequest({ request_type: type, subject, details, metadata: {} }); setSubject(''); setDetails(''); setNotice('Approval request created. No automated action was triggered.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => { try { await decideApprovalRequest(id, status, ''); setNotice(`Request ${status.toLowerCase()}. No supplier or payment action was triggered.`); await load(); } catch (reason: unknown) { setError(failureText(reason)); } };
  return <div className="admin-page-content"><PageNotice error={error} success={notice} /><Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void submit(event)}><Field label="Approval type"><Select value={type} onChange={(_, value) => setType(value.value as RequestType)}>{['PRODUCT_PUBLICATION','SUPPLIER_PURCHASE','REFUND','MAJOR_PRICE_CHANGE','PRODUCT_REMOVAL','OTHER'].map((item) => <Option key={item} value={item}>{nice(item)}</Option>)}</Select></Field><Field label="Subject" required><Input value={subject} onChange={(_, value) => setSubject(value.value)} required /></Field><Field label="Details" className="admin-wide"><Textarea value={details} onChange={(_, value) => setDetails(value.value)} /></Field><Button type="submit" appearance="primary" icon={<AddRegular />}>Create approval request</Button></form></Card>
    <SectionTitle title="Requests" count={busy ? undefined : rows.length} />{busy ? <LoadingPanel /> : rows.length ? <div className="admin-record-list">{rows.map((row) => <Card className="admin-record admin-multiline" key={row.id}><div className="admin-record-main"><Subtitle1>{row.subject}</Subtitle1><Caption1>{nice(row.request_type)} · {new Date(row.created_at).toLocaleString()}</Caption1><Body1>{row.details || 'No additional details.'}</Body1><Badge>{row.status}</Badge></div>{row.status === 'PENDING' && <div className="admin-record-actions"><Button appearance="primary" onClick={() => void decide(row.id, 'APPROVED')}>Approve</Button><Button appearance="subtle" onClick={() => void decide(row.id, 'REJECTED')}>Reject</Button></div>}</Card>)}</div> : <EmptyPanel title="No approvals" detail="Approval requests will be recorded here. No business actions run automatically." />}
  </div>;
}

function AgentPlaceholder() {
  const agents = ['Master Agent', 'Agent 1 — Market Intelligence', 'Agent 2 — Product Validation', 'Agent 3 — Commerce Operations', 'Agent 4 — Customer Intelligence'];
  return <div className="admin-page-content"><MessageBar intent="info"><MessageBarBody>Not connected yet. This page is a placeholder only; no AI APIs, agents, or automation are running.</MessageBarBody></MessageBar><div className="admin-agent-grid">{agents.map((agent) => <Card className="admin-agent-placeholder" key={agent}><Caption1>NOT CONNECTED YET</Caption1><Subtitle1>{agent}</Subtitle1><Body1>No activity is available.</Body1></Card>)}</div></div>;
}

function AutomationLogsPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAutomationLogs>>>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void listAutomationLogs().then(setRows).catch((reason: unknown) => setError(failureText(reason))).finally(() => setBusy(false)); }, []);
  return <div className="admin-page-content"><PageNotice error={error} />{busy ? <LoadingPanel /> : rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Agent</th><th>Task</th><th>Action</th><th>Status</th><th>Created</th><th>Approval</th><th>Error</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.agent}</td><td>{row.task}</td><td>{row.action}</td><td>{nice(row.status)}</td><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.approval_status ? nice(row.approval_status) : '—'}</td><td>{row.error || '—'}</td></tr>)}</tbody></table></div> : <EmptyPanel title="No automation logs" detail="Automation is not connected. No background tasks are running." />}</div>;
}

function SettingsPage() {
  const blank: BusinessSettings = { business_name: '', currency: '', delivery_fee: '', support_phone: '', support_email: '', whatsapp_number: '', return_policy_summary: '', default_warranty_text: '' };
  const [settings, setSettings] = useState(blank);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setBusy(true); setError(''); try { setSettings({ ...blank, ...await getBusinessSettings() }); } catch (reason: unknown) { setError(failureText(reason)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); setNotice(''); try { await saveBusinessSettings(settings); setNotice('Business settings saved.'); await load(); } catch (reason: unknown) { setError(failureText(reason)); } finally { setSaving(false); } };
  const field = (key: keyof BusinessSettings, label: string, type: 'text' | 'number' | 'email' | 'tel' = 'text') => <Field key={key} label={label}><Input type={type} value={settings[key]} onChange={(_, value) => setSettings({ ...settings, [key]: value.value })} /></Field>;
  return <div className="admin-page-content"><PageNotice error={error} success={notice} />{busy ? <LoadingPanel /> : <Card className="admin-editor"><form className="admin-form-grid" onSubmit={(event) => void save(event)}>
    {field('business_name', 'Business name')}{field('currency', 'Currency')}{field('delivery_fee', 'Delivery fee', 'number')}{field('support_phone', 'Support phone', 'tel')}{field('support_email', 'Support email', 'email')}{field('whatsapp_number', 'WhatsApp number')}
    <Field label="Return policy summary" className="admin-wide"><Textarea value={settings.return_policy_summary} onChange={(_, value) => setSettings({ ...settings, return_policy_summary: value.value })} /></Field>
    <Field label="Default warranty text" className="admin-wide"><Textarea value={settings.default_warranty_text} onChange={(_, value) => setSettings({ ...settings, default_warranty_text: value.value })} /></Field>
    <div className="admin-wide"><Button appearance="primary" type="submit" icon={<SaveRegular />} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div>
    {!Object.values(settings).some(Boolean) && <Caption1 className="admin-wide admin-muted">No business settings exist yet. Nothing was prefilled or seeded.</Caption1>}
  </form></Card>}</div>;
}

const orderStatuses: AdminOrderStatus[] = ['PENDING','CONFIRMED','SUPPLIER_PROCESSING','SUPPLIER_SHIPPED','IN_TRANSIT','DELIVERED','CANCELLED','RETURNED','REFUNDED'];
function orderTransitions(current: AdminOrderStatus, paymentStatus: string): AdminOrderStatus[] {
  const next: Record<AdminOrderStatus, AdminOrderStatus[]> = {
    PENDING: ['PENDING','CONFIRMED','CANCELLED'], CONFIRMED: ['CONFIRMED','SUPPLIER_PROCESSING','CANCELLED'],
    SUPPLIER_PROCESSING: ['SUPPLIER_PROCESSING','SUPPLIER_SHIPPED','CANCELLED'], SUPPLIER_SHIPPED: ['SUPPLIER_SHIPPED','IN_TRANSIT'],
    IN_TRANSIT: ['IN_TRANSIT','DELIVERED','RETURNED'], DELIVERED: ['DELIVERED','RETURNED'],
    CANCELLED: ['CANCELLED'], RETURNED: ['RETURNED'], REFUNDED: ['REFUNDED'],
  };
  return next[current].filter((status) => status !== 'REFUNDED' || paymentStatus === 'PAID');
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => entry === null || ['string','number','boolean'].includes(typeof entry));
}

function PageNotice({ error, success }: { error?: string; success?: string }) {
  return <>{error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}{success && <MessageBar intent="success"><MessageBarBody>{success}</MessageBarBody></MessageBar>}</>;
}

function LoadingPanel() { return <div className="admin-loading" role="status">Loading live Supabase records…</div>; }
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) { return <MessageBar intent="error"><MessageBarBody>{message} <Button appearance="transparent" onClick={retry}>Try again</Button></MessageBarBody></MessageBar>; }
function EmptyPanel({ title, detail }: { title: string; detail: string }) { return <Card className="empty-state admin-empty"><Title3>{title}</Title3><Body1>{detail}</Body1></Card>; }
function SectionTitle({ title, count }: { title: string; count?: number }) { return <div className="admin-section-title"><Subtitle1>{title}</Subtitle1>{count !== undefined && <Badge>{count} records</Badge>}</div>; }