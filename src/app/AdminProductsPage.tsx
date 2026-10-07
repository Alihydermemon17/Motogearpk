import { useEffect, useState } from 'react';
import { Badge, Body1, Button, Card, Checkbox, Field, Input, MessageBar, MessageBarBody, Option, Select, Subtitle1, Textarea, Title1 } from '@fluentui/react-components';
import { AddRegular, ArrowSyncRegular, CheckmarkRegular, EditRegular } from '@fluentui/react-icons';
import { api } from '../api';
import type { AdminProductInput, AdminSupplier, AvailabilityStatus, BikeModel, Category, Product } from '../api/types';
import { listAdminSuppliers } from '../api/admin';

const emptyInput: AdminProductInput = {
  name: '', slug: '', sku: '', categoryId: null, brand: '', shortDescription: '', description: '', specifications: {},
  sellingPrice: 0, discountPrice: null, supplierId: null, supplierProductUrl: '', supplierSku: '', supplierCost: null,
  shippingCostEstimate: null, availabilityStatus: 'CHECK_REQUIRED', estimatedSupplierQuantity: null, warranty: '', returnEligibility: '', published: false, seoTitle: '', seoDescription: '', archivedAt: null,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bikes, setBikes] = useState<BikeModel[]>([]);
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [input, setInput] = useState<AdminProductInput>(emptyInput);
  const [selectedBikes, setSelectedBikes] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [productRows, categoryRows, bikeRows, supplierRows] = await Promise.all([api.listAdminProducts(), api.listCategories(), api.listBikeModels(), listAdminSuppliers()]);
      setProducts(productRows); setCategories(categoryRows); setBikes(bikeRows); setSuppliers(supplierRows);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Unable to load admin product data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const setField = <K extends keyof AdminProductInput>(field: K, value: AdminProductInput[K]) => setInput((current) => ({ ...current, [field]: value }));
  const edit = (product: Product) => {
    setEditingId(product.id);
    setInput({ ...emptyInput, name: product.name, slug: product.slug, sku: product.sku ?? '', categoryId: product.categoryId ?? null, brand: product.brand ?? '', description: product.description, shortDescription: product.shortDescription ?? '', specifications: Object.fromEntries(product.specs.map((spec) => [spec.label, spec.value])), sellingPrice: product.originalPrice ?? product.pricePk, discountPrice: product.discountPrice ?? null, supplierId: product.supplierId ?? null, supplierProductUrl: product.supplierProductUrl ?? '', supplierSku: product.supplierSku ?? '', supplierCost: product.supplierCost ?? null, shippingCostEstimate: product.shippingCostEstimate ?? null, availabilityStatus: product.availabilityStatus ?? 'CHECK_REQUIRED', estimatedSupplierQuantity: product.stock ?? null, warranty: product.warranty ?? '', returnEligibility: product.returnEligibility ?? '', published: product.featured, seoTitle: product.seoTitle ?? '', seoDescription: product.seoDescription ?? '', archivedAt: product.archivedAt ?? null });
    setSelectedBikes((product.compatibleBikes ?? []).map((bike) => bike.id));
    setImageUrls((product.images ?? []).map((image) => image.url).join('\n'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const save = async () => {
    setError(''); setNotice('');
    try {
      const product = editingId ? await api.updateProduct(editingId, input) : await api.createProduct(input);
      await api.setProductImages(product.id, imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean).map((url, sortOrder) => ({ url, alt: input.name, sortOrder })));
      await api.setProductBikeModels(product.id, selectedBikes);
      setNotice(editingId ? 'Product updated.' : 'Product created.'); setEditingId(null); setInput(emptyInput); setSelectedBikes([]); setImageUrls(''); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Unable to save product.'); }
  };

  const toggleArchive = async (product: Product) => {
    const archiving = !product.archivedAt;
    if (archiving && !window.confirm(`Archive ${product.name}? It will be hidden from the customer catalog.`)) return;
    setError(''); setNotice('');
    try {
      await api.updateProduct(product.id, archiving ? { published: false, archivedAt: new Date().toISOString() } : { archivedAt: null });
      setNotice(archiving ? 'Product archived.' : 'Product restored as an unpublished listing.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Unable to change archive status.'); }
  };

  return <div className="admin-page-content">
    <div className="admin-section-title"><div><Body1>Manage supplier-backed listings without treating supplier quantity as warehouse stock.</Body1></div><Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => void load()}>Refresh listings</Button></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}{notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
    <Card className="admin-editor"><div className="admin-editor-head"><Subtitle1>{editingId ? 'Edit product' : 'Add product'}</Subtitle1>{editingId && <Button appearance="subtle" onClick={() => { setEditingId(null); setInput(emptyInput); setSelectedBikes([]); setImageUrls(''); }}>Cancel edit</Button>}</div>
      <div className="admin-form-grid">
        <Field label="Product name" required><Input value={input.name} onChange={(_, data) => setField('name', data.value)} /></Field>
        <Field label="SKU" required><Input value={input.sku} onChange={(_, data) => setField('sku', data.value)} /></Field>
        <Field label="Slug" required><Input value={input.slug} onChange={(_, data) => setField('slug', data.value)} /></Field>
        <Field label="Brand" required><Input value={input.brand} onChange={(_, data) => setField('brand', data.value)} /></Field>
        <Field label="Category"><Select value={input.categoryId ?? ''} onChange={(_, data) => setField('categoryId', data.value || null)}><Option value="">Unassigned</Option>{categories.map((category) => <Option key={category.id} value={category.id}>{category.name}</Option>)}</Select></Field>
        <Field label="Availability"><Select value={input.availabilityStatus} onChange={(_, data) => setField('availabilityStatus', data.value as AvailabilityStatus)}><Option value="AVAILABLE">Available</Option><Option value="UNAVAILABLE">Unavailable</Option><Option value="CHECK_REQUIRED">Check required</Option></Select></Field>
        <Field label="Selling price (PKR)" required><Input type="number" value={String(input.sellingPrice)} onChange={(_, data) => setField('sellingPrice', Number(data.value))} /></Field>
        <Field label="Discount price (PKR)"><Input type="number" value={input.discountPrice == null ? '' : String(input.discountPrice)} onChange={(_, data) => setField('discountPrice', data.value ? Number(data.value) : null)} /></Field>
        <Field label="Supplier cost (PKR)"><Input type="number" value={input.supplierCost == null ? '' : String(input.supplierCost)} onChange={(_, data) => setField('supplierCost', data.value ? Number(data.value) : null)} /></Field>
        <Field label="Shipping estimate (PKR)"><Input type="number" value={input.shippingCostEstimate == null ? '' : String(input.shippingCostEstimate)} onChange={(_, data) => setField('shippingCostEstimate', data.value ? Number(data.value) : null)} /></Field>
        <Field label="Supplier"><Select value={input.supplierId ?? ''} onChange={(_, data) => setField('supplierId', data.value || null)}><Option value="">Unassigned</Option>{suppliers.map((supplier) => <Option key={supplier.id} value={supplier.id}>{supplier.name}</Option>)}</Select></Field>
        <Field label="Supplier product URL"><Input value={input.supplierProductUrl} onChange={(_, data) => setField('supplierProductUrl', data.value)} /></Field>
        <Field label="Supplier SKU"><Input value={input.supplierSku} onChange={(_, data) => setField('supplierSku', data.value)} /></Field>
        <Field label="Supplier estimated quantity" validationState="warning" validationMessage="This is supplier availability, not MotoGear PK inventory."><Input type="number" value={input.estimatedSupplierQuantity == null ? '' : String(input.estimatedSupplierQuantity)} onChange={(_, data) => setField('estimatedSupplierQuantity', data.value ? Number(data.value) : null)} /></Field>
        <Field label="Short description"><Input value={input.shortDescription} onChange={(_, data) => setField('shortDescription', data.value)} /></Field>
        <Field label="Warranty"><Input value={input.warranty} onChange={(_, data) => setField('warranty', data.value)} /></Field>
        <Field label="Return eligibility"><Input value={input.returnEligibility} onChange={(_, data) => setField('returnEligibility', data.value)} /></Field>
        <Field label="SEO title"><Input value={input.seoTitle ?? ''} onChange={(_, data) => setField('seoTitle', data.value)} /></Field>
        <Field label="SEO description" className="admin-wide"><Textarea value={input.seoDescription ?? ''} onChange={(_, data) => setField('seoDescription', data.value)} /></Field>
        <Field label="Product image URLs" className="admin-wide"><Textarea value={imageUrls} onChange={(_, data) => setImageUrls(data.value)} placeholder="One image URL per line" /></Field>
        <Field label="Description" className="admin-wide"><Textarea value={input.description} onChange={(_, data) => setField('description', data.value)} /></Field>
        <Field label="Specifications JSON" className="admin-wide"><Textarea value={JSON.stringify(input.specifications)} onChange={(_, data) => { try { setField('specifications', JSON.parse(data.value) as Record<string, string>); } catch { /* keep the last valid object */ } }} /></Field>
        <Field label="Compatible bike models" className="admin-wide"><div className="bike-checks">{bikes.map((bike) => <Checkbox key={bike.id} label={bike.name} checked={selectedBikes.includes(bike.id)} onChange={(_, data) => setSelectedBikes((current) => data.checked ? [...current, bike.id] : current.filter((id) => id !== bike.id))} />)}</div></Field>
      </div>
      <div className="admin-actions"><Checkbox label="Published in customer shop" checked={input.published} onChange={(_, data) => setField('published', Boolean(data.checked))} /><Button appearance="primary" icon={editingId ? <CheckmarkRegular /> : <AddRegular />} onClick={() => void save()}>{editingId ? 'Save product changes' : 'Create product listing'}</Button></div>
    </Card>
    <div className="admin-list"><div className="section-head"><Subtitle1>Listings</Subtitle1><Badge>{loading ? 'Loading' : `${products.length} records`}</Badge></div>{!loading && products.length === 0 && <Card className="empty-state"><Subtitle1>No products</Subtitle1><Body1>Product listings appear here after an admin creates them.</Body1></Card>}{products.map((product) => <Card key={product.id} className="admin-row"><div><Subtitle1>{product.name}</Subtitle1><Body1>{product.slug} · {product.availabilityStatus ?? product.status} · SKU {product.sku}</Body1><Body1>Supplier cost: {product.supplierCost == null ? 'Not set' : `PKR ${product.supplierCost.toLocaleString('en-PK')}`} · Estimated profit: {product.estimatedProfit == null ? 'Not available' : `PKR ${product.estimatedProfit.toLocaleString('en-PK')}`}</Body1></div><div className="admin-row-meta"><Badge color={product.archivedAt ? 'danger' : product.featured ? 'success' : 'informative'}>{product.archivedAt ? 'Archived' : product.featured ? 'Published' : 'Draft'}</Badge><Button appearance="subtle" icon={<EditRegular />} onClick={() => edit(product)}>Edit</Button><Button appearance="subtle" onClick={() => void toggleArchive(product)}>{product.archivedAt ? 'Restore' : 'Archive'}</Button></div></Card>)}</div>
  </div>;
}
