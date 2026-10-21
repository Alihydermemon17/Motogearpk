import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Badge, Body1, Button, Card, CardPreview, Caption1, createDarkTheme, createLightTheme,
  Divider, FluentProvider, Input, MessageBar, MessageBarBody, Select, Skeleton, SkeletonItem,
  Subtitle1, Title1, Title2, Title3,
} from '@fluentui/react-components';
import { Option } from './SelectOption';
import {
  ArrowRightRegular, ArrowUpRightRegular, CartRegular, ChatRegular, CheckmarkCircleRegular,
  ChevronLeftRegular, DismissRegular, HeartFilled, HeartRegular, HomeRegular, LocationRegular,
  MailRegular, MoneyRegular, NavigationRegular, PersonRegular, PersonVoiceRegular, PhoneRegular,
  RocketRegular, SearchRegular, ShieldCheckmarkRegular, SparkleRegular, TimerRegular,
  VehicleBicycleRegular, WeatherMoonRegular, WeatherSunnyRegular, WrenchRegular,
} from '@fluentui/react-icons';
import { api } from '../api';
import type { AvailabilityStatus, Product } from '../api/types';
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
  10: '#0e1a19', 20: '#17302e', 30: '#204340', 40: '#2e5c58',
  50: '#477c78', 60: '#417370', 70: '#3b6a67', 80: '#35615e',
  90: '#2e5754', 100: '#274c4a', 110: '#1f3f3d', 120: '#173130',
  130: '#102423', 140: '#0a1918', 150: '#05100f', 160: '#020807',
};
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
  const reduceMotion = useReducedMotion();

  const toggleTheme = () => {
    const nextTheme: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'dark' ? '#171e22' : '#f4f3ef');
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
  const theme = themeMode === 'dark' ? createDarkTheme(brandRamp) : createLightTheme(brandRamp);

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
        <motion.main key={path} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}>
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
        </motion.main>
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
  const business = getBusinessDisplaySettings();
  const route = path.split('?')[0];

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="topbar-inner">
          <span className="topbar-item"><LocationRegular /><b>Nationwide Cash on Delivery</b></span>
          <span className="topbar-dot" aria-hidden="true" />
          <span className="topbar-item"><CheckmarkCircleRegular />7-Day Easy Returns</span>
          <span className="topbar-dot" aria-hidden="true" />
          <span className="topbar-item"><PersonRegular /> Support ·9am – 9pm</span>
        </div>
      </div>
      <div className="header-inner">
        <button
          type="button"
          className="brand-button"
          onClick={() => onNavigate('/')}
          aria-label="MotoGear PK home"
        >
          <span className="brand-mark">MG</span>
          <span className="brand-name">
            MOTOGEAR <b>PK</b>
          </span>
        </button>

        <nav
          id="main-navigation"
          className={`header-nav${menuOpen ? ' is-open' : ''}`}
          aria-label="Main navigation"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setMenuOpen(false);
              document.querySelector<HTMLButtonElement>('.mobile-menu-toggle')?.focus();
            }
          }}
        >
          <Button
            appearance="subtle"
            icon={<HomeRegular />}
            onClick={() => { setMenuOpen(false); onNavigate('/'); }}
            className={`nav-link-btn${route === '/' ? ' is-active' : ''}`}
          >
            Home
          </Button>
          <Button
            appearance="subtle"
            icon={<SearchRegular />}
            onClick={() => { setMenuOpen(false); onNavigate('/shop'); }}
            className={`nav-link-btn${route === '/shop' ? ' is-active' : ''}`}
          >
            Shop
          </Button>
          <Button
            appearance="subtle"
            icon={<PersonRegular />}
            onClick={() => { setMenuOpen(false); onNavigate(signedIn ? '/account' : '/login'); }}
            className={`nav-link-btn${route === '/account' || route.startsWith('/orders') ? ' is-active' : ''}`}
          >
            {signedIn ? 'My Account' : 'Sign In'}
          </Button>
          {isAdmin && (
            <Button
              appearance="primary"
              icon={<ShieldCheckmarkRegular />}
              onClick={() => { setMenuOpen(false); onNavigate('/admin'); }}
              className="nav-link-btn nav-admin-btn"
            >
              Admin
            </Button>
          )}
        </nav>

        <div className="header-actions">
          <Button
            appearance="subtle"
            className="mobile-menu-toggle"
            icon={menuOpen ? <DismissRegular /> : <NavigationRegular />}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls="main-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          />
          <Button
            appearance="subtle"
            className="theme-toggle"
            icon={themeMode === 'dark' ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            onClick={onToggleTheme}
          />
          <Button
            appearance="subtle"
            className="header-icon-btn"
            icon={<SearchRegular />}
            onClick={() => onNavigate('/shop')}
            aria-label="Search products"
            title="Search products"
          />

          <span className="header-sep" aria-hidden="true" />

          <Button
            appearance="subtle"
            className={`wishlist-button${route === '/wishlist' ? ' is-active' : ''}${wishlistCount > 0 ? ' has-items' : ''}`}
            icon={wishlistCount > 0 ? <HeartFilled /> : <HeartRegular />}
            onClick={() => onNavigate('/wishlist')}
            aria-label={`Wishlist with ${wishlistCount} ${wishlistCount === 1 ? 'item' : 'items'}`}
            title="Wishlist"
          >
            <span className="button-label">Wishlist</span>
            {wishlistCount > 0 && (
              <Badge key={wishlistCount} className="wishlist-count" appearance="filled" color="danger" shape="circular">
                {wishlistCount}
              </Badge>
            )}
          </Button>

          <Button
            appearance="primary"
            icon={<CartRegular />}
            onClick={() => onNavigate('/cart')}
            className="cart-button"
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <span className="button-label">Cart</span>
            <Badge key={cartCount} className="cart-count" appearance="filled" color="important" shape="circular">
              {cartCount}
            </Badge>
          </Button>
        </div>
      </div>
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

const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1750203926587-3fbec7edf6c0?w=1600&auto=format&fit=crop&q=80', // 1st: Car LED dark bg
    eyebrow: 'CAR LED LIGHTING · PLUG & PLAY',
    titleTop: 'Light up every',
    titleAccent: 'night drive.',
    body: "Premium LED headlights, fog lamps, and DRL upgrades for cars — crisp white output engineered for Pakistan's roads and long highway runs.",
  },
  {
    image: 'https://images.unsplash.com/photo-1709072245768-3cd68e00fbd9?w=1600&auto=format&fit=crop&q=80', // 2nd: Jeep LED dark bg
    eyebrow: 'OFF-ROAD & 4X4 READY',
    titleTop: 'Built tough for',
    titleAccent: 'every terrain.',
    body: 'Heavy-duty LED light bars and spotlights for jeeps and 4x4s — ready for mud, mountains, and everything in between.',
  },
  {
    image: 'https://images.unsplash.com/photo-1736831900899-ac248a3db63d?w=1600&auto=format&fit=crop&q=80', // 3rd: Bike LED dark bg
    eyebrow: 'BUILT FOR THE WAY YOU RIDE IN PAKISTAN',
    titleTop: 'Find your next',
    titleAccent: 'great ride.',
    body: "Premium motorcycle accessories, performance parts, and protective gear engineered for Pakistan's roads and high-mileage riders.",
  },
];

