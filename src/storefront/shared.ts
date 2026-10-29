import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';
import type { AvailabilityStatus, Product } from '../api/types';
import { api } from '../api';
import { formatBusinessMoney } from '../lib/businessDisplay';

export type DataState = 'data' | 'loading' | 'empty' | 'error';
export type ThemeMode = 'light' | 'dark';

export const money = (value: number) => formatBusinessMoney(value);

export const availabilityLabel = (status: AvailabilityStatus) =>
  status === 'AVAILABLE' ? 'Available' : status === 'UNAVAILABLE' ? 'Unavailable' : 'Check required';

/* Reduced-motion is read as state rather than a constant so a user changing the
   OS preference mid-session is respected without a reload. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/* Motorcycle-led by design: the hero never opens on car lighting. */
export const HERO_SLIDES = [
  {
    desktop: '/img/hero-1-1920.jpg',
    mobile: '/img/hero-1-960.jpg',
    eyebrow: 'Motorcycle gear · Built for Pakistan',
    titleTop: 'Gear for the',
    titleAccent: 'night ride.',
    body: 'Parts, lighting and protective kit for the way Pakistan actually rides — filtered by the bikes they fit.',
    alt: 'Motorcyclist riding a highway at dusk',
  },
  {
    desktop: '/img/hero-2-1920.jpg',
    mobile: '/img/hero-2-960.jpg',
    eyebrow: 'Lighting & electrics',
    titleTop: 'See further.',
    titleAccent: 'Ride safer.',
    body: 'LED headlights, projector lenses and DRL upgrades — with the fitment each listing actually confirms.',
    alt: 'Sport motorcycle with its headlight on in a dark garage',
  },
  {
    desktop: '/img/hero-3-1920.jpg',
    mobile: '/img/hero-3-960.jpg',
    eyebrow: 'Fitment first',
    titleTop: 'Know it fits',
    titleAccent: 'before you buy.',
    body: 'Every listing names the bikes it fits, so you order once and get back on the road sooner.',
    alt: 'Naked motorcycle parked on a wooded road',
  },
];

export const HERO_INTERVAL = 6000;

/* Mirrors the `categories` table — tiles deep-link into the filtered shop view.
   Counts are computed from the live catalog, never hardcoded. */
export const CATEGORY_TILES = [
  { label: 'Lighting & Electrics', slug: 'lighting-electrics', hint: 'LED bulbs, projectors, DRL', image: '/img/cat-lighting.jpg' },
  { label: 'Riding Gear', slug: 'riding-gear', hint: 'Helmets, gloves, protection', image: '/img/cat-gear.jpg' },
  { label: 'Performance Parts', slug: 'performance-parts', hint: 'Exhausts, filters, controls', image: '/img/cat-performance.jpg' },
  { label: 'Bike Care & Accessories', slug: 'bike-care-accessories', hint: 'Lubes, covers, maintenance', image: '/img/cat-care.jpg' },
] as const;

/* Shop band photography. Only the full-catalogue band has a 960w variant; the
   category images are already small enough to ship at one size. */
export const SHOP_BAND = {
  jpg: '/img/shop-header.jpg',
  webp: '/img/shop-header.webp',
  avif: '/img/shop-header.avif',
  jpgSmall: '/img/shop-header-960.jpg',
  webpSmall: '/img/shop-header-960.webp',
  avifSmall: '/img/shop-header-960.avif',
};

export function bandImageFor(category: string) {
  const tile = CATEGORY_TILES.find((item) => item.label === category);
  if (!tile) return SHOP_BAND;
  const base = tile.image.replace(/\.jpg$/, '');
  return {
    jpg: `${base}.jpg`,
    webp: `${base}.webp`,
    avif: `${base}.avif`,
    jpgSmall: `${base}.jpg`,
    webpSmall: `${base}.webp`,
    avifSmall: `${base}.avif`,
  };
}

/* The grid's real column count is needed in JS as well as CSS: the trailing
   "ask us" card has to fill exactly the cells the last row leaves empty. */
export const homeColumns = (width: number) => (width >= 1024 ? 4 : 2);

export const shopColumns = (width: number) => (width >= 1280 ? 4 : width >= 1024 ? 3 : 2);

export function useGridColumns(variant: 'home' | 'shop') {
  const read = () => (variant === 'home' ? homeColumns(window.innerWidth) : shopColumns(window.innerWidth));
  const [columns, setColumns] = useState(read);
  useEffect(() => {
    const update = () => setColumns(variant === 'home' ? homeColumns(window.innerWidth) : shopColumns(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [variant]);
  return columns;
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

export function applyCatalogSort(items: Product[], sort: SortKey): Product[] {
  if (sort === 'featured') return items;
  const list = [...items];
  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => a.pricePk - b.pricePk);
    case 'price-desc':
      return list.sort((a, b) => b.pricePk - a.pricePk);
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return list;
  }
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<DataState>('loading');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setState('loading');
    api.getCatalog()
      .then((items) => {
        setProducts(items);
        setState(items.length ? 'data' : 'empty');
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load catalog.');
        setState('error');
      });
  }, []);

  useEffect(load, [load]);
  return { products, state, error, retry: load };
}

export function isAvailable(product: Product): boolean {
  if (product.availabilityStatus) return product.availabilityStatus === 'AVAILABLE';
  const status = product.status.toUpperCase();
  return (
    !status.includes('UNAVAILABLE') &&
    !status.includes('LIMITED') &&
    !status.includes('LOW STOCK') &&
    !status.includes('CHECK REQUIRED')
  );
}
