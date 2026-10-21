import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'react-qr-code';
import {
  Badge, Body1, Button, Card, CardHeader, Caption1, Divider, Field, Input,
  MessageBar, MessageBarBody, Select, Skeleton, SkeletonItem, Subtitle1,
  Textarea, Title1, Title3,
} from '@fluentui/react-components';
import { Option } from './SelectOption';
import {
  AddRegular, ArrowRightRegular, CartRegular, CheckmarkCircleRegular, ChevronLeftRegular,
  DeleteRegular, HeartFilled, HeartRegular, LockClosedRegular, SubtractRegular,
  PrintRegular, ShieldCheckmarkRegular,
} from '@fluentui/react-icons';
import {
  createCustomerOrder, getCustomerOrderDetails, getCustomerOrders,
  getCustomerProfile, quoteCustomerOrder, updateCustomerEmail, updateCustomerProfile,
  type CartRequestItem, type CustomerOrder,
  type CustomerOrderDetails, type CustomerOrderQuote, type ShippingDetails,
} from '../api/customer';
import type { Product } from '../api/types';
import { api } from '../api';
import { useCustomerAuth, useCustomerCart, useCustomerWishlist } from './CustomerState';
import { formatBusinessMoney, getBusinessDisplaySettings } from '../lib/businessDisplay';
import { CustomerReturnRequest, DeliveryInfo, OrderFeedbackForm } from './CustomerTrustPages';
import { InvoiceModal } from './Invoice';

type Navigate = (path: string) => void;
const money = (value: number) => formatBusinessMoney(value);
const provinces = ['Sindh', 'Punjab', 'Balochistan', 'Khyber Pakhtunkhwa'];
const orderStatuses = ['PENDING', 'CONFIRMED', 'SUPPLIER_PROCESSING', 'SUPPLIER_SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'] as const;
const statusLabel = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : 'Something went wrong. Please try again.';

/* Happy-path stages a customer sees while their COD order moves along. */
const TRACKING_STAGES = [
  { label: 'Order received', hint: 'We have your order and payment method is confirmed.' },
  { label: 'Order confirmed', hint: 'Our team has checked stock and accepted the order.' },
  { label: 'Being prepared', hint: 'The items are being packed and labelled for dispatch.' },
  { label: 'On the way', hint: 'Handed to the courier and heading to your city.' },
  { label: 'Delivered', hint: 'Handed over to you. Thank you for shopping with us.' },
] as const;

function stageIndexFor(status: string): number {
  const state = status.toUpperCase();
  if (state === 'DELIVERED') return 4;
  if (state === 'IN_TRANSIT' || state === 'SUPPLIER_SHIPPED') return 3;
  if (state === 'SUPPLIER_PROCESSING') return 2;
  if (state === 'CONFIRMED') return 1;
  return 0;
}

type QuoteRequestItem = { product_id: string; quantity: number };

/**
 * Mirrors the `_quote_customer_order` database function so totals can still be
 * shown when the quote RPC is unreachable: subtotal is base price x quantity,
 * discount is the per-line price drop, total is subtotal - discount + delivery.
 * Returns null when any cart product is missing from the catalog snapshot.
 */
function buildFallbackQuote(products: Product[], items: QuoteRequestItem[]): CustomerOrderQuote | null {
  if (!items.length) return null;
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: CustomerOrderQuote['items'] = [];
  let subtotal = 0;
  let discountAmount = 0;
  for (const item of items) {
    const product = byId.get(item.product_id);
    if (!product) return null;
    const base = product.originalPrice ?? product.pricePk;
    const unit = product.discountPrice != null && product.discountPrice < base ? product.discountPrice : base;
    const lineDiscount = (base - unit) * item.quantity;
    subtotal += base * item.quantity;
    discountAmount += lineDiscount;
    lines.push({
      product_id: item.product_id,
      product_name: product.name,
      product_sku: product.sku ?? '',
      quantity: item.quantity,
      base_unit_price: base,
      unit_price: unit,
      discount_amount: lineDiscount,
      line_total: unit * item.quantity,
    });
  }
  const deliveryFee = getBusinessDisplaySettings().deliveryFee || 250;
  return {
    items: lines,
    subtotal,
    delivery_fee: deliveryFee,
    discount_amount: discountAmount,
    total: subtotal - discountAmount + deliveryFee,
  };
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.9273 2.0782-1.9818 2.7227v2.2582h2.9087C16.2109 14.6841 17.64 12.1159 17.64 9.2045Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2582c-.8059.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5831-5.0359-3.7105H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18Z" />
      <path fill="#FBBC05" d="M3.9641 10.71A5.41 5.41 0 0 1 3.6827 9a5.4659 5.4659 0 0 1 .2814-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9a8.9965 8.9965 0 0 0 .9573 4.0418L3.9641 10.71Z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3459l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795Z" />
    </svg>
  );
}

