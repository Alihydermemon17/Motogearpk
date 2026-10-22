import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Badge, Body1, Button, Caption1, createDarkTheme, createLightTheme,
  Divider, FluentProvider, MessageBar, MessageBarBody, Select, Skeleton, SkeletonItem,
  Subtitle1, Title1, Title3,
} from '@fluentui/react-components';
import {
  ArrowRightRegular, CartRegular, ChatRegular, CheckmarkCircleRegular,
  CheckmarkRegular, ChevronLeftRegular, DismissRegular, HeartFilled, HeartRegular, HomeRegular,
  LocationRegular, MailRegular, NavigationRegular, PersonVoiceRegular,
  PhoneRegular, SearchRegular, ShieldCheckmarkRegular, SparkleRegular, TimerRegular,
  VehicleBicycleRegular, WeatherMoonRegular, WeatherSunnyRegular, WrenchRegular,
} from '@fluentui/react-icons';
import { api } from '../api';
import type { AvailabilityStatus, BikeModel, Product } from '../api/types';
import type { User } from '@supabase/supabase-js';
import AdminDashboard from './AdminDashboard';
import { getPublicBusinessSettings } from '../api/admin';
import { formatBusinessMoney, getBusinessDisplaySettings, setBusinessDisplaySettings } from '../lib/businessDisplay';
import {
  AccountPage as CustomerAccountPage,
  CartPage as CustomerCartPage,
  CheckoutPage as CustomerCheckoutPage,
  OrderDetailsPage,
  OrderSuccessPage,
  OrdersPage,
  SignInPage,
  WishlistPage as CustomerWishlistPage,
} from './CustomerPages';
import { useCustomerAuth, useCustomerCart, useCustomerWishlist } from './CustomerState';
import { DeliveryInfo, FaqPage, ProductReviews, SupportPage } from './CustomerTrustPages';
import { ProductImage } from './ProductImage';

/**
 * Fluent UI brand ramp — muted teal.
 * Step 50 is the brand colour; the surrounding steps feed Fluent's foreground,
 * surface and border tokens, so primary buttons, focused inputs, selected pills
 * and brand badges all pick up the teal identity from here.
 */
const brandRamp = {
  10: '#0a1513', 20: '#12241f', 30: '#1a332e', 40: '#23443e',
  50: '#2f6b63', 60: '#2a6059', 70: '#25554e', 80: '#1f4f49',
  90: '#1b453f', 100: '#173b36', 110: '#14322e', 120: '#102926',
  130: '#0d201e', 140: '#091816', 150: '#06100f', 160: '#030908',
};

/* Fluent's own components (buttons, inputs, cards, message bars) resolve their
   type through the theme, not the CSS cascade — so the single body family has
   to be injected here or those components keep the default system stack. */
const fontFamilyBase =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const THEME_KEY = 'motogearpk.theme';
type ThemeMode = 'light' | 'dark';

type DataState = 'data' | 'loading' | 'empty' | 'error';
const money = (value: number) => formatBusinessMoney(value);
const availabilityLabel = (status: AvailabilityStatus) =>
  status === 'AVAILABLE' ? 'Available' : status === 'UNAVAILABLE' ? 'Unavailable' : 'Check required';

/**
 * Every route the storefront actually renders. Anything else falls through to
 * NotFoundPage, so a typo'd or stale URL never produces a blank screen.
 * `/admin` is handled by its own full-screen branch before the shell renders.
 */
const KNOWN_ROUTES: Array<{ path: string; exact: boolean }> = [
  { path: '/', exact: true },
  { path: '/shop', exact: true },
  { path: '/product/', exact: false },
  { path: '/cart', exact: true },
  { path: '/wishlist', exact: true },
  { path: '/checkout', exact: true },
  { path: '/login', exact: true },
  { path: '/signup', exact: true },
  { path: '/account', exact: true },
  { path: '/orders', exact: false },
  { path: '/faq', exact: true },
  { path: '/support', exact: false },
  { path: '/order-success/', exact: false },
];

