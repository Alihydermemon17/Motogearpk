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
import type { BikeModel, Category, Product } from '../../api/types';
import { api } from '../../api';
import { HERO_INTERVAL, HERO_SLIDES, usePrefersReducedMotion } from '../shared';
import type { DataState } from '../shared';
import { ProductGridSkeleton } from './ProductGrid';

export function Hero({ onNavigate }: { onNavigate: (path: string) => void }) {
  const reduceMotion = usePrefersReducedMotion();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = HERO_SLIDES[slide];

  useEffect(() => {
    if (reduceMotion || paused) return;
    const id = window.setInterval(
      () => setSlide((current) => (current + 1) % HERO_SLIDES.length),
      HERO_INTERVAL,
    );
    return () => window.clearInterval(id);
  }, [reduceMotion, paused]);

  const findMyBike = () => {
    const target = document.getElementById('shop-by-bike');
    if (!target) {
      onNavigate('/shop');
      return;
    }
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  return (
    <section
      className="mg-hero"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mg-hero-media">
        {HERO_SLIDES.map((item, index) => (
          <img
            key={item.desktop}
            className={`mg-hero-img${index === slide ? ' is-active' : ''}`}
            src={item.desktop}
            srcSet={`${item.mobile} 960w, ${item.desktop} 1920w`}
            sizes="100vw"
            alt={index === slide ? item.alt : ''}
            aria-hidden={index === slide ? undefined : true}
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'low'}
            decoding="async"
            width={1920}
            height={1280}
          />
        ))}
        <div className="mg-hero-scrim" aria-hidden="true" />
      </div>

      <div className="mg-hero-inner">
        <div className="mg-hero-copy">
          <span className="mg-hero-eyebrow">
            <i aria-hidden="true" />
            {active.eyebrow}
          </span>

          <h1 className="mg-display mg-hero-title">
            {active.titleTop} <span>{active.titleAccent}</span>
          </h1>

          <p className="mg-hero-sub">{active.body}</p>

          <div className="mg-hero-actions">
            <button
              type="button"
              className="mg-btn mg-btn--accent"
              onClick={() => onNavigate('/shop')}
            >
              Shop gear
              <ArrowRightRegular aria-hidden="true" />
            </button>
            <button type="button" className="mg-btn mg-btn--ghost" onClick={findMyBike}>
              Find parts for my bike
            </button>
          </div>

          <div
            className={`mg-hero-progress${paused ? ' is-paused' : ''}`}
            role="group"
            aria-label="Featured slides"
          >
            {HERO_SLIDES.map((item, index) => (
              <button
                key={item.desktop}
                type="button"
                className={`mg-progress${index < slide ? ' is-done' : ''}`}
                aria-label={`Show slide ${index + 1}: ${item.titleTop} ${item.titleAccent}`}
                aria-pressed={index === slide}
                onClick={() => setSlide(index)}
              >
                {index === slide && !reduceMotion && (
                  <span
                    key={`fill-${slide}`}
                    className="mg-progress-fill"
                    style={{ animationDuration: `${HERO_INTERVAL}ms` }}
                  />
                )}
                {index < slide && (
                  <span
                    className="mg-progress-fill"
                    style={{ animation: 'none', transform: 'scaleX(1)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
  onAction,
  secondary,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  secondary?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="mg-empty">
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="15" cy="45" r="8.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="49" cy="45" r="8.5" stroke="currentColor" strokeWidth="2" />
        <path d="M15 45 27 27h9l5 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 27h10M36 35h12l-4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M44 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="mg-h3">{title}</h3>
      <p>{body}</p>
      {(action || secondary) && (
        <div className="mg-empty-actions">
          {secondary?.href && (
            <a className="mg-btn mg-btn--accent" href={secondary.href} target="_blank" rel="noreferrer">
              {secondary.label}
            </a>
          )}
          {secondary && !secondary.href && (
            <button type="button" className="mg-btn mg-btn--accent" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
          {action && onAction && (
            <button type="button" className="mg-btn mg-btn--quiet" onClick={onAction}>
              {action}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* Make → model picker. Years are not tracked in the catalog yet, so the
   selector stops at the model rather than inventing a year dimension. */
export function BikeSelector({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [bikes, setBikes] = useState<BikeModel[]>([]);
  const [brand, setBrand] = useState('');
  const [modelId, setModelId] = useState('');

  useEffect(() => {
    let active = true;
    api.listBikeModels()
      .then((rows) => {
        if (!active) return;
        setBikes(rows);
        setBrand(rows[0]?.brand ?? '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!bikes.length) return null;

  const brands = Array.from(
    new Set(bikes.map((bike) => bike.brand).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));
  const models = bikes.filter((bike) => bike.brand === brand);

  return (
    <div className="mg-bikes" id="shop-by-bike">
      <div className="mg-field">
        <label htmlFor="bike-make">Make</label>
        <select
          id="bike-make"
          className="mg-select"
          value={brand}
          onChange={(event) => {
            setBrand(event.target.value);
            setModelId('');
          }}
        >
          {brands.map((make) => (
            <option key={make} value={make}>{make}</option>
          ))}
        </select>
      </div>

      <div className="mg-field">
        <label htmlFor="bike-model">Model</label>
        <select
          id="bike-model"
          className="mg-select"
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
        >
          <option value="">Select a model</option>
          {models.map((bike) => (
            <option key={bike.id} value={bike.id}>{bike.name}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="mg-btn mg-btn--brand"
        disabled={!modelId}
        onClick={() => onNavigate(`/shop?bike=${encodeURIComponent(modelId)}`)}
      >
        Show parts
        <ArrowRightRegular aria-hidden="true" />
      </button>
    </div>
  );
}

/* Used by the product detail page, which has its own (narrower) layout. */
export function StatePanel({
  state,
  error,
  retry,
  emptyLabel,
}: {
  state: DataState;
  error: string;
  retry: () => void;
  emptyLabel: string;
}) {
  if (state === 'loading') {
    return <ProductGridSkeleton count={4} variant="shop" />;
  }
  if (state === 'error') {
    return (
      <EmptyState
        title="We could not load this page"
        body={error || 'Something went wrong.'}
        action="Try again"
        onAction={retry}
      />
    );
  }
  if (state === 'empty') {
    return (
      <EmptyState
        title={emptyLabel}
        body="Try another view and we will keep the good stuff coming."
      />
    );
  }
  return null;
}
