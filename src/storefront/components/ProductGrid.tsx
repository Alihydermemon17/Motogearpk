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
import type { AvailabilityStatus, BikeModel, Category, Product } from '../../api/types';
import { api } from '../../api';
import { formatBusinessMoney } from '../../lib/businessDisplay';
import { useCustomerWishlist } from '../../app/CustomerState';
import { getBusinessDisplaySettings } from '../../lib/businessDisplay';
import { ProductImage } from '../../app/ProductImage';
import {
  availabilityLabel, isAvailable, money, useGridColumns,
} from '../shared';

export function ProductGrid({
  products,
  onNavigate,
  onAdd,
  variant = 'shop',
  askCard = true,
}: {
  products: Product[];
  onNavigate: (path: string) => void;
  onAdd: (product: Product) => void;
  variant?: 'home' | 'shop';
  askCard?: boolean;
}) {
  const columns = useGridColumns(variant);
  const remainder = products.length % columns;
  // One card, stretched across exactly the cells the last row leaves empty, so
  // the grid never ends on a gap. Never two filler cards.
  const askSpan = askCard && products.length > 0 && remainder !== 0 ? columns - remainder : 0;

  return (
    <div className={`mg-grid mg-grid--${variant}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onNavigate={onNavigate} onAdd={onAdd} />
      ))}
      {askSpan > 0 && <AskCard span={askSpan} onNavigate={onNavigate} />}
    </div>
  );
}

/* Source-request tile. It is deliberately not a product: no price, no stock,
   no cart. It closes an incomplete row with the next useful action. */
export function AskCard({ span, onNavigate }: { span: number; onNavigate: (path: string) => void }) {
  const business = getBusinessDisplaySettings();
  const whatsapp = business.whatsappNumber?.replace(/[^0-9]/g, '');
  const message = encodeURIComponent("Hi MotoGear PK — I'm looking for a part I couldn't find in the shop.");

  return (
    <article className="mg-ask" style={{ gridColumn: `span ${span}` }}>
      <span className="mg-ask-icon" aria-hidden="true">
        <ChatRegular />
      </span>
      <h3 className="mg-ask-title">Can’t find your part?</h3>
      <p>
        Send us your bike’s make and model. We will confirm what fits — or source it from a
        supplier we already buy from.
      </p>
      <div className="mg-ask-actions">
        {whatsapp ? (
          <a
            className="mg-btn mg-btn--accent"
            href={`https://wa.me/${whatsapp}?text=${message}`}
            target="_blank"
            rel="noreferrer"
          >
            <ChatRegular aria-hidden="true" />
            Ask on WhatsApp
          </a>
        ) : (
          <button type="button" className="mg-btn mg-btn--accent" onClick={() => onNavigate('/support')}>
            Ask support
          </button>
        )}
        <button type="button" className="mg-btn mg-btn--ghost" onClick={() => onNavigate('/shop')}>
          Browse all
        </button>
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 4, variant = 'shop' }: { count?: number; variant?: 'home' | 'shop' }) {
  return (
    <div className={`mg-grid mg-grid--${variant}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="mg-skeleton" key={index}>
          <div className="mg-skeleton-media" />
          <div className="mg-skeleton-line" />
          <div className="mg-skeleton-line is-short" />
        </div>
      ))}
    </div>
  );
}

export function ProductCard({
  product,
  onNavigate,
  onAdd,
}: {
  product: Product;
  onNavigate: (path: string) => void;
  onAdd: (product: Product) => void;
}) {
  const wishlist = useCustomerWishlist();
  const wished = wishlist.has(product.id);
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const availability =
    product.availabilityStatus ??
    (product.status === 'Limited' || product.status === 'Low stock' ? 'CHECK_REQUIRED' : 'AVAILABLE');
  const available = isAvailable(product);

  // Only ever show a discount that exists in the data (selling price vs the
  // recorded discount price) — never a computed or invented promotion.
  const originalPrice = product.originalPrice ?? 0;
  const hasDiscount = originalPrice > product.pricePk && product.pricePk > 0;
  const discountPct = hasDiscount
    ? Math.round((1 - product.pricePk / originalPrice) * 100)
    : 0;

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const handleAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!available) return;
    onAdd(product);
    setAdded(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <article className="mg-card">
      {/* One stretched link = one keyboard stop for the whole card. The wishlist
          and cart buttons sit above it and stop propagation. */}
      <a
        className="mg-card-link"
        href={`/product/${product.slug}`}
        aria-label={`View ${product.name}`}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(`/product/${product.slug}`);
        }}
      />

      <div className="mg-card-media">
        <ProductImage
          className="mg-card-img"
          src={product.image}
          alt={product.name}
          category={product.category}
          name={product.name}
        />

        {discountPct > 0 && <span className="mg-discount">-{discountPct}%</span>}

        <span className={`mg-stock${available ? '' : ' is-unavailable'}`}>
          {available ? 'In stock' : availabilityLabel(availability)}
        </span>

        <button
          type="button"
          className={`mg-wish${wished ? ' is-active' : ''}`}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(event) => {
            event.stopPropagation();
            wishlist.toggle(product.id);
          }}
        >
          {wished ? <HeartFilled /> : <HeartRegular />}
        </button>
      </div>

      <div className="mg-card-body">
        <span className="mg-card-cat">{product.category}</span>
        <h3 className="mg-card-title" title={product.name}>{product.name}</h3>
      </div>

      <div className="mg-card-foot">
        <div className="mg-price">
          <strong>{money(product.pricePk)}</strong>
          {hasDiscount && <del>{money(originalPrice)}</del>}
        </div>

        <button
          type="button"
          className={`mg-add${added ? ' is-added' : ''}`}
          disabled={!available}
          onClick={handleAdd}
          aria-label={available ? `Add ${product.name} to cart` : `${product.name} is unavailable`}
        >
          {added ? (
            <>
              <CheckmarkRegular aria-hidden="true" />
              Added
            </>
          ) : (
            <>
              <CartRegular aria-hidden="true" />
              {available ? 'Add to cart' : 'Unavailable'}
            </>
          )}
        </button>
      </div>
    </article>
  );
}
