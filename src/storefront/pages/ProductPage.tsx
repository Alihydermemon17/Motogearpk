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
import type { Product } from '../../api/types';
import { api } from '../../api';
import { useCustomerWishlist } from '../../app/CustomerState';
import { ProductImage } from '../../app/ProductImage';
import { DeliveryInfo, ProductReviews } from '../../app/CustomerTrustPages';
import { SectionHeading } from '../components/Layout';
import { ProductGrid } from '../components/ProductGrid';
import { StatePanel } from '../components/Sections';
import { availabilityLabel, isAvailable, money, useProducts } from '../shared';
import type { DataState } from '../shared';

export function ProductPage({
  slug,
  onNavigate,
  onAdd,
}: {
  slug: string;
  onNavigate: (path: string) => void;
  onAdd: (product: Product) => void;
}) {
  const wishlist = useCustomerWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [state, setState] = useState<DataState>('loading');

  useEffect(() => {
    let active = true;
    setState('loading');
    api.getProduct(slug)
      .then((value) => {
        if (active) {
          setProduct(value);
          setState(value ? 'data' : 'empty');
        }
      })
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [slug]);

  if (state !== 'data' || !product) {
    return (
      <div className="page-content">
        <StatePanel
          state={state}
          error="We couldn't load that product."
          retry={() => window.location.reload()}
          emptyLabel="That ride has left the garage."
        />
      </div>
    );
  }

  const isItemAvailable = isAvailable(product);
  const availabilityBadgeColor =
    product.availabilityStatus === 'AVAILABLE' ? 'success' : product.availabilityStatus === 'UNAVAILABLE' ? 'danger' : 'warning';

  return (
    <div className="page-content">
      <div className="product-back-bar">
        <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={() => onNavigate('/shop')}>
          Back to shop
        </Button>
      </div>

      <div className="detail-layout">
        <div className="detail-media-col">
        <div className="detail-image-box">
          <ProductImage src={product.image} alt={product.name} category={product.category} name={product.name} />
          <Badge className="image-badge" appearance="filled" color={availabilityBadgeColor}>
            {product.availabilityStatus ?? product.status}
          </Badge>
          <Button
            appearance="subtle"
            className={`wishlist-toggle detail-wishlist-toggle${wishlist.has(product.id) ? ' is-active' : ''}`}
            icon={wishlist.has(product.id) ? <HeartFilled /> : <HeartRegular />}
            aria-pressed={wishlist.has(product.id)}
            aria-label={wishlist.has(product.id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            title={wishlist.has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
            onClick={() => wishlist.toggle(product.id)}
          />
        </div>

        <div className="detail-assurance">
          <div className="assurance-item">
            <LocationRegular />
            <div>
              <b>Nationwide Cash on Delivery</b>
              <span>Pay in hand when your order arrives</span>
            </div>
          </div>
          <div className="assurance-item">
            <CheckmarkCircleRegular />
            <div>
              <b>7-Day Easy Returns</b>
              <span>Exchange or return without hassle</span>
            </div>
          </div>
          <div className="assurance-item">
            <SparkleRegular />
            <div>
              <b>Warranty Backed</b>
              <span>Covered by the listed supplier warranty</span>
            </div>
          </div>
        </div>
        </div>

        <div className="detail-copy">
          <Caption1 className="section-kicker">
            {product.category.toUpperCase()} / {product.brand ?? 'MOTOGEAR PK'}
          </Caption1>
          <Title1 as="h1">{product.name}</Title1>
          <Caption1 className="detail-section-label">Description</Caption1>
          <Body1 className="detail-desc">{product.description}</Body1>

          <div className="detail-price-box">
            <span className="price-main">{money(product.pricePk)}</span>
            {product.originalPrice && product.originalPrice > product.pricePk ? (
              <del className="price-del">{money(product.originalPrice)}</del>
            ) : null}
          </div>

          <div className="stock-line">
            <CheckmarkCircleRegular />
            <span>
              {product.availabilityStatus === 'AVAILABLE'
                ? 'Supplier availability confirmed · Ready for COD dispatch'
                : 'Supplier stock check required before shipping'}
            </span>
          </div>

          <div className="detail-cta-row">
            <Button
              appearance="primary"
              size="large"
              icon={<CartRegular />}
              disabled={!isItemAvailable}
              onClick={() => onAdd(product)}
            >
              {isItemAvailable ? 'Add to cart' : 'Currently unavailable'}
            </Button>
          </div>

          <Divider />

          <div className="spec-heading">
            <Subtitle1>Specifications & Compatibility</Subtitle1>
          </div>

          <div className="spec-grid">
            {product.specs.map((spec) => (
              <div key={spec.label} className="spec-card">
                <Caption1 className="spec-label">{spec.label}</Caption1>
                <Subtitle1 className="spec-value">{spec.value}</Subtitle1>
              </div>
            ))}
            {product.compatibleBikes?.length ? (
              <div className="spec-card compatible-bikes">
                <Caption1 className="spec-label">Compatible bikes</Caption1>
                <Subtitle1 className="spec-value">
                  {product.compatibleBikes.map((bike) => bike.name).join(', ')}
                </Subtitle1>
              </div>
            ) : null}
            <div className="spec-card">
              <Caption1 className="spec-label">Warranty</Caption1>
              <Subtitle1 className="spec-value">{product.warranty?.trim() || 'Warranty information not available.'}</Subtitle1>
            </div>
            {product.returnEligibility && <div className="spec-card">
              <Caption1 className="spec-label">Returns</Caption1>
              <Subtitle1 className="spec-value">{product.returnEligibility}</Subtitle1>
            </div>}
          </div>
          <DeliveryInfo navigate={onNavigate} />
        </div>
      </div>

      <section className="detail-note">
        <Title3 as="h2">Made for miles.</Title3>
        <Body1>{product.description}</Body1>
      </section>
      <ProductReviews product={product} navigate={onNavigate} />
    </div>
  );
}