/** Keep in sync with the conditions inside App's <motion.main>. */
function NotFoundPage({ navigate }: { navigate: (path: string) => void }) {
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

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const [path, setPath] = useState(`${window.location.pathname}${window.location.search}`);
  const [cartNotice, setCartNotice] = useState('');
  const [, setBusinessSettingsRevision] = useState(0);
  const auth = useCustomerAuth();
  const cart = useCustomerCart();
  const wishlist = useCustomerWishlist();

  const toggleTheme = () => {
    const nextTheme: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'dark' ? '#0f1417' : '#f4f3ef');
    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // The active theme still applies when storage is unavailable.
    }
    setThemeMode(nextTheme);
  };

  const navigate = (next: string) => {
    window.history.pushState({}, '', next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPop = () => setPath(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let active = true;
    void getPublicBusinessSettings()
      .then((settings) => {
        if (!active) return;
        setBusinessDisplaySettings({
          businessName: settings.business_name,
          currency: settings.currency,
          deliveryFee: Number(settings.delivery_fee),
          supportPhone: settings.support_phone,
          supportEmail: settings.support_email,
          whatsappNumber: settings.whatsapp_number,
          returnPolicySummary: settings.return_policy_summary,
          defaultWarrantyText: settings.default_warranty_text,
        });
        setBusinessSettingsRevision((revision) => revision + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const route = path.split('?')[0];
  const theme = {
    ...(themeMode === 'dark' ? createDarkTheme(brandRamp) : createLightTheme(brandRamp)),
    fontFamilyBase,
    fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  };

  // The admin console is its own full-screen workspace — no storefront header or footer.
  if (route.startsWith('/admin')) {
    const signOut = () => {
      void auth.signOut().catch(() => undefined).finally(() => navigate('/login'));
    };
    return (
      <FluentProvider theme={theme} className="app-provider admin-provider">
        <AdminGate authLoading={auth.loading} user={auth.user} onNavigate={navigate} onSignOut={signOut}>
          <AdminDashboard path={route} navigate={navigate} onSignOut={signOut} />
        </AdminGate>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={theme} className="app-provider">
      <div className="app-shell">
        <Header
          path={path}
          cartCount={cart.count}
          wishlistCount={wishlist.count}
          signedIn={Boolean(auth.user)}
          isAdmin={auth.user?.app_metadata.role === 'admin'}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onNavigate={navigate}
        />
        {cartNotice && (
          <div className="cart-notice">
            <MessageBar intent="warning">
              <MessageBarBody>{cartNotice}</MessageBarBody>
            </MessageBar>
          </div>
        )}
        <main className="mg-main" key={path}>
          {route === '/' && <HomePage onNavigate={navigate} onAdd={addProduct} />}
          {route === '/shop' && <ShopPage onNavigate={navigate} onAdd={addProduct} />}
          {route.startsWith('/product/') && <ProductPage slug={route.split('/').pop() ?? ''} onNavigate={navigate} onAdd={addProduct} />}
          {route === '/cart' && <CustomerCartPage navigate={navigate} />}
          {route === '/wishlist' && <CustomerWishlistPage navigate={navigate} />}
          {route === '/checkout' && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <CustomerCheckoutPage navigate={navigate} />
            </ProtectedRoute>
          )}
          {(route === '/login' || route === '/signup') && (
            <SignInPage navigate={navigate} signUp={route === '/signup'} loginRequired={path.includes('required=1')} />
          )}
          {route === '/account' && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <CustomerAccountPage navigate={navigate} />
            </ProtectedRoute>
          )}
          {route === '/orders' && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <OrdersPage navigate={navigate} />
            </ProtectedRoute>
          )}
          {route === '/faq' && <FaqPage navigate={navigate} />}
          {route === '/support' && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <SupportPage navigate={navigate} />
            </ProtectedRoute>
          )}
          {route.startsWith('/support/') && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <SupportPage conversationId={route.split('/').pop() ?? ''} navigate={navigate} />
            </ProtectedRoute>
          )}
          {route.startsWith('/orders/') && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <OrderDetailsPage orderId={route.split('/').pop() ?? ''} />
            </ProtectedRoute>
          )}
          {route.startsWith('/order-success/') && (
            <ProtectedRoute authLoading={auth.loading} signedIn={Boolean(auth.user)} navigate={navigate}>
              <OrderSuccessPage orderId={route.split('/').pop() ?? ''} navigate={navigate} />
            </ProtectedRoute>
          )}
          {!KNOWN_ROUTES.some((known) => (known.exact ? route === known.path : route.startsWith(known.path))) && (
            <NotFoundPage navigate={navigate} />
          )}
        </main>
        <Footer onNavigate={navigate} />
      </div>
    </FluentProvider>
  );

  function addProduct(product: Product) {
    if (!isAvailable(product)) {
      setCartNotice(`${product.name} is not currently available and was not added.`);
      return;
    }
    setCartNotice('');
    cart.add(product.id);
  }
}

/* --------------------------------------------------------------------------
   Storefront chrome
   The top bar and header are one sticky unit: scrolling collapses the top bar
   so the header shrinks to 72px (64px on mobile) and the shop filter bar can
   sit right underneath it.
   -------------------------------------------------------------------------- */

