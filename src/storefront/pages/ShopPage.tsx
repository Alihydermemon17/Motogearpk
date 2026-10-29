import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';
import {
  Badge, Body1, Button, Caption1, Divider, MessageBar, MessageBarBody, Select,
  Skeleton, SkeletonItem, Subtitle1, Title1, Title3,
} from '@fluentui/react-components';
import {
  ArrowRightRegular, CartRegular, ChatRegular, CheckmarkCircleRegular,
  CheckmarkRegular, ChevronLeftRegular, DismissRegular, HeartFilled, HeartRegular, HomeRegular,
  LocationRegular, MailRegular, NavigationRegular, PersonVoiceRegular,
  PhoneRegular, SearchRegular, ShieldCheckmarkRegular, SparkleRegular, TimerRegular,
  VehicleBicycleRegular, WeatherMoonRegular, WeatherSunnyRegular, WrenchRegular,
} from '@fluentui/react-icons';
import type { Category, Product } from '../../api/types';
import { api } from '../../api';
import { EmptyState } from '../components/Sections';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';
import {
  CATEGORY_TILES, applyCatalogSort, bandImageFor, useProducts, useGridColumns,
} from '../shared';
import type { SortKey } from '../shared';
import { getBusinessDisplaySettings } from '../../lib/businessDisplay';