const HERO_INTERVAL = 6000;

/* Mirrors the `categories` table — tiles deep-link into the filtered shop view. */
const CATEGORY_TILES = [
  { label: 'Lighting & Electrics', hint: 'LED bulbs, projectors, DRL', icon: <SparkleRegular /> },
  { label: 'Riding Gear', hint: 'Helmets, gloves, protection', icon: <ShieldCheckmarkRegular /> },
  { label: 'Performance Parts', hint: 'Exhausts, filters, controls', icon: <RocketRegular /> },
  { label: 'Bike Care & Accessories', hint: 'Lubes, covers, maintenance', icon: <WrenchRegular /> },
] as const;

function Hero({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [slide, setSlide] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), HERO_INTERVAL);
    return () => clearInterval(timer);
  }, [slide]);

  return (
    <Card className="hero-card">
      <div className="hero-slides">
        {HERO_SLIDES.map((item, i) => (
          <img
            key={i}
            className={`hero-slide${i === slide ? ' active' : ''}`}
            src={item.image}
            alt=""
            aria-hidden="true"
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
      <div className="hero-overlay" aria-hidden="true" />
      <div className="hero-mesh" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />

      <div className="hero-copy">
        <div className="hero-copy-stack">
          {HERO_SLIDES.map((item, i) => (
            <div
              key={i}
              className={`hero-copy-slide${i === slide ? ' active' : ''}`}
              aria-hidden={i !== slide}
              // Inert keeps the off-screen copy out of the tab order and hit testing.
              inert={i !== slide}
            >
              <div className="eyebrow">
                <SparkleRegular /> {item.eyebrow}
              </div>
              {/* The first slide carries the page's only h1; the rest are h2s so
                  the document outline has a single top-level heading even though
                  every slide stays mounted. Off-screen slides are aria-hidden and
                  inert, so assistive tech only ever reads the active one. */}
              <Title1 as={i === 0 ? 'h1' : 'h2'}>
                {item.titleTop}<br />
                <span>{item.titleAccent}</span>
              </Title1>
              <Body1>{item.body}</Body1>
            </div>
          ))}
        </div>

        <div className="hero-actions">
          <Button
            appearance="primary"
            size="large"
            icon={<ArrowRightRegular />}
            iconPosition="after"
            onClick={() => onNavigate('/shop')}
          >
            Explore the collection
          </Button>
          <Button
            appearance="secondary"
            size="large"
            onClick={() => onNavigate('/product/h4-mini-projector-lens-led-headlight')}
          >
            View H4 LED Projector
          </Button>
        </div>

        <div className="hero-foot">
          <div className="hero-dots" role="group" aria-label="Hero slides">
            {HERO_SLIDES.map((item, i) => (
              <button
                key={i}
                type="button"
                className={`hero-dot${i === slide ? ' active' : ''}`}
                aria-label={`Show slide ${i + 1}: ${item.titleTop} ${item.titleAccent}`}
                aria-pressed={i === slide}
                onClick={() => setSlide(i)}
              >
                {!reduceMotion && i === slide && <span className="hero-dot-progress" key={`${slide}-${reduceMotion}`} />}
              </button>
            ))}
          </div>
          <span className="hero-counter" aria-hidden="true">
            <b>{String(slide + 1).padStart(2, '0')}</b>
            <i />
            <span>{String(HERO_SLIDES.length).padStart(2, '0')}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

function HomePage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
  const { products: featured, state, error, retry } = useProducts(true);

  return (
    <div className="page-content">
      <ScrollReveal><Hero onNavigate={onNavigate} /></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.04}><div className="trust-strip">
        <Trust
          icon={<VehicleBicycleRegular />}
          title="Fitment you can trust"
          text="Every part lists the bikes it actually fits — no guesswork before you buy."
        />
        <Trust
          icon={<LocationRegular />}
          title="Nationwide Cash on Delivery"
          text="Pay in hand when your order arrives, anywhere in Pakistan."
        />
        <Trust
          icon={<CheckmarkCircleRegular />}
          title="Real availability status"
          text="Live supplier stock is shown on every product page before you order."
        />
      </div></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.05}><section className="category-band" aria-label="Shop by category">
        {CATEGORY_TILES.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className="category-tile"
            onClick={() => onNavigate(`/shop?category=${encodeURIComponent(tile.label)}`)}
          >
            <span className="category-tile-icon" aria-hidden="true">{tile.icon}</span>
            <span className="category-tile-copy">
              <b>{tile.label}</b>
              <Caption1>{tile.hint}</Caption1>
            </span>
            <ArrowUpRightRegular className="category-tile-arrow" aria-hidden="true" />
          </button>
        ))}
      </section></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.06}><div className="catalog-heading">
        <div className="heading-group">
          <Caption1 className="section-kicker">MOTOGEAR PK / FEATURED</Caption1>
          <Title2 as="h2">Gear for every ride.</Title2>
        </div>
        <Button
          appearance="subtle"
          icon={<ArrowRightRegular />}
          iconPosition="after"
          onClick={() => onNavigate('/shop')}
        >
          Browse all products
        </Button>
      </div></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.08}><StatePanel state={state} error={error} retry={retry} emptyLabel="No featured products yet" />

      <div className="product-grid">
        {featured.map((product) => (
          <ProductCard key={product.id} product={product} onNavigate={onNavigate} onAdd={onAdd} />
        ))}
      </div>
      </ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.1}><section className="promise-band" aria-label="The MotoGear promise">
        <div className="promise-band-head">
          <Caption1 className="section-kicker">WHY RIDERS PICK US</Caption1>
          <Title2 as="h2">Built around the way Pakistan rides.</Title2>
          <Body1>
            Long highway runs, monsoon commutes, and weekend trails. We stock what survives them —
            and we tell you exactly what fits before you pay.
          </Body1>
        </div>
        <div className="promise-grid">
          <PromiseCard
            icon={<ShieldCheckmarkRegular />}
            title="Warranty on record"
            text="Supplier warranty terms are stored against every listing, so coverage is never a maybe."
          />
          <PromiseCard
            icon={<TimerRegular />}
            title="Dispatch you can follow"
            text="Every order gets a tracking view from confirmed through to delivered at your door."
          />
          <PromiseCard
            icon={<MoneyRegular />}
            title="Cash on delivery, nationwide"
            text="Pay when the parcel is in your hand — in every province we ship to."
          />
          <PromiseCard
            icon={<PersonVoiceRegular />}
            title="Humans on support"
            text="Real people answer order questions from 9am to 9pm, seven days a week."
          />
        </div>
      </section></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.12}><section className="cta-band">
        <div className="cta-band-copy">
          <Caption1 className="section-kicker">NOT SURE WHAT FITS?</Caption1>
          <Title2 as="h2">Tell us your bike. We will shortlist the parts.</Title2>
          <Body1>Send your model and we will point you at parts confirmed to fit it.</Body1>
        </div>
        <div className="cta-band-actions">
          <Button appearance="primary" size="large" icon={<ArrowRightRegular />} iconPosition="after" onClick={() => onNavigate('/shop')}>
            Browse the catalog
          </Button>
          <Button appearance="secondary" size="large" icon={<ChatRegular />} onClick={() => onNavigate('/support')}>
            Ask about fitment
          </Button>
        </div>
      </section></ScrollReveal>
    </div>
  );
}

function ScrollReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div
    className={className}
    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.12 }}
    transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : delay, ease: 'easeOut' }}
  >{children}</motion.div>;
}

function ShopPage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
  const { products, state, error, retry } = useProducts(false);
  const initialCategory = new URLSearchParams(window.location.search).get('category') ?? 'All';
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    let active = true;
    api.listCategories()
      .then((rows) => { if (active) setCategories(['All', ...rows.map((row) => row.name)]); })
      .catch(() => { /* keep the default All-only filter */ });
    return () => { active = false; };
  }, []);

  // Once categories are known, a deep link that names a removed category falls back to All.
  // Guarded on the load completing so the initial selection is not wiped out.
  useEffect(() => {
    if (categories.length <= 1) return;
    if (category !== 'All' && !categories.includes(category)) setCategory('All');
  }, [categories, category]);

  const selectCategory = (next: string) => {
    setCategory(next);
    // Keep the URL in sync so the filtered view can be shared or bookmarked.
    const url = next === 'All' ? '/shop' : `/shop?category=${encodeURIComponent(next)}`;
    window.history.replaceState({}, '', url);
  };

  const filtered = applyCatalogSort(
    products.filter(
      (product) =>
        (category === 'All' || product.category === category) &&
        (!search ||
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.brand?.toLowerCase().includes(search.toLowerCase()))
    ),
    sort
  );

  const hasActiveFilters = category !== 'All' || search.trim() !== '';

  const clearFilters = () => {
    setCategory('All');
    setSearch('');
    setSort('featured');
    window.history.replaceState({}, '', '/shop');
  };

  return (
    <div className="page-content">
      <div className="shop-header">
        <div>
          <Caption1 className="section-kicker">MOTORCYCLE ACCESSORIES & PARTS</Caption1>
          <Title1 as="h1">Parts for every ride.</Title1>
          <Body1>Explore lighting, controls, protective gear, and road-ready essentials with live supplier availability.</Body1>
        </div>
      </div>

      <div className="shop-toolbar">
        <div className="shop-search-field">
          <Input
            value={search}
            onChange={(_, data) => setSearch(data.value)}
            placeholder="Search parts, helmets, exhausts..."
            contentBefore={<SearchRegular />}
            className="search-input"
          />
        </div>

        <label className="shop-sort">
          <Caption1>Sort</Caption1>
          <Select value={sort} onChange={(_, data) => setSort(data.value as SortKey)}>
            <Option value="featured">Featured</Option>
            <Option value="price-asc">Price: low to high</Option>
            <Option value="price-desc">Price: high to low</Option>
            <Option value="name">Name A–Z</Option>
          </Select>
        </label>

        <div className="results-count">
          <Caption1>
            <b>{filtered.length}</b> {filtered.length === 1 ? 'product' : 'products'}
          </Caption1>
        </div>
      </div>

      <div className="category-pill-group shop-category-row">
        {categories.map((cat) => (
          <Button
            key={cat}
            appearance={category === cat ? 'primary' : 'subtle'}
            size="small"
            onClick={() => selectCategory(cat)}
            className="category-pill"
          >
            {cat}
          </Button>
        ))}
      </div>

      {hasActiveFilters && (
        <div className="shop-active-filters">
          <Caption1>Showing</Caption1>
          {category !== 'All' && (
            <span className="filter-chip">
              {category}
              <button type="button" onClick={() => selectCategory('All')} aria-label={`Clear category ${category}`}>
                <DismissRegular />
              </button>
            </span>
          )}
          {search.trim() !== '' && (
            <span className="filter-chip">
              “{search.trim()}”
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                <DismissRegular />
              </button>
            </span>
          )}
          <button type="button" className="filter-clear" onClick={clearFilters}>Clear all</button>
        </div>
      )}

      <StatePanel state={state} error={error} retry={retry} emptyLabel="No products match these filters" />

      {state === 'data' && filtered.length === 0 && (
        <Card className="empty-state">
          <SearchRegular />
          <Title3 as="h3">Nothing matches those filters</Title3>
          <Body1>Try a different category, or clear the filters to see the full catalog.</Body1>
          <Button appearance="primary" onClick={clearFilters}>Clear filters</Button>
        </Card>
      )}

      <div className="product-grid">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} onNavigate={onNavigate} onAdd={onAdd} />
        ))}
      </div>
    </div>
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
  const availability =
    product.availabilityStatus ??
    (product.status === 'Limited' || product.status === 'Low stock' ? 'CHECK_REQUIRED' : 'AVAILABLE');
  const available = isAvailable(product);
  const availabilityColor =
    availability === 'AVAILABLE' ? 'success' : availability === 'UNAVAILABLE' ? 'danger' : 'warning';

  return (
    <Card className="product-card" onClick={() => onNavigate(`/product/${product.slug}`)}>
      <CardPreview className="product-preview">
        <ProductImage src={product.image} alt={product.name} category={product.category} name={product.name} />
        <div className="product-badge-wrap">
          <Badge appearance="filled" color={availabilityColor}>
            {availabilityLabel(availability)}
          </Badge>
        </div>
        <Button
          appearance="subtle"
          className={`wishlist-toggle${wished ? ' is-active' : ''}`}
          icon={wished ? <HeartFilled /> : <HeartRegular />}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(event) => {
            event.stopPropagation();
            wishlist.toggle(product.id);
          }}
        />
      </CardPreview>

      <div className="product-card-body">
        <span className="product-brand">{product.brand ?? 'MOTOGEAR PK'}</span>
        <Subtitle1 className="product-title" title={product.name}>
          {product.name}
        </Subtitle1>
        <div className="product-meta-row">
          <span className="product-cat-pill">{product.category}</span>
          {product.compatibleBikes?.length ? (
            <span className="product-bikes-pill">{product.compatibleBikes.length} Bikes</span>
          ) : null}
        </div>
      </div>

      <div className="product-card-bottom">
        <div className="price-stack">
          <strong>{money(product.pricePk)}</strong>
          {product.originalPrice && product.originalPrice > product.pricePk ? (
            <del>{money(product.originalPrice)}</del>
          ) : null}
        </div>
        <Button
          size="small"
          appearance="primary"
          icon={<CartRegular />}
          disabled={!available}
          onClick={(event) => {
            event.stopPropagation();
            onAdd(product);
          }}
        >
          {available ? 'Add to cart' : 'Out of stock'}
        </Button>
      </div>
    </Card>
  );
}

