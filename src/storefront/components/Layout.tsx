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
import { getBusinessDisplaySettings } from '../../lib/businessDisplay';
import { CATEGORY_TILES, usePrefersReducedMotion } from '../shared';
import type { ThemeMode } from '../shared';

/** Keep in sync with the conditions inside App's <motion.main>. */
export function NotFoundPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="page-content narrow not-found-page">
      <Caption1 className="section-kicker">404 / PAGE NOT FOUND</Caption1>
        <Title1 as="h1">This page took a wrong turn.</Title1>
      <Body1>
        The link may be old, or the page moved. Pick a route below and we will get you back on the road.
      </Body1>
      <div className="not-found-actions">
        <Button appearance="primary" icon={<ArrowRightRegular />} iconPosition="after" onClick={() => navigate('/')}>
          Back to home
        </Button>
        <Button appearance="secondary" onClick={() => navigate('/shop')}>Browse the catalog</Button>
        <Button appearance="subtle" onClick={() => navigate('/support')}>Contact support</Button>
      </div>
      <div className="not-found-links">
        <button type="button" onClick={() => navigate('/orders')}>Track an order</button>
        <button type="button" onClick={() => navigate('/account')}>My account</button>
        <button type="button" onClick={() => navigate('/faq')}>FAQs</button>
        <button type="button" onClick={() => navigate('/wishlist')}>Wishlist</button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Storefront chrome
   The top bar and header are one sticky unit: scrolling collapses the top bar
   so the header shrinks to 72px (64px on mobile) and the shop filter bar can
   sit right underneath it.
   -------------------------------------------------------------------------- */

export const TOPBAR_NOTICES = [
  { icon: <LocationRegular aria-hidden="true" />, label: 'Nationwide cash on delivery' },
  { icon: <CheckmarkCircleRegular aria-hidden="true" />, label: '7-day easy returns' },
  { icon: <PersonVoiceRegular aria-hidden="true" />, label: 'Support 9am – 9pm, 7 days' },
] as const;