export function SignInPage({ navigate, signUp = false, loginRequired = false }: { navigate: Navigate; signUp?: boolean; loginRequired?: boolean }) {
  const auth = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // A failed Google callback lands back on this form, so start with the reason
  // the sign-in was refused rather than showing an unexplained empty form.
  const [error, setError] = useState(auth.oauthIssue || '');
  const [notice, setNotice] = useState('');
  const shopUrl = window.location.origin;
  const googleSignIn = async () => {
    setError(''); setNotice(''); setGoogleBusy(true);
    try {
      await auth.signInWithGoogle(); // Browser redirects to Google on success
    } catch (reason: unknown) {
      setError(errorText(reason));
      setGoogleBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      if (signUp) {
        await auth.signUp(email.trim(), password, fullName.trim(), phone.trim());
        setNotice('Account created. Check your email if confirmation is required, then sign in.');
      } else {
        await auth.signIn(email.trim(), password);
        navigate('/account');
      }
    } catch (reason: unknown) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  return (
    <div className="page-content auth-page-container">
      <div className="auth-back-bar">
        <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={() => navigate('/')}>
          Back to storefront
        </Button>
      </div>

      <Card className="auth-card">
        <aside className="auth-side">
          <div className="auth-side-brand">
            <span className="brand-mark">MG</span>
            <span className="brand-name">MOTOGEAR <b>PK</b></span>
          </div>
          <Title3 as="h2" className="auth-side-title">Ride with intent.</Title3>
          <Body1 className="auth-side-desc">
            Premium motorcycle parts and accessories with recorded supplier availability and nationwide cash on delivery.
          </Body1>
          <ul className="auth-perks">
            <li><CheckmarkCircleRegular /> Cash on Delivery across Pakistan</li>
            <li><CheckmarkCircleRegular /> Track orders and delivery status</li>
            <li><CheckmarkCircleRegular /> Saved addresses for faster checkout</li>
            <li><CheckmarkCircleRegular /> Fitment and warranty details on record</li>
          </ul>
          <div className="auth-qr-block">
            <div className="auth-qr-box">
              <QRCode value={shopUrl} size={96} bgColor="#ffffff" fgColor="#17181d" />
            </div>
            <Caption1 className="auth-qr-caption">
              Scan to open MotoGear PK<br />on your phone
            </Caption1>
          </div>
        </aside>

        <div className="auth-main">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${!signUp ? 'active' : ''}`}
              onClick={() => { setError(''); setNotice(''); navigate('/login'); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${signUp ? 'active' : ''}`}
              onClick={() => { setError(''); setNotice(''); navigate('/signup'); }}
            >
              Create Account
            </button>
          </div>

          <div className="auth-header">
            <Caption1 className="section-kicker">MOTOGEAR PK ACCESS</Caption1>
            <Title1 as="h1" className="auth-title">{signUp ? 'Join the Crew' : 'Welcome Back'}</Title1>
            <Body1 className="auth-desc">
              {signUp
                ? 'Register to track your orders, save delivery details, and get exclusive rider updates.'
                : 'Sign in to access your profile, saved addresses, and active orders.'}
            </Body1>
          </div>

          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
          {loginRequired && !error && (
            <MessageBar intent="warning">
              <MessageBarBody>Sign in or create an account to proceed with checkout.</MessageBarBody>
            </MessageBar>
          )}
          {notice && (
            <MessageBar intent="success">
              <MessageBarBody>{notice}</MessageBarBody>
            </MessageBar>
          )}

          <Button
            appearance="outline"
            size="large"
            className="auth-google-btn"
            icon={<GoogleIcon />}
            disabled={busy || googleBusy}
            onClick={() => void googleSignIn()}
          >
            {googleBusy ? 'Opening Google…' : 'Continue with Google'}
          </Button>

          <div className="auth-divider"><span>or continue with email</span></div>

          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {signUp && (
              <>
                <Field label="Full name" required>
                  <Input
                    size="large"
                    autoComplete="name"
                    placeholder="e.g. Ali Ahmed"
                    value={fullName}
                    onChange={(_, data) => setFullName(data.value)}
                    required
                  />
                </Field>
                <Field label="Phone number (WhatsApp / Mobile)" required>
                  <Input
                    size="large"
                    autoComplete="tel"
                    placeholder="e.g. 0300 1234567"
                    value={phone}
                    onChange={(_, data) => setPhone(data.value)}
                    required
                  />
                </Field>
              </>
            )}

            <Field label="Email address" required>
              <Input
                size="large"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(_, data) => setEmail(data.value)}
                required
              />
            </Field>

            <Field label="Password" required>
              <Input
                size="large"
                type="password"
                autoComplete={signUp ? 'new-password' : 'current-password'}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(_, data) => setPassword(data.value)}
                minLength={8}
                required
              />
            </Field>

            <Button
              appearance="primary"
              size="large"
              type="submit"
              icon={<LockClosedRegular />}
              disabled={busy || googleBusy}
              className="auth-submit-btn"
            >
              {busy ? 'Please wait…' : signUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="auth-card-footer">
            <Body1>{signUp ? 'Already registered?' : 'New to MotoGear PK?'}</Body1>
            <Button
              appearance="subtle"
              onClick={() => { setError(''); setNotice(''); navigate(signUp ? '/login' : '/signup'); }}
            >
              {signUp ? 'Sign In instead' : 'Create an account'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CartPage({ navigate }: { navigate: Navigate }) {
  const cart = useCustomerCart();
  const [products, setProducts] = useState<Record<string, Product | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<CustomerOrderQuote | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setQuote(null); setUseFallback(false);
    void api.getProductsByIds(cart.items.map((item) => item.productId))
      .then((rows) => { if (active) setProducts(Object.fromEntries(rows.map((product) => [product.id, product]))); })
      .catch((reason: unknown) => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cart.items]);
  
  const unavailable = cart.items.filter((item) => {
    const product = products[item.productId];
    return product === null || (product !== undefined && !isAvailable(product));
  });
  
  const items: CartRequestItem[] = cart.items.map((item) => ({ product_id: item.productId, quantity: item.quantity }));

  const refreshQuote = async () => {
    if (!items.length || unavailable.length) return;
    try { 
      const serverQuote = await quoteCustomerOrder(items);
      setQuote(serverQuote); 
      setError(''); 
      setUseFallback(false);
    } catch {
      // Server quote unavailable — estimate totals from catalog prices.
      const fallback = buildFallbackQuote(Object.values(products).filter((product): product is Product => product !== null), items);
      if (fallback) {
        setQuote(fallback);
        setUseFallback(true);
      }
      setError('');
    }
  };
  
  useEffect(() => { if (!loading && items.length && !unavailable.length) void refreshQuote(); }, [loading, cart.items, Object.keys(products).length]);
  
  return <div className="page-content narrow">
    <div className="section-head"><div><Caption1 className="section-kicker">YOUR GARAGE</Caption1><Title1 as="h1">Shopping cart.</Title1></div>{cart.items.length > 0 && <Button appearance="subtle" icon={<DeleteRegular />} onClick={cart.clear}>Clear cart</Button>}</div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {useFallback && <MessageBar intent="info"><MessageBarBody>Showing estimated totals (server quote unavailable). Final amount confirmed at checkout.</MessageBarBody></MessageBar>}
    {loading ? <div className="customer-loading"><Skeleton><SkeletonItem size={24} /><SkeletonItem /><SkeletonItem /></Skeleton></div> : cart.items.length === 0 ? <Card className="empty-state"><Title3 as="h2">Your cart is empty.</Title3><Body1>Find something made for the next ride.</Body1><Button appearance="primary" onClick={() => navigate('/shop')}>Browse the shop</Button></Card> : <>
      {unavailable.length > 0 && <MessageBar intent="error"><MessageBarBody>One or more cart products are unavailable or no longer listed. Remove them before checkout.</MessageBarBody></MessageBar>}
      <div className="customer-cart-list">{cart.items.map((item) => {
        const product = products[item.productId];
        if (!product) return <Card key={item.productId} className="customer-cart-row"><div><Subtitle1>Product unavailable</Subtitle1><Caption1>{item.productId}</Caption1></div><Button appearance="subtle" icon={<DeleteRegular />} aria-label="Remove unavailable product" onClick={() => cart.remove(item.productId)} /></Card>;
        const available = isAvailable(product);
        return <Card key={item.productId} className="customer-cart-row">
          <img src={product.image} alt={product.name} />
          <div className="customer-cart-product"><Subtitle1>{product.name}</Subtitle1><Caption1>{product.category} · {available ? 'Available' : 'Unavailable'}</Caption1><Caption1>Warranty: {product.warranty?.trim() || 'Information not available'}</Caption1><strong>{money(product.pricePk)}</strong></div>
          <div className="quantity-control"><Button appearance="subtle" icon={<SubtractRegular />} aria-label={`Decrease ${product.name} quantity`} disabled={item.quantity <= 1} onClick={() => cart.setQuantity(item.productId, item.quantity - 1)} /><span>{item.quantity}</span><Button appearance="subtle" icon={<AddRegular />} aria-label={`Increase ${product.name} quantity`} disabled={item.quantity >= 99} onClick={() => cart.setQuantity(item.productId, item.quantity + 1)} /></div>
          <Button appearance="subtle" icon={<DeleteRegular />} aria-label={`Remove ${product.name}`} onClick={() => cart.remove(item.productId)} />
        </Card>;
      })}</div>
      {quote && <Totals quote={quote} />}
      <div className="customer-actions"><Button appearance="subtle" onClick={() => navigate('/shop')}>Continue shopping</Button><Button appearance="primary" icon={<ArrowRightRegular />} iconPosition="after" disabled={loading || unavailable.length > 0 || !quote} onClick={() => navigate('/checkout')}>Continue to checkout</Button></div>
    </>}</div>;
}

export function WishlistPage({ navigate }: { navigate: Navigate }) {
  const wishlist = useCustomerWishlist();
  const cart = useCustomerCart();
  const [products, setProducts] = useState<Record<string, Product | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void api.getProductsByIds(wishlist.items)
      .then((rows) => { if (active) setProducts(Object.fromEntries(rows.map((product) => [product.id, product]))); })
      .catch((reason: unknown) => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wishlist.items]);
  return <div className="page-content narrow">
    <div className="section-head">
      <div><Caption1 className="section-kicker">YOUR GARAGE</Caption1><Title1 as="h1">Your wishlist.</Title1></div>
      {wishlist.items.length > 0 && <Button appearance="subtle" icon={<DeleteRegular />} onClick={wishlist.clear}>Clear wishlist</Button>}
    </div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {loading ? <div className="customer-loading"><Skeleton><SkeletonItem size={24} /><SkeletonItem /><SkeletonItem /></Skeleton></div> : wishlist.items.length === 0 ? (
      <Card className="empty-state">
        <HeartRegular />
        <Title3 as="h2">Your wishlist is empty.</Title3>
        <Body1>Tap the heart on any product to save it here for later.</Body1>
        <Button appearance="primary" onClick={() => navigate('/shop')}>Browse the shop</Button>
      </Card>
    ) : (
      <div className="customer-cart-list">{wishlist.items.map((productId) => {
        const product = products[productId];
        if (!product) return <Card key={productId} className="customer-cart-row"><div><Subtitle1>Product unavailable</Subtitle1><Caption1>{productId}</Caption1></div><Button appearance="subtle" icon={<DeleteRegular />} aria-label="Remove unavailable product from wishlist" onClick={() => wishlist.remove(productId)} /></Card>;
        const available = isAvailable(product);
        return <Card key={productId} className="customer-cart-row wishlist-row">
          <img src={product.image} alt={product.name} />
          <div className="customer-cart-product">
            <Subtitle1>{product.name}</Subtitle1>
            <Caption1>{product.category} · {available ? 'Available' : 'Unavailable'}</Caption1>
            <strong>{money(product.pricePk)}</strong>
          </div>
          <div className="wishlist-row-actions">
            <Button appearance="primary" size="small" icon={<CartRegular />} disabled={!available} onClick={() => cart.add(product.id)}>
              {available ? 'Add to cart' : 'Out of stock'}
            </Button>
            <Button appearance="subtle" size="small" icon={<HeartFilled />} aria-label={`Remove ${product.name} from wishlist`} onClick={() => wishlist.remove(productId)}>
              Remove
            </Button>
          </div>
        </Card>;
      })}</div>
    )}
  </div>;
}

