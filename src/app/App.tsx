import { useEffect, useState } from 'react';
import {
  Body1,
  Button,
  FluentProvider,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Title3,
  createDarkTheme,
  createLightTheme,
} from '@fluentui/react-components';
import { HomeRegular } from '@fluentui/react-icons';
import type { User } from '@supabase/supabase-js';
import AdminDashboard from '../admin/AdminDashboard';
import { api } from '../api';
import type { Product } from '../api/types';
import { getPublicBusinessSettings } from '../api/admin';
import {
  formatBusinessMoney,
  getBusinessDisplaySettings,
  setBusinessDisplaySettings,
} from '../lib/businessDisplay';
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
import { FaqPage, SupportPage } from './CustomerTrustPages';
import { Footer, Header, NotFoundPage } from '../storefront/components/Layout';
import { HomePage } from '../storefront/pages/HomePage';
import { ShopPage } from '../storefront/pages/ShopPage';
import { ProductPage } from '../storefront/pages/ProductPage';
import { isAvailable } from '../storefront/shared';

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
          <AdminDashboard path={route} navigate={navigate} onSignOut={signOut} email={auth.user?.email} />
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

export default App;