export function Header({
  path,
  cartCount,
  wishlistCount,
  signedIn,
  isAdmin,
  themeMode,
  onToggleTheme,
  onNavigate,
}: {
  path: string;
  cartCount: number;
  wishlistCount: number;
  signedIn: boolean;
  isAdmin: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(0);
  const burgerRef = useRef<HTMLButtonElement | null>(null);
  const business = getBusinessDisplaySettings();
  const route = path.split('?')[0];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // One rotating message on mobile, three static ones on desktop. Rotation is
  // skipped entirely under prefers-reduced-motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(
      () => setNotice((current) => (current + 1) % TOPBAR_NOTICES.length),
      4500,
    );
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setCatOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Panels are modal on phones: stop the page behind them from scrolling, and
  // hand focus back to the control that opened the drawer when it closes.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !menuOpen) burgerRef.current?.focus();
    wasOpen.current = menuOpen;
  }, [menuOpen]);

  const go = (next: string) => {
    setMenuOpen(false);
    setCatOpen(false);
    onNavigate(next);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    go(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop');
  };

  const navItems = [
    { label: 'Home', path: '/', active: route === '/' },
    { label: 'Shop', path: '/shop', active: route === '/shop' },
    {
      label: 'Track order',
      path: '/orders',
      active: route === '/orders' || route.startsWith('/orders/'),
    },
  ];

  return (
    <header className={`mg-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="mg-topbar">
        <div className="mg-topbar-inner">
          <div className="mg-topbar-desktop">
            {TOPBAR_NOTICES.map((item, index) => (
              <Fragment key={item.label}>
                {index > 0 && <span className="mg-topbar-dot" aria-hidden="true" />}
                <span className="mg-topbar-item">
                  {item.icon}
                  {item.label}
                </span>
              </Fragment>
            ))}
          </div>
          <span className="mg-topbar-item mg-topbar-mobile">
            {TOPBAR_NOTICES[notice].icon}
            {TOPBAR_NOTICES[notice].label}
          </span>
        </div>
      </div>

      <div className="mg-header-inner">
        <button
          type="button"
          className="mg-logo"
          onClick={() => go('/')}
          aria-label="MotoGear PK home"
        >
          <span className="mg-logo-mark" aria-hidden="true">MG</span>
          <span className="mg-logo-text">
            MotoGear <span className="mg-logo-tag">PK</span>
          </span>
        </button>

        <nav className="mg-nav" aria-label="Main navigation">
          {navItems.slice(0, 2).map((item) => (
            <button
              key={item.path}
              type="button"
              className={`mg-nav-link${item.active ? ' is-active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
              onClick={() => go(item.path)}
            >
              {item.label}
            </button>
          ))}

          <div
            className={`mg-nav-menu-wrap${catOpen ? ' is-open' : ''}`}
            onMouseLeave={() => setCatOpen(false)}
          >
            <button
              type="button"
              className="mg-nav-link"
              aria-haspopup="true"
              aria-expanded={catOpen}
              onClick={() => setCatOpen((open) => !open)}
              onFocus={() => setCatOpen(true)}
            >
              Categories
              <span className="mg-nav-caret" aria-hidden="true" />
            </button>
            <div className="mg-nav-menu">
              {CATEGORY_TILES.map((tile) => (
                <a
                  key={tile.label}
                  className="mg-nav-menu-item"
                  href={`/shop?category=${encodeURIComponent(tile.slug)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    go(`/shop?category=${encodeURIComponent(tile.slug)}`);
                  }}
                >
                  {tile.label}
                  <span>{tile.hint}</span>
                </a>
              ))}
              <a
                className="mg-nav-menu-item"
                href="/shop"
                onClick={(event) => {
                  event.preventDefault();
                  go('/shop');
                }}
              >
                All products
                <span>Full catalog</span>
              </a>
            </div>
          </div>

          <button
            type="button"
            className={`mg-nav-link${navItems[2].active ? ' is-active' : ''}`}
            aria-current={navItems[2].active ? 'page' : undefined}
            onClick={() => go(navItems[2].path)}
          >
            {navItems[2].label}
          </button>
        </nav>

        <div className="mg-tools">
          <form className="mg-search" role="search" onSubmit={submitSearch}>
            <SearchRegular aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search parts…"
              aria-label="Search products"
            />
          </form>

          <button
            type="button"
            className="mg-icon-btn mg-hide-sm"
            onClick={onToggleTheme}
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
          >
            {themeMode === 'dark' ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
          </button>

          <button
            type="button"
            className={`mg-icon-btn mg-hide-sm${route === '/wishlist' ? ' is-active' : ''}`}
            onClick={() => go('/wishlist')}
            aria-label={`Wishlist, ${wishlistCount} ${wishlistCount === 1 ? 'item' : 'items'}`}
            title="Wishlist"
          >
            {wishlistCount > 0 ? <HeartFilled /> : <HeartRegular />}
            {wishlistCount > 0 && <span className="mg-count">{wishlistCount}</span>}
          </button>

          {isAdmin && (
            <button
              type="button"
              className="mg-icon-btn mg-hide-sm"
              onClick={() => go('/admin')}
              aria-label="Open the admin console"
              title="Admin console"
            >
              <ShieldCheckmarkRegular />
              <span>Admin</span>
            </button>
          )}

          <button
            type="button"
            className="mg-cart"
            onClick={() => go('/cart')}
            aria-label={`Shopping cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
          >
            <CartRegular />
            <span className="mg-cart-label">Cart</span>
            <span className="mg-count">{cartCount}</span>
          </button>

          <button
            type="button"
            className="mg-icon-btn mg-burger"
            ref={burgerRef}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mg-mobile-drawer"
          >
            {menuOpen ? <DismissRegular /> : <NavigationRegular />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            className="mg-drawer-backdrop is-open"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="mg-mobile-drawer"
            className="mg-drawer is-open"
            aria-label="Menu"
          >
            <div className="mg-drawer-head">
              <span className="mg-logo-text">
                MotoGear <span className="mg-logo-tag">PK</span>
              </span>
              <button
                type="button"
                className="mg-icon-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                autoFocus
              >
                <DismissRegular />
              </button>
            </div>

            <form className="mg-drawer-search" role="search" onSubmit={submitSearch}>
              <SearchRegular aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search parts, helmets, exhausts…"
                aria-label="Search products"
              />
            </form>

            <div className="mg-drawer-links">
              {[
                { label: 'Home', path: '/' },
                { label: 'Shop all products', path: '/shop' },
                { label: 'Track order', path: '/orders' },
                { label: signedIn ? 'My account' : 'Sign in', path: signedIn ? '/account' : '/login' },
                { label: 'Wishlist', path: '/wishlist' },
                { label: 'FAQs', path: '/faq' },
                { label: 'Customer support', path: '/support' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="mg-drawer-link"
                  onClick={() => go(item.path)}
                >
                  {item.label}
                  <ArrowRightRegular aria-hidden="true" />
                </button>
              ))}
              {isAdmin && (
                <button type="button" className="mg-drawer-link" onClick={() => go('/admin')}>
                  Admin console
                  <ShieldCheckmarkRegular aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="mg-drawer-foot">
              <button
                type="button"
                className="mg-btn mg-btn--quiet"
                onClick={onToggleTheme}
              >
                {themeMode === 'dark' ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
                {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              {business.supportPhone && (
                <a
                  className="mg-btn mg-btn--brand"
                  href={`tel:${business.supportPhone.replace(/[^0-9+]/g, '')}`}
                >
                  <PhoneRegular />
                  {business.supportPhone}
                </a>
              )}
            </div>
          </aside>
        </>
      )}
    </header>
  );
}

/* Progressive-enhancement reveal: the element renders fully visible, and only
   an element that starts below the fold is "armed" (hidden) before the
   IntersectionObserver plays its 250ms fade. A 1.5s failsafe guarantees content
   can never stay hidden if the observer never fires. */
export function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const start = element.getBoundingClientRect().top;
    if (start < window.innerHeight * 0.92) return;

    element.classList.add('is-pending');

    const reveal = () => {
      element.classList.remove('is-pending');
      element.classList.add('is-in');
    };

    const failsafe = window.setTimeout(reveal, 1500);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          window.clearTimeout(failsafe);
          observer.disconnect();
          reveal();
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
    );
    observer.observe(element);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`mg-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}

export function TrustStrip() {
  const items = [
    { icon: <LocationRegular />, title: 'Nationwide cash on delivery', text: 'Pay when the parcel reaches you.' },
    { icon: <CheckmarkCircleRegular />, title: '7-day easy returns', text: 'Unused, in the original packaging.' },
    { icon: <VehicleBicycleRegular />, title: 'Fitment you can check', text: 'Each listing names the bikes it fits.' },
    { icon: <PersonVoiceRegular />, title: 'Support 9am – 9pm', text: 'Real people, seven days a week.' },
  ];

  return (
    <div className="mg-trust">
      <div className="mg-trust-inner">
        {items.map((item) => (
          <div className="mg-trust-item" key={item.title}>
            <span className="mg-trust-icon" aria-hidden="true">{item.icon}</span>
            <span>
              <b>{item.title}</b>
              <span>{item.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  action,
  onAction,
}: {
  kicker: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mg-section-head">
      <div className="mg-section-head-copy">
        <p className="mg-kicker">{kicker}</p>
        <h2 className="mg-h2">{title}</h2>
      </div>
      {action && onAction && (
        <button type="button" className="mg-section-link" onClick={onAction}>
          {action}
          <ArrowRightRegular aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function PromiseBand() {
  const features = [
    {
      icon: <ShieldCheckmarkRegular />,
      title: 'Warranty on record',
      text: 'Supplier warranty terms are stored against every listing, so coverage is never a maybe.',
    },
    {
      icon: <TimerRegular />,
      title: 'Dispatch you can follow',
      text: 'Every order carries a tracking view from confirmed through to delivered.',
    },
    {
      icon: <WrenchRegular />,
      title: 'Live supplier availability',
      text: 'Availability comes from current supplier data rather than an invented stock number.',
    },
    {
      icon: <LocationRegular />,
      title: 'Delivered nationwide',
      text: 'We ship across Pakistan and show the real delivery fee before you confirm.',
    },
  ];

  return (
    <section className="mg-band" aria-labelledby="why-riders">
      <img
        className="mg-band-bg"
        src="/img/band-riders.jpg"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
      <div className="mg-band-veil" aria-hidden="true" />
      <div className="mg-band-inner mg-container">
        <div className="mg-band-head">
          <p className="mg-kicker">Why riders pick us</p>
          <h2 className="mg-h2" id="why-riders">Built around the way Pakistan rides.</h2>
          <p className="mg-body">
            Long highway runs, monsoon commutes, weekend trails. We stock what survives them —
            and we tell you what fits before you pay.
          </p>
        </div>

        <div className="mg-features">
          {features.map((feature) => (
            <div className="mg-feature" key={feature.title}>
              <span className="mg-feature-icon" aria-hidden="true">{feature.icon}</span>
              <b>{feature.title}</b>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ onNavigate }: { onNavigate: (path: string) => void }) {
  const business = getBusinessDisplaySettings();
  const whatsapp = business.whatsappNumber?.replace(/[^0-9]/g, '');

  return (
    <section className="mg-cta" aria-labelledby="cta-title">
      <img
        className="mg-cta-bg"
        src="/img/cta-workshop.jpg"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
      <div className="mg-cta-veil" aria-hidden="true" />
      <div className="mg-cta-inner">
        <div className="mg-cta-copy">
          <p className="mg-kicker">Not sure what fits?</p>
          <h2 className="mg-h2" id="cta-title">Tell us your bike. We will shortlist the parts.</h2>
          <p className="mg-body">
            Send your make and model on WhatsApp and we will point you at parts confirmed to fit it.
          </p>
        </div>
        <div className="mg-cta-actions">
          {whatsapp && (
            <a
              className="mg-btn mg-btn--accent"
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <ChatRegular aria-hidden="true" />
              Ask on WhatsApp
            </a>
          )}
          <a
            className="mg-btn mg-btn--ghost"
            href="/shop"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/shop');
            }}
          >
            Browse catalog
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer({ onNavigate }: { onNavigate: (path: string) => void }) {
  const business = getBusinessDisplaySettings();
  const phone = business.supportPhone?.trim();
  const email = business.supportEmail?.trim();
  const whatsapp = business.whatsappNumber?.trim();

  return (
    <footer className="mg-footer">
      <div className="mg-container">
        <div className="mg-footer-grid">
          <div className="mg-footer-brand-col">
            <button
              type="button"
              className="mg-footer-brand"
              onClick={() => onNavigate('/')}
              aria-label="MotoGear PK home"
            >
              <span className="mg-logo-mark" aria-hidden="true">MG</span>
              <span className="mg-logo-text">
                MotoGear <span className="mg-logo-tag">PK</span>
              </span>
            </button>
            <p className="mg-footer-desc">
              Motorcycle parts and accessories for riders in Pakistan. Product fitment,
              warranty and availability details are shown when recorded.
            </p>
          </div>

          <div>
            <h2 className="mg-footer-title">Shop</h2>
            <div className="mg-footer-links">
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/')}>Home</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/shop')}>All products</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/shop?category=Riding%20Gear')}>Riding gear</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/shop?category=Lighting%20%26%20Electrics')}>Lighting &amp; electrics</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/wishlist')}>Wishlist</button>
            </div>
          </div>

          <div>
            <h2 className="mg-footer-title">Account</h2>
            <div className="mg-footer-links">
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/account')}>My account</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/orders')}>Track an order</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/cart')}>Shopping cart</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/faq')}>FAQs</button>
              <button type="button" className="mg-footer-link" onClick={() => onNavigate('/support')}>Customer support</button>
            </div>
          </div>

          <div className="mg-footer-contact-col">
            <h2 className="mg-footer-title">Talk to us</h2>
            <p className="mg-footer-note">
              Order questions, fitment checks and returns — answered 9am to 9pm, seven days a week.
            </p>
            <ul className="mg-footer-contact">
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>
                    <PhoneRegular aria-hidden="true" />
                    <span><small>Call us</small><b>{phone}</b></span>
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">
                    <ChatRegular aria-hidden="true" />
                    <span><small>WhatsApp</small><b>{whatsapp}</b></span>
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`}>
                    <MailRegular aria-hidden="true" />
                    <span><small>Email</small><b>{email}</b></span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mg-footer-bottom">
          <span>© 2026 {business.businessName}. All rights reserved.</span>
          <strong>Ride with intent</strong>
        </div>
      </div>
    </footer>
  );
}

/* Small inline delivery glyph — keeps the footer free of a heavy icon import. */
export function TruckDeliveryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.9" />
      <circle cx="17.5" cy="18" r="1.9" />
    </svg>
  );
}
