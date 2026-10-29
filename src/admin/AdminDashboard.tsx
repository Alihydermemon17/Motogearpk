import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowUndoRegular,
  BoardRegular,
  BotRegular,
  BoxMultipleRegular,
  CartRegular,
  ChatRegular,
  CheckmarkCircleRegular,
  ChevronLeftRegular,
  DataHistogramRegular,
  DismissRegular,
  GridRegular,
  HomeRegular,
  NavigationRegular,
  PeopleRegular,
  QuestionRegular,
  SettingsRegular,
  ShieldCheckmarkRegular,
  SignOutRegular,
  StarRegular,
  TagRegular,
  VehicleTruckBagRegular,
} from '@fluentui/react-icons';
import {
  getDashboardMetrics,
  listAdminReviews,
} from '../api/admin';
import { listAdminReturnRequests, listAdminSupportConversations } from '../api/trust';
import { OverviewPage } from './pages/Overview';
import { ProductsPage } from './pages/Products';
import { OrdersPage } from './pages/Orders';
import { CategoriesPage, BikesPage, SuppliersPage } from './pages/Catalog';
import { CustomersPage } from './pages/Customers';
import { ReviewsPage, FeedbackPage, ApprovalsPage, AutomationLogsPage } from './pages/Engagement';
import { ReturnsPage, SupportPage, FaqsPage } from './pages/Trust';
import { SettingsPage } from './pages/Settings';
import { ComingSoonPage } from './pages/ComingSoon';
import { EmptyState } from './components/ui';

export type Navigate = (path: string) => void;

/* Pages register a guard here when they hold unsaved edits, so no sidebar link
   can silently throw the form away. */
export const LeaveGuardContext = createContext<(guard: (() => boolean) | null) => void>(() => undefined);

type BadgeKey = 'orders' | 'returns' | 'support' | 'reviews' | 'approvals';

type NavItem = {
  href: string;
  label: string;
  icon: typeof HomeRegular;
  badge?: BadgeKey;
  soon?: boolean;
};

const NAV_GROUPS: Array<{ title?: string; items: NavItem[] }> = [
  { items: [{ href: '/admin', label: 'Overview', icon: HomeRegular }] },
  {
    title: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products', icon: BoxMultipleRegular },
      { href: '/admin/categories', label: 'Categories', icon: TagRegular },
      { href: '/admin/bikes', label: 'Bike models', icon: GridRegular },
      { href: '/admin/suppliers', label: 'Suppliers', icon: VehicleTruckBagRegular },
    ],
  },
  {
    title: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: CartRegular, badge: 'orders' },
      { href: '/admin/returns', label: 'Returns', icon: ArrowUndoRegular, badge: 'returns' },
      { href: '/admin/customers', label: 'Customers', icon: PeopleRegular },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { href: '/admin/reviews', label: 'Reviews', icon: StarRegular, badge: 'reviews' },
      { href: '/admin/feedback', label: 'Feedback', icon: ChatRegular },
      { href: '/admin/support', label: 'Support', icon: ShieldCheckmarkRegular, badge: 'support' },
      { href: '/admin/faqs', label: 'FAQs', icon: QuestionRegular },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/approvals', label: 'Approvals', icon: CheckmarkCircleRegular, badge: 'approvals' },
      { href: '/admin/automation-logs', label: 'Automation logs', icon: DataHistogramRegular },
      { href: '/admin/settings', label: 'Settings', icon: SettingsRegular },
      { href: '/admin/agents', label: 'AI command center', icon: BotRegular, soon: true },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

const SIDEBAR_KEY = 'motogearpk.admin.sidebar';

const emptyCounts: Record<BadgeKey, number> = {
  orders: 0,
  returns: 0,
  support: 0,
  reviews: 0,
  approvals: 0,
};

