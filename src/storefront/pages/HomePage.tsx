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
import { Hero, BikeSelector, EmptyState } from '../components/Sections';
import { CtaBand, PromiseBand, Reveal, TrustStrip } from '../components/Layout';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';
import { CATEGORY_TILES, useProducts } from '../shared';
import { getBusinessDisplaySettings } from '../../lib/businessDisplay';

export function HomePage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
  const { products, state, error, retry } = useProducts();
  // Four items keeps a complete row at every breakpoint (4-up on desktop,
  // 2×2 below 1024) — the grid never ends on a half-empty row.
  const featured = products.slice(0, 4);
  const counts = products.reduce<Record<string, number>>((total, product) => {
    total[product.category] = (total[product.category] ?? 0) + 1;
    return total;
  }, {});

  return (
    <>
      <Hero onNavigate={onNavigate} />
      <TrustStrip />

      <Reveal>
        <section className="mg-section mg-section--canvas" aria-labelledby="category-title">
          <div className="mg-container">
            <div className="mg-section-head">
              <div className="mg-section-head-copy">
                <p className="mg-kicker">Shop by category</p>
                <h2 className="mg-h2" id="category-title">Four ways to build your ride.</h2>
              </div>
            </div>

            <div className="mg-cats">
              {CATEGORY_TILES.map((tile) => {
                const count = counts[tile.label] ?? 0;
                const media = (
                  <>
                    <img src={tile.image} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    <span className="mg-cat-arrow" aria-hidden="true">
                      <ArrowRightRegular />
                    </span>
                  </>
                );

                if (count === 0) {
                  const whatsapp = getBusinessDisplaySettings().whatsappNumber?.replace(/[^0-9]/g, '');
                  const message = encodeURIComponent(`Hi MotoGear PK — when will ${tile.label} be stocked?`);
                  return (
                    <div className="mg-cat is-empty" key={tile.label}>
                      {media}
                      <span className="mg-cat-copy">
                        <strong>{tile.label}</strong>
                        <span className="mg-cat-meta">
                          <span className="mg-cat-count">Coming soon</span>
                        </span>
                        {whatsapp && (
                          <a
                            className="mg-cat-request"
                            href={`https://wa.me/${whatsapp}?text=${message}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Request a part on WhatsApp
                            <ArrowRightRegular aria-hidden="true" />
                          </a>
                        )}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={tile.label}
                    type="button"
                    className="mg-cat"
                    onClick={() => onNavigate(`/shop?category=${encodeURIComponent(tile.slug)}`)}
                  >
                    {media}
                    <span className="mg-cat-copy">
                      <strong>{tile.label}</strong>
                      <span className="mg-cat-meta">
                        <span className="mg-cat-count">
                          {count} {count === 1 ? 'product' : 'products'}
                        </span>
                        <span className="mg-cat-hint"> · {tile.hint}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mg-section mg-section--surface" aria-labelledby="featured-title">
          <div className="mg-container">
            <div className="mg-section-head">
              <div className="mg-section-head-copy">
                <p className="mg-kicker">Featured gear</p>
                <h2 className="mg-h2" id="featured-title">Newest in the catalog.</h2>
              </div>
              <button type="button" className="mg-section-link" onClick={() => onNavigate('/shop')}>
                View all
                <ArrowRightRegular aria-hidden="true" />
              </button>
            </div>

            {state === 'loading' && <ProductGridSkeleton count={4} variant="home" />}
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
                title="No featured products yet"
                body="New stock is added regularly. Browse the full catalog to see everything listed."
                action="Browse the catalog"
                onAction={() => onNavigate('/shop')}
              />
            )}
            {state === 'data' && (
              <ProductGrid products={featured} onNavigate={onNavigate} onAdd={onAdd} variant="home" />
            )}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mg-section mg-section--canvas" aria-labelledby="bike-title">
          <div className="mg-container">
            <div className="mg-section-head">
              <div className="mg-section-head-copy">
                <p className="mg-kicker">Shop by bike</p>
                <h2 className="mg-h2" id="bike-title">Start from your motorcycle.</h2>
              </div>
            </div>
            <BikeSelector onNavigate={onNavigate} />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <PromiseBand />
      </Reveal>

      <Reveal>
        <section className="mg-section mg-section--canvas" aria-label="Contact the team">
          <div className="mg-container">
            <CtaBand onNavigate={onNavigate} />
          </div>
        </section>
      </Reveal>
    </>
  );
}