export function CheckoutPage({ navigate }: { navigate: Navigate }) {
  const auth = useCustomerAuth();
  const cart = useCustomerCart();
  const [shipping, setShipping] = useState<ShippingDetails>({ full_name: '', phone: '', email: auth.user?.email ?? '', address: '', city: '', province: '' });
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<CustomerOrderQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [useFallbackQuote, setUseFallbackQuote] = useState(false);
  
  useEffect(() => {
    let active = true;
    if (!auth.user) return;
    void getCustomerProfile(auth.user.id).then((profile) => {
      if (active) setShipping({ full_name: profile.full_name, phone: profile.phone, email: profile.email || auth.user?.email || '', address: profile.address ?? '', city: profile.city ?? '', province: profile.province ?? '' });
    }).catch((reason: unknown) => { if (active && !error) setError(errorText(reason)); });
    return () => { active = false; };
  }, [auth.user?.id]);
  
  useEffect(() => {
    let active = true;
    setQuote(null); setError(''); setUseFallbackQuote(false);
    if (!cart.items.length) return () => { active = false; };
    const requestItems: QuoteRequestItem[] = cart.items.map((item) => ({ product_id: item.productId, quantity: item.quantity }));
    void quoteCustomerOrder(requestItems)
      .then((value) => { if (active) setQuote(value); })
      .catch(() => {
        if (!active) return;
        // Server quote unavailable — estimate totals from catalog prices.
        void api.getProductsByIds(requestItems.map((item) => item.product_id))
          .then((rows) => {
            if (!active) return;
            const fallback = buildFallbackQuote(rows, requestItems);
            if (fallback) {
              setQuote(fallback);
              setUseFallbackQuote(true);
            } else {
              setError('Order totals are temporarily unavailable. Please try again shortly.');
            }
          })
          .catch(() => { if (active) setError('Order totals are temporarily unavailable. Please try again shortly.'); });
      });
    return () => { active = false; };
  }, [cart.items]);
  
  const setField = (field: keyof ShippingDetails, value: string) => setShipping((current) => ({ ...current, [field]: value }));
  
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!auth.user) { navigate('/login?next=/checkout'); return; }
    if (!cart.items.length) { setError('Your cart is empty.'); return; }
    if (!shipping.province) { setError('Please select a province.'); return; }
    setBusy(true);
    try {
      const created = await createCustomerOrder(cart.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })), shipping, notes);
      cart.clear();
      navigate(`/order-success/${created.id}`);
    } catch (reason: unknown) {
      const errMsg = errorText(reason);
      // Check if it's a specific database error
      if (errMsg.includes('quote_customer_order') || errMsg.includes('function') || errMsg.includes('RPC')) {
        setError('Server configuration issue. Please contact support or try again later.');
      } else {
        setError(errMsg);
      }
    }
    finally { setBusy(false); }
  };
  
  if (cart.items.length === 0) return <div className="page-content narrow"><Card className="empty-state"><Title3 as="h2">Your cart is empty.</Title3><Button appearance="primary" onClick={() => navigate('/shop')}>Browse the shop</Button></Card></div>;
  
  return <div className="page-content narrow"><Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={() => navigate('/cart')}>Back to cart</Button><div className="account-head"><div><Caption1 className="section-kicker">CASH ON DELIVERY</Caption1><Title1 as="h1">Delivery details.</Title1><Body1>Your order is charged only on delivery. No online payment is collected.</Body1></div></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {useFallbackQuote && <MessageBar intent="info"><MessageBarBody>Order totals estimated. Final amount confirmed on delivery.</MessageBarBody></MessageBar>}
    <div className="checkout-layout customer-checkout-layout"><form className="checkout-form" onSubmit={(event) => void submit(event)}>
      <CardHeader header={<Subtitle1>Delivery address</Subtitle1>} description="Enter the details for this order." />
      <div className="form-grid customer-form-grid">
        <Field label="Full name" required><Input autoComplete="name" value={shipping.full_name} onChange={(_, data) => setField('full_name', data.value)} required /></Field>
        <Field label="Phone number" required><Input autoComplete="tel" value={shipping.phone} onChange={(_, data) => setField('phone', data.value)} required /></Field>
        <Field label="Email" required><Input type="email" autoComplete="email" value={shipping.email} onChange={(_, data) => setField('email', data.value)} required /></Field>
        <Field label="Complete delivery address" required className="customer-wide"><Textarea autoComplete="street-address" value={shipping.address} onChange={(_, data) => setField('address', data.value)} required /></Field>
        <Field label="City" required><Input autoComplete="address-level2" value={shipping.city} onChange={(_, data) => setField('city', data.value)} required /></Field>
        <Field label="Province / territory" required>
        <Select value={shipping.province} onChange={(_, data) => setField('province', data.value)} required>
          <Option value="">Select province</Option>
          {provinces.map((province) => <Option key={province} value={province}>{province}</Option>)}
        </Select>
      </Field>
        <Field label="Order notes" className="customer-wide"><Textarea value={notes} onChange={(_, data) => setNotes(data.value)} maxLength={1000} /></Field>
      </div>
      <div className="payment-method"><Badge appearance="filled" color="brand">Cash on Delivery</Badge><Caption1>Payment status remains pending until confirmed outside this checkout.</Caption1></div>
      <Button appearance="primary" type="submit" disabled={busy || !quote}>{busy ? 'Placing order…' : 'Place COD order'}</Button>
    </form><div className="customer-order-review"><OrderReview quote={quote} /></div></div>
    <DeliveryInfo deliveryFee={quote?.delivery_fee} navigate={navigate} />
  </div>;
}