export default function AdminDashboard({
  path,
  navigate,
  onSignOut,
  email,
}: {
  path: string;
  navigate: Navigate;
  onSignOut?: () => void;
  email?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_KEY);
      if (stored) return stored === 'rail';
    } catch {
      // Storage can be unavailable; fall through to the viewport default.
    }
    return window.innerWidth <= 1280;
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [counts, setCounts] = useState(emptyCounts);
  const guardRef = useRef<(() => boolean) | null>(null);

  const active = NAV_ITEMS.find((item) => item.href === path);

  const toggleRail = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? 'rail' : 'full');
      } catch {
        // Preference still applies for this session.
      }
      return next;
    });
  };

  const leave = (next: string) => {
    if (guardRef.current && !guardRef.current()) return;
    setMobileNav(false);
    setAvatarOpen(false);
    navigate(next);
  };

  // Counts are read from the same admin-scoped endpoints the pages use. There
  // is no new query here — only a summary of records the console already loads.
  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      getDashboardMetrics(),
      listAdminReturnRequests(),
      listAdminSupportConversations(),
      listAdminReviews(),
    ]).then(([metrics, returns, support, reviews]) => {
      if (!alive) return;
      setCounts({
        orders: metrics.status === 'fulfilled' ? metrics.value.pending_orders : 0,
        approvals: metrics.status === 'fulfilled' ? metrics.value.pending_approvals : 0,
        returns: returns.status === 'fulfilled'
          ? returns.value.filter((row) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(row.status)).length
          : 0,
        support: support.status === 'fulfilled'
          ? support.value.filter((row) => ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'].includes(row.status)).length
          : 0,
        reviews: reviews.status === 'fulfilled' ? reviews.value.filter((row) => !row.is_visible).length : 0,
      });
    });
    return () => {
      alive = false;
    };
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileNav(false);
      setAvatarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!mobileNav) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNav]);

  useEffect(() => {
    if (!avatarOpen) return;
    const close = () => setAvatarOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [avatarOpen]);

  const renderNav = (rail: boolean) => (
    <nav className={`adm-nav${rail ? ' is-rail' : ''}`} aria-label="Admin navigation">
      {NAV_GROUPS.map((group, index) => (
        <div className="adm-nav-group" key={group.title ?? `group-${index}`}>
          {group.title && <p className="adm-nav-label">{group.title}</p>}
          {group.items.map((item) => {
            const isActive = item.href === path;
            const badge = item.badge ? counts[item.badge] : 0;
            return (
              <button
                key={item.href}
                type="button"
                className={`adm-nav-item${isActive ? ' is-active' : ''}${item.soon ? ' is-soon' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => leave(item.href)}
                title={rail ? item.label : undefined}
              >
                <span className="adm-nav-icon" aria-hidden="true"><item.icon /></span>
                <span className="adm-nav-text">{item.label}</span>
                {item.badge && badge > 0 && (
                  <span className="adm-nav-badge" aria-label={`${badge} needing attention`}>{badge}</span>
                )}
                {item.soon && <span className="adm-nav-soon">Soon</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const initials = (email ?? 'AD').slice(0, 2).toUpperCase();

  return (
    <LeaveGuardContext.Provider value={(guard) => { guardRef.current = guard; }}>
      <div className={`adm-shell${collapsed ? ' is-railed' : ''}`}>
        <aside className="adm-sidebar">
          <div className="adm-sidebar-head">
            <button type="button" className="adm-brand" onClick={() => leave('/admin')} aria-label="MotoGear PK admin overview">
              <span className="adm-brand-mark" aria-hidden="true">MG</span>
              <span className="adm-brand-copy">
                <strong>MotoGear PK</strong>
                <span>Operations</span>
              </span>
            </button>
            <button
              type="button"
              className="adm-rail-toggle"
              onClick={toggleRail}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeftRegular />
            </button>
          </div>

          <div className="adm-nav-scroll">
            {renderNav(collapsed)}
          </div>

          <div className="adm-sidebar-foot">
            <button type="button" className="adm-foot-link" onClick={() => leave('/')} title="View storefront">
              <ArrowUndoRegular aria-hidden="true" />
              <span>View storefront</span>
            </button>
            <button type="button" className="adm-foot-link" onClick={() => onSignOut?.()} title="Sign out">
              <SignOutRegular aria-hidden="true" />
              <span>Sign out</span>
            </button>
            <p className="adm-foot-email" title={email ?? 'Administrator'}>
              {email ?? 'Administrator'}
            </p>
          </div>
        </aside>

        <div className="adm-workspace">
          <header className="adm-mobile-bar">
            <button
              type="button"
              className="adm-icon-btn"
              onClick={() => setMobileNav(true)}
              aria-label="Open admin menu"
              aria-controls="adm-mobile-nav"
            >
              <NavigationRegular />
            </button>
            <span className="adm-mobile-title">MotoGear PK <b>Admin</b></span>
            <span className="adm-avatar" title={email ?? 'Administrator'}>{initials}</span>
          </header>

          <div className="adm-workspace-bar">
            <span className="adm-workspace-current">{active?.label ?? 'Admin'}</span>
            <div className="adm-avatar-wrap">
              <button
                type="button"
                className="adm-avatar"
                aria-haspopup="menu"
                aria-expanded={avatarOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setAvatarOpen((open) => !open);
                }}
                title={email ?? 'Administrator'}
                aria-label="Administrator menu"
              >
                {initials}
              </button>
              {avatarOpen && (
                <div className="adm-avatar-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                  <p className="adm-avatar-email">{email ?? 'Administrator'}</p>
                  <button type="button" role="menuitem" onClick={() => leave('/')}>View storefront</button>
                  <button type="button" role="menuitem" onClick={() => onSignOut?.()}>Sign out</button>
                </div>
              )}
            </div>
          </div>

          <main className="adm-main">
            {path === '/admin' && <OverviewPage navigate={navigate} />}
            {path === '/admin/products' && <ProductsPage navigate={navigate} />}
            {path === '/admin/orders' && <OrdersPage navigate={navigate} />}
            {path === '/admin/categories' && <CategoriesPage />}
            {path === '/admin/bikes' && <BikesPage />}
            {path === '/admin/suppliers' && <SuppliersPage />}
            {path === '/admin/customers' && <CustomersPage />}
            {path === '/admin/reviews' && <ReviewsPage />}
            {path === '/admin/feedback' && <FeedbackPage />}
            {path === '/admin/returns' && <ReturnsPage />}
            {path === '/admin/support' && <SupportPage />}
            {path === '/admin/faqs' && <FaqsPage />}
            {path === '/admin/approvals' && <ApprovalsPage />}
            {path === '/admin/automation-logs' && <AutomationLogsPage />}
            {path === '/admin/settings' && <SettingsPage />}
            {path === '/admin/agents' && (
              <ComingSoonPage
                title="AI command center"
                description="The AI operations tooling is not connected to this store yet."
                body="No agents, automations or external AI APIs are running. This page will stay a placeholder until there is something real to operate."
                icon={<BoardRegular />}
              />
            )}
            {!active && path !== '/admin/agents' && (
              <EmptyState
                title="This page does not exist"
                body="That admin route is not part of the console. Choose a section from the sidebar."
                actionLabel="Back to overview"
                onAction={() => navigate('/admin')}
              />
            )}
          </main>
        </div>

        {mobileNav && (
          <div className="adm-mobile-nav-layer">
            <div className="adm-scrim" onClick={() => setMobileNav(false)} aria-hidden="true" />
            <aside className="adm-mobile-nav" id="adm-mobile-nav" role="dialog" aria-modal="true" aria-label="Admin navigation">
              <div className="adm-mobile-nav-head">
                <span className="adm-brand-mark" aria-hidden="true">MG</span>
                <strong>MotoGear PK</strong>
                <button type="button" className="adm-icon-btn" onClick={() => setMobileNav(false)} aria-label="Close admin menu">
                  <DismissRegular />
                </button>
              </div>
              <div className="adm-mobile-nav-scroll">{renderNav(false)}</div>
              <div className="adm-sidebar-foot">
                <button type="button" className="adm-foot-link" onClick={() => leave('/')}>
                  <ArrowUndoRegular aria-hidden="true" />
                  <span>View storefront</span>
                </button>
                <button type="button" className="adm-foot-link" onClick={() => onSignOut?.()}>
                  <SignOutRegular aria-hidden="true" />
                  <span>Sign out</span>
                </button>
                <p className="adm-foot-email">{email ?? 'Administrator'}</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </LeaveGuardContext.Provider>
  );
}

/** Shared helper so a page can register its unsaved-changes guard. */
export function useLeaveGuard(dirty: boolean, message = 'Discard unsaved changes?') {
  const register = useContext(LeaveGuardContext);
  useEffect(() => {
    register(() => !dirty || window.confirm(message));
    return () => register(null);
  }, [dirty, message, register]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