function Trust({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="trust-item">
      <span className="trust-icon">{icon}</span>
      <div>
        <Subtitle1>{title}</Subtitle1>
        <Caption1>{text}</Caption1>
      </div>
    </div>
  );
}

function PromiseCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="promise-card">
      <span className="promise-card-icon" aria-hidden="true">{icon}</span>
      <Subtitle1 className="promise-card-title">{title}</Subtitle1>
      <Caption1 className="promise-card-text">{text}</Caption1>
    </article>
  );
}

function useProducts(featured: boolean) {
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<DataState>('loading');
  const [error, setError] = useState('');

  const load = () => {
    setState('loading');
    api.getCatalog()
      .then((items) => {
        setProducts(featured ? items.filter((item) => item.featured) : items);
        setState(items.length ? 'data' : 'empty');
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load catalog.');
        setState('error');
      });
  };

  useEffect(load, [featured]);
  return { products, state, error, retry: load };
}

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
    return (
      <div className="loading-grid">
        <Skeleton>
          <SkeletonItem size={32} />
          <SkeletonItem />
          <SkeletonItem />
        </Skeleton>
        <Skeleton>
          <SkeletonItem size={32} />
          <SkeletonItem />
          <SkeletonItem />
        </Skeleton>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <MessageBar intent="error">
        <MessageBarBody>
          {error || 'Something went wrong.'} <Button appearance="transparent" onClick={retry}>Try again</Button>
        </MessageBarBody>
      </MessageBar>
    );
  }
  if (state === 'empty') {
    return (
      <Card className="empty-state">
        <SparkleRegular />
        <Title3>{emptyLabel}</Title3>
        <Body1>Try another view and we will keep the good stuff coming.</Body1>
      </Card>
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
    <footer className="site-footer">
      <div className="footer-ribbon" aria-hidden="true" />
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-col brand-col">
            <button
              type="button"
              className="brand-button footer-brand-button"
              onClick={() => onNavigate('/')}
              aria-label="MotoGear PK home"
            >
              <span className="brand-mark">MG</span>
              <span className="brand-name footer-brand-name">
                MOTOGEAR <b>PK</b>
              </span>
            </button>
            <p className="footer-desc">
              Motorcycle parts and accessories for riders in Pakistan. Product fitment, warranty, and
              availability details are shown when recorded.
            </p>
            <div className="footer-trust-row">
              <span className="footer-trust-chip"><ShieldCheckmarkRegular /> Warranty on record</span>
              <span className="footer-trust-chip"><TruckDeliveryIcon /> Nationwide COD</span>
            </div>
          </div>

          <div className="footer-col links-col">
            <h2 className="footer-col-title">Shop</h2>
            <div className="footer-links">
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/')}>Home</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/shop')}>All products</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/shop?category=Riding%20Gear')}>Riding gear</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/shop?category=Lighting%20%26%20Electrics')}>Lighting &amp; electrics</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/wishlist')}>Wishlist</button>
            </div>
          </div>

          <div className="footer-col links-col">
            <h2 className="footer-col-title">Account</h2>
            <div className="footer-links">
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/account')}>My account</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/orders')}>Track an order</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/cart')}>Shopping cart</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/faq')}>FAQs</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/support')}>Customer support</button>
            </div>
          </div>

          <div className="footer-col contact-col">
            <h2 className="footer-col-title">Talk to us</h2>
            <p className="footer-cities">
              Order questions, fitment checks, and returns — answered by our team, 9am to 9pm, seven days a week.
            </p>
            <ul className="footer-contact-list">
              {phone && (
                <li>
                  <a className="footer-contact-link" href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>
                    <PhoneRegular aria-hidden="true" />
                    <span><Caption1>Call us</Caption1><b>{phone}</b></span>
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a
                    className="footer-contact-link"
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ChatRegular aria-hidden="true" />
                    <span><Caption1>WhatsApp</Caption1><b>{whatsapp}</b></span>
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a className="footer-contact-link" href={`mailto:${email}`}>
                    <MailRegular aria-hidden="true" />
                    <span><Caption1>Email</Caption1><b>{email}</b></span>
                  </a>
                </li>
              )}
              {!phone && !email && !whatsapp && (
                <li className="footer-contact-empty">
                  <LocationRegular aria-hidden="true" />
                  <span><Caption1>Cash on Delivery</Caption1><b>Delivered across Pakistan</b></span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <Divider className="footer-divider" />

        <div className="footer-bottom">
          <span className="footer-bottom-copy">© 2026 {business.businessName}. All rights reserved. Ride with intent.</span>
          <span className="footer-bottom-badge">Cash on Delivery · MotoGear PK</span>
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