function OrderReview({ quote }: { quote: CustomerOrderQuote | null }) {
  return <Card className="summary-card customer-review-card"><CardHeader header={<Subtitle1>Order summary</Subtitle1>} />
    {!quote ? <div className="customer-loading"><Skeleton><SkeletonItem /><SkeletonItem /><SkeletonItem /></Skeleton></div> : <>
      {quote.items.map((item) => <div className="summary-line customer-review-item" key={item.product_id}><span>{item.product_name} × {item.quantity}</span><b>{money(item.line_total)}</b></div>)}
      <Divider /><div className="summary-line"><span>Subtotal</span><b>{money(quote.subtotal)}</b></div><div className="summary-line"><span>Delivery fee</span><b>{money(quote.delivery_fee)}</b></div>
      {quote.discount_amount > 0 && <div className="summary-line"><span>Product discount</span><b>−{money(quote.discount_amount)}</b></div>}
      <div className="summary-line total"><span>Total due on delivery</span><b>{money(quote.total)}</b></div>
    </>}
  </Card>;
}

export function AccountPage({ navigate }: { navigate: Navigate }) {
  const auth = useCustomerAuth();
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '', address: '', city: '', province: '' });
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    if (!auth.user) return;
    setBusy(true);
    void Promise.all([getCustomerProfile(auth.user.id), getCustomerOrders()])
      .then(([value, history]) => { if (active) { setProfile({ full_name: value.full_name, phone: value.phone, email: value.email, address: value.address ?? '', city: value.city ?? '', province: value.province ?? '' }); setOrders(history); } })
      .catch((reason: unknown) => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [auth.user?.id]);
  const setField = (field: keyof typeof profile, value: string) => setProfile((current) => ({ ...current, [field]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!auth.user) return;
    setSaving(true); setError(''); setNotice('');
    try {
      if (profile.email.trim() !== auth.user.email) await updateCustomerEmail(profile.email.trim());
      const saved = await updateCustomerProfile(auth.user.id, { full_name: profile.full_name, phone: profile.phone, address: profile.address || null, city: profile.city || null, province: profile.province || null });
      setProfile({ full_name: saved.full_name, phone: saved.phone, email: saved.email, address: saved.address ?? '', city: saved.city ?? '', province: saved.province ?? '' });
      auth.setProfile(saved); setNotice('Profile updated. If you changed email, confirm it using the message sent to that address.');
    } catch (reason: unknown) { setError(errorText(reason)); }
    finally { setSaving(false); }
  };
  return <div className="page-content">
    <div className="account-head"><div><Caption1 className="section-kicker">RIDER ACCOUNT</Caption1><Title1 as="h1">Your account.</Title1><Body1>Profile information and your order history.</Body1></div>
      <div className="account-head-actions">
        {auth.user?.app_metadata.role === 'admin' && <Button appearance="primary" icon={<ShieldCheckmarkRegular />} onClick={() => navigate('/admin')}>Admin console</Button>}
        <Button appearance="subtle" onClick={() => void auth.signOut().then(() => navigate('/'))}>Sign out</Button>
      </div>
    </div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}{notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
    <div className="account-content-grid"><Card className="profile-card"><CardHeader header={<Subtitle1>Customer profile</Subtitle1>} />{busy ? <Skeleton><SkeletonItem /><SkeletonItem /><SkeletonItem /></Skeleton> : <form className="profile-form" onSubmit={(event) => void save(event)}>
      <Field label="Full name" required><Input autoComplete="name" value={profile.full_name} onChange={(_, data) => setField('full_name', data.value)} required /></Field>
      <Field label="Phone number"><Input autoComplete="tel" value={profile.phone} onChange={(_, data) => setField('phone', data.value)} /></Field>
      <Field label="Email" required><Input type="email" autoComplete="email" value={profile.email} onChange={(_, data) => setField('email', data.value)} required /></Field>
      <Field label="Address"><Textarea autoComplete="street-address" value={profile.address} onChange={(_, data) => setField('address', data.value)} /></Field>
      <div className="form-grid"><Field label="City"><Input autoComplete="address-level2" value={profile.city} onChange={(_, data) => setField('city', data.value)} /></Field><Field label="Province / territory"><Select value={profile.province} onChange={(_, data) => setField('province', data.value)}><Option value="">Select province</Option>{provinces.map((province) => <Option key={province} value={province}>{province}</Option>)}</Select></Field></div>
      <Button appearance="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
    </form>}</Card>
      <section className="account-orders"><div className="section-head"><div><Caption1 className="section-kicker">ORDER HISTORY</Caption1><Title3 as="h2">Your orders</Title3></div><Badge>{orders.length} orders</Badge></div>
        {busy ? <Skeleton><SkeletonItem /><SkeletonItem /></Skeleton> : orders.length === 0 ? <Card className="empty-state"><Title3 as="h2">No orders yet.</Title3><Body1>Your placed orders will appear here.</Body1><Button appearance="primary" onClick={() => navigate('/shop')}>Shop the catalog</Button></Card> : orders.map((order) => <CustomerOrderCard key={order.id} order={order} navigate={navigate} />)}
      </section>
    </div>
  </div>;
}