const TOPBAR_NOTICES = [
  { icon: <LocationRegular aria-hidden="true" />, label: 'Nationwide cash on delivery' },
  { icon: <CheckmarkCircleRegular aria-hidden="true" />, label: '7-day easy returns' },
  { icon: <PersonVoiceRegular aria-hidden="true" />, label: 'Support 9am – 9pm, 7 days' },
] as const;

function Header({
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
                <button
                  key={tile.label}
                  type="button"
                  className="mg-nav-menu-item"
                  onClick={() => go(`/shop?category=${encodeURIComponent(tile.label)}`)}
                >
                  {tile.label}
                  <span>{tile.hint}</span>
                </button>
              ))}
              <button type="button" className="mg-nav-menu-item" onClick={() => go('/shop')}>
                All products
                <span>Full catalog</span>
              </button>
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

function ProtectedRoute({
  authLoading,
  signedIn,
  navigate,
  children,
}: {
  authLoading: boolean;
  signedIn: boolean;
  navigate: (path: string) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!authLoading && !signedIn) navigate('/login?required=1');
  }, [authLoading, signedIn]);
  if (authLoading || !signedIn) {
    return (
      <div className="page-content narrow">
        <Skeleton>
          <SkeletonItem size={24} />
          <SkeletonItem />
          <SkeletonItem />
        </Skeleton>
      </div>
    );
  }
  return children;
}