export function ShopPage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
  const { products, state, error, retry } = useProducts();
  const params = new URLSearchParams(window.location.search);
  const requestedCategory = params.get('category') ?? 'All';
  const [category, setCategory] = useState(requestedCategory);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [bikeId, setBikeId] = useState<string | null>(params.get('bike'));
  const [bikeName, setBikeName] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [categories, setCategories] = useState<Category[]>([]);
  const contact = getBusinessDisplaySettings();
  const whatsapp = contact.whatsappNumber?.replace(/[^0-9]/g, '');

  useEffect(() => {
    let active = true;
    api.listCategories()
      .then((rows) => { if (active) setCategories(rows.filter((row) => row.active !== false)); })
      .catch(() => { /* fall back to categories discovered in the catalog */ });
    return () => { active = false; };
  }, []);

  // Category names are what products store; slugs are what links use. Resolve
  // one to the other so /shop?category=lighting-electrics and the older
  // ?category=Lighting%20%26%20Electrics links land on the same pill.
  const categoryNames = Array.from(new Set([
    ...categories.map((row) => row.name),
    ...products.map((item) => item.category),
  ]));
  const resolveCategory = (value: string) => {
    if (value === 'All') return 'All';
    const hit = categories.find((row) => row.slug === value || row.name === value);
    if (hit) return hit.name;
    return categoryNames.includes(value) ? value : 'All';
  };
  const activeCategory = resolveCategory(category);

  // Resolve the friendly bike name for the active-filter chip.
  useEffect(() => {
    if (!bikeId) { setBikeName(''); return; }
    let active = true;
    api.listBikeModels()
      .then((rows) => {
        if (!active) return;
        const hit = rows.find((row) => row.id === bikeId);
        setBikeName(hit ? `${hit.brand ? `${hit.brand} ` : ''}${hit.name}` : '');
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [bikeId]);

  const slugFor = (name: string) =>
    name === 'All' ? '' : categories.find((row) => row.name === name)?.slug ?? name;

  // Filters are additive, so every URL change has to re-emit the whole state —
  // otherwise picking a category silently drops a bike or search deep link.
  const syncUrl = (next: { category?: string; bike?: string | null }) => {
    const params = new URLSearchParams();
    const nextCategory = next.category ?? category;
    const nextBike = next.bike === undefined ? bikeId : next.bike;
    const slug = slugFor(nextCategory);
    if (slug) params.set('category', slug);
    if (nextBike) params.set('bike', nextBike);
    if (search.trim()) params.set('q', search.trim());
    const query = params.toString();
    window.history.replaceState({}, '', `/shop${query ? `?${query}` : ''}`);
  };

  const selectCategory = (next: string) => {
    setCategory(next);
    syncUrl({ category: next });
  };

  const clearBike = () => {
    setBikeId(null);
    syncUrl({ bike: null });
  };

  const filtered = applyCatalogSort(
    products.filter(
      (product) =>
        (activeCategory === 'All' || product.category === activeCategory) &&
        (!bikeId || (product.compatibleBikes ?? []).some((bike) => bike.id === bikeId)) &&
        (!search ||
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.brand?.toLowerCase().includes(search.toLowerCase())),
    ),
    sort,
  );

  const counts = products.reduce<Record<string, number>>((total, product) => {
    total[product.category] = (total[product.category] ?? 0) + 1;
    return total;
  }, {});

  const hasActiveFilters = activeCategory !== 'All' || search.trim() !== '' || Boolean(bikeId);
  const band = bandImageFor(activeCategory);
  const bandCount = activeCategory === 'All' ? products.length : counts[activeCategory] ?? 0;

  const clearFilters = () => {
    setCategory('All');
    setSearch('');
    setBikeId(null);
    setSort('featured');
    window.history.replaceState({}, '', '/shop');
  };

  return (
    <>
      {/* Photo band: the catalogue cover, or the selected category's own image. */}
      <section className="mg-shop-band" aria-labelledby="shop-title">
        <picture className="mg-shop-band-media">
          <source type="image/avif" srcSet={`${band.avifSmall} 960w, ${band.avif} 1400w`} sizes="100vw" />
          <source type="image/webp" srcSet={`${band.webpSmall} 960w, ${band.webp} 1400w`} sizes="100vw" />
          <img
            src={band.jpg}
            srcSet={`${band.jpgSmall} 960w, ${band.jpg} 1400w`}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="mg-shop-band-veil" aria-hidden="true" />
        <div className="mg-container mg-shop-band-copy">
          <nav className="mg-crumbs" aria-label="Breadcrumb">
            {activeCategory === 'All' ? (
              <span aria-current="page">Shop</span>
            ) : (
              <>
                <button type="button" onClick={() => selectCategory('All')}>Shop</button>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{activeCategory}</span>
              </>
            )}
          </nav>
          <p className="mg-kicker">{activeCategory === 'All' ? 'Full catalog' : 'Category'}</p>
          <h1 className="mg-h1" id="shop-title">
            {activeCategory === 'All' ? 'Parts for every ride.' : activeCategory}
          </h1>
          <p className="mg-shop-band-sub">
            {state === 'loading'
              ? 'Loading the current catalog…'
              : activeCategory === 'All'
                ? `${products.length} parts and accessories with the fitment and availability each listing records.`
                : `${bandCount} ${bandCount === 1 ? 'product' : 'products'} listed in ${activeCategory}.`}
          </p>
        </div>
      </section>

      <div className="mg-shop-toolbar">
        <div className="mg-filterbar">
          <div className="mg-filterbar-row">
            {/* The header search covers desktop; this field is the same control
                on narrower screens, where the header search is not rendered. */}
            <div className="mg-search-field mg-shop-search">
              <SearchRegular aria-hidden="true" />
              <input
                className="mg-input"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  const params = new URLSearchParams(window.location.search);
                  if (event.target.value.trim()) params.set('q', event.target.value.trim());
                  else params.delete('q');
                  const query = params.toString();
                  window.history.replaceState({}, '', `/shop${query ? `?${query}` : ''}`);
                }}
                placeholder="Search parts, helmets, exhausts…"
                aria-label="Search products"
              />
            </div>

            <div className="mg-field">
              <select
                className="mg-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort products"
              >
                <option value="featured">Sort: Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>

            <div className="mg-results" role="status" aria-live="polite">
              <b>{filtered.length}</b> {filtered.length === 1 ? 'product' : 'products'}
            </div>
          </div>

          <div className="mg-pills" role="group" aria-label="Filter by category">
            <button
              type="button"
              className={`mg-pill${activeCategory === 'All' ? ' is-active' : ''}`}
              aria-pressed={activeCategory === 'All'}
              onClick={() => selectCategory('All')}
            >
              All
              <span className="mg-pill-count">{products.length}</span>
            </button>
            {categoryNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`mg-pill${activeCategory === name ? ' is-active' : ''}`}
                aria-pressed={activeCategory === name}
                onClick={() => selectCategory(name)}
              >
                {name}
                <span className="mg-pill-count">{counts[name] ?? 0}</span>
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <div className="mg-active-filters">
              <span>Filtered by</span>
              {activeCategory !== 'All' && (
                <span className="mg-chip">
                  {activeCategory}
                  <button
                    type="button"
                    onClick={() => selectCategory('All')}
                    aria-label={`Clear category ${activeCategory}`}
                  >
                    <DismissRegular />
                  </button>
                </span>
              )}
              {bikeId && (
                <span className="mg-chip">
                  {bikeName || 'Selected bike'}
                  <button
                    type="button"
                    onClick={clearBike}
                    aria-label="Clear bike filter"
                  >
                    <DismissRegular />
                  </button>
                </span>
              )}
              {search.trim() !== '' && (
                <span className="mg-chip">
                  “{search.trim()}”
                  <button type="button" onClick={() => { setSearch(''); syncUrl({}); }} aria-label="Clear search">
                    <DismissRegular />
                  </button>
                </span>
              )}
              <button type="button" className="mg-clear" onClick={clearFilters}>Clear all</button>
            </div>
          )}
        </div>
      </div>

      <div className="mg-container mg-shop-grid-wrap">
        <section aria-labelledby="shop-results-title">
          <h2 className="mg-sr-only" id="shop-results-title">
            {activeCategory === 'All' ? 'All products' : activeCategory}
          </h2>

          {state === 'loading' && <ProductGridSkeleton count={6} variant="shop" />}

          {state === 'error' && (
            <EmptyState
              title="We could not load the catalog"
              body={error || 'Something went wrong while fetching products.'}
              action="Try again"
              onAction={retry}
            />
          )}

          {state === 'empty' && (
            <EmptyState
              title="No products listed yet"
              body="The catalog is being stocked. Check back shortly or ask us about a specific part."
              action="Talk to support"
              onAction={() => onNavigate('/support')}
            />
          )}

          {state === 'data' && filtered.length === 0 && (
            <EmptyState
              title={activeCategory === 'All' ? 'Nothing matches those filters' : `Nothing in ${activeCategory} yet`}
              body={
                activeCategory === 'All'
                  ? 'Try a different category or bike, or clear the filters to see the full catalog.'
                  : 'We can source it. Message us with your bike and we will confirm what fits — or browse everything already in stock.'
              }
              secondary={whatsapp ? {
                label: 'Ask on WhatsApp',
                href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(
                  activeCategory === 'All'
                    ? "Hi MotoGear PK — I'm looking for a part I couldn't find in the shop."
                    : `Hi MotoGear PK — do you have anything in ${activeCategory}?`,
                )}`,
              } : { label: 'Contact support', onClick: () => onNavigate('/support') }}
              action="Browse all"
              onAction={clearFilters}
            />
          )}

          {state === 'data' && filtered.length > 0 && (
            <ProductGrid products={filtered} onNavigate={onNavigate} onAdd={onAdd} variant="shop" />
          )}
        </section>
      </div>
    </>
  );
}