function CustomerOrderCard({ order, navigate }: { order: CustomerOrder; navigate: Navigate }) {
  return <Card className="order-card customer-order-card"><div><Subtitle1>{order.order_number}</Subtitle1><Caption1>{new Date(order.created_at).toLocaleString()} · Cash on Delivery</Caption1></div><div className="order-meta"><Badge appearance="tint">{statusLabel(order.status)}</Badge><strong>{money(order.total)}</strong><Button appearance="subtle" onClick={() => navigate(`/orders/${order.id}`)}>View order</Button></div></Card>;
}

export function OrdersPage({ navigate }: { navigate: Navigate }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getCustomerOrders().then((rows) => { if (active) setOrders(rows); }).catch((reason: unknown) => { if (active) setError(errorText(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="page-content"><div className="account-head"><div><Caption1 className="section-kicker">RIDER ACCOUNT</Caption1><Title1 as="h1">Your orders.</Title1></div><Button appearance="subtle" onClick={() => navigate('/account')}>Profile</Button></div>
    {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    {loading ? <Skeleton><SkeletonItem /><SkeletonItem /></Skeleton> : orders.length === 0 ? <Card className="empty-state"><Title3 as="h2">No orders yet.</Title3><Body1>Orders you place will be listed here.</Body1><Button appearance="primary" onClick={() => navigate('/shop')}>Browse the shop</Button></Card> : <div className="customer-orders-list">{orders.map((order) => <CustomerOrderCard key={order.id} order={order} navigate={navigate} />)}</div>}
  </div>;
}

export function OrderDetailsPage({ orderId }: { orderId: string }) {
  const [details, setDetails] = useState<CustomerOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getCustomerOrderDetails(orderId).then((value) => { if (active) setDetails(value); }).catch((reason: unknown) => { if (active) setError(errorText(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);
  if (loading) return <div className="page-content narrow"><Skeleton><SkeletonItem size={24} /><SkeletonItem /><SkeletonItem /></Skeleton></div>;
  if (error || !details) return <div className="page-content narrow"><MessageBar intent="error"><MessageBarBody>{error || 'Order not found.'}</MessageBarBody></MessageBar></div>;
  const { order, items, timeline } = details;
  return <div className="page-content narrow"><div className="account-head"><div><Caption1 className="section-kicker">ORDER TRACKING</Caption1><Title1 as="h1">{order.order_number}</Title1><Body1>Placed {new Date(order.created_at).toLocaleString()}</Body1></div><div style={{display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap'}}><Badge appearance="filled" color="brand">{statusLabel(order.status)}</Badge><Button appearance="secondary" onClick={() => setShowInvoice(true)}>View Invoice</Button><Button appearance="subtle" icon={<PrintRegular />} onClick={() => window.print()}>Print</Button></div></div>
    <div className="order-detail-grid"><Card className="order-detail-card"><CardHeader header={<Subtitle1>Items</Subtitle1>} />{items.map((item) => <div className="summary-line customer-review-item" key={item.id}><div><b>{item.product_name}</b><Caption1>SKU {item.product_sku} · Quantity {item.quantity} · {money(item.unit_price)} each</Caption1><Caption1>Warranty: {item.warranty?.trim() || 'Information not available'}</Caption1></div><strong>{money(item.line_total)}</strong></div>)}<Divider /><div className="summary-line"><span>Subtotal</span><b>{money(order.subtotal)}</b></div><div className="summary-line"><span>Delivery</span><b>{money(order.delivery_fee)}</b></div>{order.discount_amount > 0 && <div className="summary-line"><span>Discount</span><b>−{money(order.discount_amount)}</b></div>}<div className="summary-line total"><span>Total</span><b>{money(order.total)}</b></div>
      <div className="order-payment"><Badge appearance="tint">Cash on Delivery</Badge><Badge appearance="tint">Payment {statusLabel(order.payment_status)}</Badge></div></Card>
      <Card className="shipping-card"><CardHeader header={<Subtitle1>Shipping information</Subtitle1>} /><Body1>{order.shipping_full_name}</Body1><Body1>{order.shipping_phone}</Body1><Body1>{order.shipping_email}</Body1><Body1>{order.shipping_address}</Body1><Body1>{order.shipping_city}, {order.shipping_province}</Body1>{order.tracking_number && <Body1>Tracking number: {order.tracking_number}</Body1>}{order.courier && <Body1>Courier: {order.courier}</Body1>}{order.customer_notes && <><Divider /><Caption1>Order notes</Caption1><Body1>{order.customer_notes}</Body1></>}</Card>
    </div>
    <DeliveryInfo order={order} deliveryFee={order.delivery_fee} />
    <Card className="timeline-card"><CardHeader header={<Subtitle1>Order timeline</Subtitle1>} /><ol className="order-timeline">{timeline.map((event, index) => <li className="order-timeline-event" key={event.id}><span className={`timeline-marker${index === timeline.length - 1 ? ' current' : ''}`}><CheckmarkCircleRegular /></span><div><b>{statusLabel(event.status)}</b><Caption1>{new Date(event.changed_at).toLocaleString()}</Caption1></div></li>)}</ol>{timeline.length === 0 && <Caption1>No status updates have been recorded.</Caption1>}</Card>
    <CustomerReturnRequest order={order} items={items} />
    <OrderFeedbackForm order={order} items={items} />
    <InvoiceModal isOpen={showInvoice} onClose={() => setShowInvoice(false)} order={order} items={items} type="customer" />
  </div>;
}

export function OrderSuccessPage({ orderId, navigate }: { orderId: string; navigate: Navigate }) {
  const [details, setDetails] = useState<CustomerOrderDetails | null>(null);
  const [error, setError] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void getCustomerOrderDetails(orderId).then((value) => {
      if (!active) return;
      setDetails(value);
      setShowInvoice(true);
    }).catch((reason: unknown) => { if (active) setError(errorText(reason)); });
    return () => { active = false; };
  }, [orderId]);
  if (error) return <div className="page-content narrow"><MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar><Button appearance="primary" onClick={() => navigate('/orders')}>View orders</Button></div>;
  if (!details) return <div className="page-content narrow"><Skeleton><SkeletonItem size={24} /><SkeletonItem /><SkeletonItem /></Skeleton></div>;
  const { order, items } = details;
  const currentStage = stageIndexFor(order.status);
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);

  const copyInvoiceNumber = () => {
    void navigator.clipboard?.writeText(order.order_number)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2200); })
      .catch(() => setCopied(false));
  };

  return <div className="page-content narrow order-success-page">
    <Card className="success-hero">
      <span className="success-ring"><CheckmarkCircleRegular /></span>
      <Caption1 className="section-kicker">ORDER CONFIRMED</Caption1>
      <Title1 as="h1">Thank you for your order</Title1>
      <Body1 className="success-lead">
        We have received your order and it is now with our team. You only pay the courier when the parcel reaches your door.
      </Body1>

      <div className="invoice-ref">
        <Caption1 className="invoice-ref-label">Invoice number</Caption1>
        <div className="invoice-ref-row">
          <b>{order.order_number}</b>
          <Button size="small" appearance="secondary" onClick={copyInvoiceNumber}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="success-stats">
        <div className="stat"><span>Amount due on delivery</span><b>{money(order.total)}</b></div>
        <div className="stat"><span>Items</span><b>{totalUnits} unit{totalUnits !== 1 ? 's' : ''}</b></div>
        <div className="stat"><span>Current status</span><b>{statusLabel(order.status)}</b></div>
      </div>
    </Card>

    <Card className="tracking-card">
      <CardHeader header={<Subtitle1>Track your order</Subtitle1>} />
      <ol className="track-steps">
        {TRACKING_STAGES.map((stage, index) => {
          const done = index <= currentStage;
          const isCurrent = index === currentStage;
          return <li key={stage.label} className={`track-step${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}>
            <span className="track-dot">{done ? <CheckmarkCircleRegular /> : null}</span>
            <div className="track-text">
              <b>{stage.label}</b>
              <Caption1>{stage.hint}</Caption1>
            </div>
          </li>;
        })}
      </ol>
      <Button appearance="secondary" icon={<ArrowRightRegular />} iconPosition="after" onClick={() => navigate(`/orders/${order.id}`)}>
        Open full tracking
      </Button>
    </Card>

    <OrderReview quote={{ items: items.map((item) => ({ product_id: item.product_id ?? item.id, product_name: item.product_name, product_sku: item.product_sku, quantity: item.quantity, base_unit_price: item.base_unit_price, unit_price: item.unit_price, discount_amount: item.discount_amount, line_total: item.line_total })), subtotal: order.subtotal, delivery_fee: order.delivery_fee, discount_amount: order.discount_amount, total: order.total }} />
    <DeliveryInfo order={order} deliveryFee={order.delivery_fee} navigate={navigate} />

    <div className="customer-actions">
      <Button appearance="subtle" onClick={() => navigate('/shop')}>Continue shopping</Button>
      <Button appearance="secondary" icon={<PrintRegular />} onClick={() => setShowInvoice(true)}>Download invoice</Button>
      <Button appearance="primary" onClick={() => navigate(`/orders/${order.id}`)}>Track this order</Button>
    </div>
    <InvoiceModal isOpen={showInvoice} onClose={() => setShowInvoice(false)} order={order} items={items} type="customer" />
  </div>;
}

function Totals({ quote }: { quote: CustomerOrderQuote }) {
  return <Card className="summary-card customer-cart-totals"><div className="summary-line"><span>Subtotal</span><b>{money(quote.subtotal)}</b></div><div className="summary-line"><span>Delivery fee</span><b>{money(quote.delivery_fee)}</b></div>{quote.discount_amount > 0 && <div className="summary-line"><span>Product discount</span><b>−{money(quote.discount_amount)}</b></div>}<Divider /><div className="summary-line total"><span>Total</span><b>{money(quote.total)}</b></div></Card>;
}

function isAvailable(product: Product): boolean {
  if (product.availabilityStatus) return product.availabilityStatus === 'AVAILABLE';
  const state = product.status.toUpperCase();
  return !state.includes('UNAVAILABLE') && !state.includes('LIMITED') && !state.includes('LOW STOCK') && !state.includes('CHECK REQUIRED');
}