function AdminGate({
  authLoading,
  user,
  onNavigate,
  onSignOut,
  children,
}: {
  authLoading: boolean;
  user: User | null;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  if (authLoading) {
    return (
      <div className="admin-gate" role="status">
        <span className="admin-gate-mark" aria-hidden="true">MG</span>
        <strong>Opening the admin console</strong>
        <span className="admin-gate-sub">Verifying administrator access…</span>
      </div>
    );
  }
  if (user?.app_metadata.role !== 'admin') {
    return (
      <div className="admin-gate">
        <span className="admin-gate-mark" aria-hidden="true">MG</span>
        <Title3 as="h1">Administrator access required</Title3>
        <Body1 className="admin-gate-sub">
          This operations workspace is limited to MotoGear PK administrators. Sign in with an admin
          account to continue.
        </Body1>
        <div className="admin-gate-actions">
          <Button appearance="primary" icon={<HomeRegular />} onClick={() => onNavigate('/')}>
            Back to the store
          </Button>
          <Button appearance="secondary" onClick={onSignOut}>
            Switch account
          </Button>
        </div>
      </div>
    );
  }
  return children;
}

/* Reduced-motion is read as state rather than a constant so a user changing the
   OS preference mid-session is respected without a reload. */
function usePrefersReducedMotion() {
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
const HERO_SLIDES = [
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

const HERO_INTERVAL = 6000;

/* Mirrors the `categories` table — tiles deep-link into the filtered shop view.
   Counts are computed from the live catalog, never hardcoded. */
const CATEGORY_TILES = [
  { label: 'Lighting & Electrics', hint: 'LED bulbs, projectors, DRL', image: '/img/cat-lighting.jpg' },
  { label: 'Riding Gear', hint: 'Helmets, gloves, protection', image: '/img/cat-gear.jpg' },
  { label: 'Performance Parts', hint: 'Exhausts, filters, controls', image: '/img/cat-performance.jpg' },
  { label: 'Bike Care & Accessories', hint: 'Lubes, covers, maintenance', image: '/img/cat-care.jpg' },
] as const;

function Hero({ onNavigate }: { onNavigate: (path: string) => void }) {
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

/* Progressive-enhancement reveal: the element renders fully visible, and only
   an element that starts below the fold is "armed" (hidden) before the
   IntersectionObserver plays its 250ms fade. A 1.5s failsafe guarantees content
   can never stay hidden if the observer never fires. */
function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
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

function TrustStrip() {
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

function SectionHeading({
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

function ProductGrid({
  products,
  onNavigate,
  onAdd,
  variant = 'shop',
}: {
  products: Product[];
  onNavigate: (path: string) => void;
  onAdd: (product: Product) => void;
  variant?: 'home' | 'shop';
}) {
  return (
    <div className={`mg-grid mg-grid--${variant}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onNavigate={onNavigate} onAdd={onAdd} />
      ))}
    </div>
  );
}

function ProductGridSkeleton({ count = 4, variant = 'shop' }: { count?: number; variant?: 'home' | 'shop' }) {
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

function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
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
      {action && onAction && (
        <button type="button" className="mg-btn mg-btn--quiet" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

/* Make → model picker. Years are not tracked in the catalog yet, so the
   selector stops at the model rather than inventing a year dimension. */
function BikeSelector({ onNavigate }: { onNavigate: (path: string) => void }) {
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

function PromiseBand() {
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

function CtaBand({ onNavigate }: { onNavigate: (path: string) => void }) {
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

function HomePage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
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
                return (
                  <button
                    key={tile.label}
                    type="button"
                    className="mg-cat"
                    onClick={() => onNavigate(`/shop?category=${encodeURIComponent(tile.label)}`)}
                  >
                    <img src={tile.image} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    <span className="mg-cat-arrow" aria-hidden="true">
                      <ArrowRightRegular />
                    </span>
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

function ShopPage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
  const { products, state, error, retry } = useProducts();
  const params = new URLSearchParams(window.location.search);
  const [category, setCategory] = useState(params.get('category') ?? 'All');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [bikeId, setBikeId] = useState<string | null>(params.get('bike'));
  const [bikeName, setBikeName] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    let active = true;
    api.listCategories()
      .then((rows) => { if (active) setCategories(['All', ...rows.map((row) => row.name)]); })
      .catch(() => { /* keep the default All-only filter */ });
    return () => { active = false; };
  }, []);

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

  // Once categories are known, a deep link that names a removed category falls back to All.
  useEffect(() => {
    if (categories.length <= 1) return;
    if (category !== 'All' && !categories.includes(category)) setCategory('All');
  }, [categories, category]);

  // Filters are additive, so every URL change has to re-emit the whole state —
  // otherwise picking a category silently drops a bike or search deep link.
  const syncUrl = (next: { category?: string; bike?: string | null }) => {
    const params = new URLSearchParams();
    const nextCategory = next.category ?? category;
    const nextBike = next.bike === undefined ? bikeId : next.bike;
    if (nextCategory !== 'All') params.set('category', nextCategory);
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
        (category === 'All' || product.category === category) &&
        (!bikeId || (product.compatibleBikes ?? []).some((bike) => bike.id === bikeId)) &&
        (!search ||
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.brand?.toLowerCase().includes(search.toLowerCase())),
    ),
    sort,
  );

  const hasActiveFilters = category !== 'All' || search.trim() !== '' || Boolean(bikeId);

  const clearFilters = () => {
    setCategory('All');
    setSearch('');
    setBikeId(null);
    setSort('featured');
    window.history.replaceState({}, '', '/shop');
  };

  return (
    <>
      <div className="mg-container mg-shop-head">
        <p className="mg-kicker">Motorcycle accessories &amp; parts</p>
        <h1 className="mg-h1" style={{ marginTop: 10 }}>Parts for every ride.</h1>
        <p>
          Lighting, controls, protective gear and road-ready essentials — with the fitment and
          availability each listing actually records.
        </p>
      </div>

      <div className="mg-filterbar">
        <div className="mg-filterbar-row">
          <div className="mg-search-field">
            <SearchRegular aria-hidden="true" />
            <input
              className="mg-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`mg-pill${category === cat ? ' is-active' : ''}`}
              aria-pressed={category === cat}
              onClick={() => selectCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <div className="mg-active-filters">
            <span>Filtered by</span>
            {category !== 'All' && (
              <span className="mg-chip">
                {category}
                <button
                  type="button"
                  onClick={() => selectCategory('All')}
                  aria-label={`Clear category ${category}`}
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
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <DismissRegular />
                </button>
              </span>
            )}
            <button type="button" className="mg-clear" onClick={clearFilters}>Clear all</button>
          </div>
        )}
      </div>

      <div className="mg-container mg-shop-grid-wrap">
        <section aria-labelledby="shop-results-title">
          <h2 className="mg-sr-only" id="shop-results-title">
            {category === 'All' ? 'All products' : category}
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
              title="Nothing matches those filters"
              body="Try a different category or bike, or clear the filters to see the full catalog."
              action="Clear filters"
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

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

function applyCatalogSort(items: Product[], sort: SortKey): Product[] {
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

function ProductPage({
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

function ProductCard({
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

function useProducts() {
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

/* Used by the product detail page, which has its own (narrower) layout. */
function StatePanel({
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

function Footer({ onNavigate }: { onNavigate: (path: string) => void }) {
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
function TruckDeliveryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.9" />
      <circle cx="17.5" cy="18" r="1.9" />
    </svg>
  );
}

function isAvailable(product: Product): boolean {
  if (product.availabilityStatus) return product.availabilityStatus === 'AVAILABLE';
  const status = product.status.toUpperCase();
  return (
    !status.includes('UNAVAILABLE') &&
    !status.includes('LIMITED') &&
    !status.includes('LOW STOCK') &&
    !status.includes('CHECK REQUIRED')
  );
}

export default App;
