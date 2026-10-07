import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Badge, Body1, Button, Card, CardPreview, Caption1, createDarkTheme, createLightTheme,
  Divider, FluentProvider, Input, MessageBar, MessageBarBody, Skeleton, SkeletonItem, Subtitle1,
  Title1, Title3,
} from '@fluentui/react-components';
import {
  ArrowRightRegular, CartRegular, CheckmarkCircleRegular, ChevronLeftRegular, DismissRegular, HeartFilled, HeartRegular, HomeRegular,
  LocationRegular, NavigationRegular, PersonRegular, SearchRegular, SparkleRegular, WeatherMoonRegular,
  WeatherSunnyRegular, VehicleBicycleRegular,
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

const brandRamp = {
  10: '#3d2600', 20: '#684100', 30: '#955d00', 40: '#c17a00',
  50: '#FFB400', 60: '#e5a200', 70: '#c98e00', 80: '#a97600',
  90: '#895f00', 100: '#694900', 110: '#4c3500', 120: '#332400',
  130: '#241900', 140: '#191100', 150: '#110c00', 160: '#090600',
};
const THEME_KEY = 'motogearpk.theme';
type ThemeMode = 'light' | 'dark';

type DataState = 'data' | 'loading' | 'empty' | 'error';
const money = (value: number) => formatBusinessMoney(value);
const availabilityLabel = (status: AvailabilityStatus) =>
  status === 'AVAILABLE' ? 'Available' : status === 'UNAVAILABLE' ? 'Unavailable' : 'Check required';

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'dark' ? '#131418' : '#f1f0ec');
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

  return (
    <FluentProvider theme={theme} className="app-provider">
      <div className="app-shell">
        <Header path={path} cartCount={cart.count} wishlistCount={wishlist.count} signedIn={Boolean(auth.user)} themeMode={themeMode} onToggleTheme={toggleTheme} onNavigate={navigate} />
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
          {route.startsWith('/admin') && (
            <AdminGate authLoading={auth.loading} user={auth.user}>
              <AdminDashboard path={route} navigate={navigate} />
            </AdminGate>
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
  themeMode,
  onToggleTheme,
  onNavigate,
}: {
  path: string;
  cartCount: number;
  wishlistCount: number;
  signedIn: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const business = getBusinessDisplaySettings();
  const route = path.split('?')[0];

  return (
    <header className="site-header">
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
            appearance={route === '/' ? 'primary' : 'subtle'}
            icon={<HomeRegular />}
            onClick={() => { setMenuOpen(false); onNavigate('/'); }}
            className="nav-link-btn"
          >
            Home
          </Button>
          <Button
            appearance={route === '/shop' ? 'primary' : 'subtle'}
            icon={<SearchRegular />}
            onClick={() => { setMenuOpen(false); onNavigate('/shop'); }}
            className="nav-link-btn"
          >
            Shop
          </Button>
          <Button
            appearance={route === '/account' || route.startsWith('/orders') ? 'primary' : 'subtle'}
            icon={<PersonRegular />}
            onClick={() => { setMenuOpen(false); onNavigate(signedIn ? '/account' : '/login'); }}
            className="nav-link-btn"
          >
            {signedIn ? 'My Account' : 'Sign In'}
          </Button>
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
          <div className="delivery-pill">
            <LocationRegular />
            <span>Nationwide Cash on Delivery</span>
          </div>

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
  children,
}: {
  authLoading: boolean;
  user: User | null;
  children: React.ReactNode;
}) {
  if (authLoading) {
    return (
      <div className="page-content">
        <Skeleton>
          <SkeletonItem size={24} />
          <SkeletonItem />
        </Skeleton>
      </div>
    );
  }
  if (user?.app_metadata.role !== 'admin') {
    return (
      <div className="page-content">
        <MessageBar intent="error">
          <MessageBarBody>Administrator access is required for this workspace.</MessageBarBody>
        </MessageBar>
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

function Hero({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, [slide]);
  return (
    <Card className="hero-card">
      <div className="hero-slides">
        {HERO_SLIDES.map((item, i) => (
          <img key={i} className={`hero-slide${i === slide ? ' active' : ''}`} src={item.image} alt="" aria-hidden="true" />
        ))}
      </div>
      <div className="hero-overlay" aria-hidden="true" />
      <div className="hero-mesh" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-copy">
        <div className="hero-copy-stack">
          {HERO_SLIDES.map((item, i) => (
            <div key={i} className={`hero-copy-slide${i === slide ? ' active' : ''}`} aria-hidden={i !== slide}>
              <div className="eyebrow">
                <SparkleRegular /> {item.eyebrow}
              </div>
              <Title1>
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
        <div className="hero-dots" role="group" aria-label="Hero slides">
          {HERO_SLIDES.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`hero-dot${i === slide ? ' active' : ''}`}
              aria-label={`Show slide ${i + 1}: ${item.titleTop} ${item.titleAccent}`}
              aria-pressed={i === slide}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
      </div>
      <div className="hero-stamp">
        EST. 2026<br />
        <b>PAKISTAN · NATIONWIDE COD</b>
      </div>
    </Card>
  );
}

function HomePage({ onNavigate, onAdd }: { onNavigate: (path: string) => void; onAdd: (product: Product) => void }) {
  const { products: featured, state, error, retry } = useProducts(true);

  return (
    <div className="page-content">
      <ScrollReveal><Hero onNavigate={onNavigate} /></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.04}><div className="trust-row">
        <Trust
          icon={<VehicleBicycleRegular />}
          title="Compatibility details"
          text="Check listed fitment information on each product page"
        />
        <Trust
          icon={<LocationRegular />}
          title="Cash on Delivery"
          text="Pay for eligible orders when they are delivered"
        />
        <Trust
          icon={<CheckmarkCircleRegular />}
          title="Availability status"
          text="Product pages show the recorded supplier availability status"
        />
      </div></ScrollReveal>

      <ScrollReveal className="home-reveal" delay={0.06}><div className="catalog-heading">
        <div className="heading-group">
          <Caption1 className="section-kicker">MOTOGEAR PK / FEATURED</Caption1>
          <Title1 as="h2">Gear for every ride.</Title1>
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
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const categories = ['All', 'Street', 'Sport', 'Commuter', 'Utility'];

  const filtered = products.filter(
    (product) =>
      (category === 'All' || product.category === category) &&
      (!search || product.name.toLowerCase().includes(search.toLowerCase()) || product.brand?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-content">
      <div className="shop-header">
        <div>
          <Caption1 className="section-kicker">MOTORCYCLE ACCESSORIES & PARTS</Caption1>
          <Title1>Parts for every ride.</Title1>
          <Body1>Explore lighting, controls, protective gear, and road-ready essentials with live supplier availability.</Body1>
        </div>
      </div>

      <div className="shop-controls-bar">
        <div className="shop-search-field">
          <Input
            value={search}
            onChange={(_, data) => setSearch(data.value)}
            placeholder="Search parts, helmets, exhausts..."
            contentBefore={<SearchRegular />}
            className="search-input"
          />
        </div>

        <div className="category-pill-group">
          {categories.map((cat) => (
            <Button
              key={cat}
              appearance={category === cat ? 'primary' : 'subtle'}
              size="small"
              onClick={() => setCategory(cat)}
              className="category-pill"
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="results-count">
          <Caption1>{filtered.length} products found</Caption1>
        </div>
      </div>

      <StatePanel state={state} error={error} retry={retry} emptyLabel="No products match these filters" />

      <div className="product-grid">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} onNavigate={onNavigate} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
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
        <div className="detail-image-box">
          <img src={product.image} alt={product.name} />
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

        <div className="detail-copy">
          <Caption1 className="section-kicker">
            {product.category.toUpperCase()} / {product.brand ?? 'MOTOGEAR PK'}
          </Caption1>
          <Title1>{product.name}</Title1>
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
        <Title3>Made for miles.</Title3>
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
        <img src={product.image} alt={product.name} loading="lazy" />
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
  return (
    <footer className="site-footer">
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
              <span className="brand-name">
                MOTOGEAR <b>PK</b>
              </span>
            </button>
            <p className="footer-desc">
              Motorcycle parts and accessories for riders in Pakistan. Product fitment, warranty, and availability details are shown when recorded.
            </p>
          </div>

          <div className="footer-col links-col">
            <h4 className="footer-col-title">Quick Links</h4>
            <div className="footer-links">
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/')}>Home</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/shop')}>Shop Catalog</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/account')}>Customer Account</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/cart')}>Shopping Cart</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/wishlist')}>Wishlist</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/faq')}>FAQs</button>
              <button type="button" className="footer-link-btn" onClick={() => onNavigate('/support')}>Customer Support</button>
            </div>
          </div>

          <div className="footer-col delivery-col">
            <h4 className="footer-col-title">Delivery details</h4>
            <p className="footer-cities">Delivery fee and any recorded estimate are shown during checkout. Order tracking appears when available.</p>
            <div className="footer-badge">
              <LocationRegular />
              <span>Cash on Delivery</span>
            </div>
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
