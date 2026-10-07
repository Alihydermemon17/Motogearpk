import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getCustomerProfile, type CustomerProfile } from '../api/customer';

export interface CartEntry {
  productId: string;
  quantity: number;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: CustomerProfile | null;
  loading: boolean;
  error: string;
  signUp(email: string, password: string, fullName: string, phone: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  setProfile(profile: CustomerProfile): void;
}

interface CartState {
  items: CartEntry[];
  count: number;
  add(productId: string): void;
  setQuantity(productId: string, quantity: number): void;
  remove(productId: string): void;
  clear(): void;
}

interface WishlistState {
  items: string[];
  count: number;
  has(productId: string): boolean;
  toggle(productId: string): void;
  remove(productId: string): void;
  clear(): void;
}

const AuthContext = createContext<AuthState | null>(null);
const CartContext = createContext<CartState | null>(null);
const WishlistContext = createContext<WishlistState | null>(null);
const CART_KEY = 'motogearpk.cart.v1';
const WISHLIST_KEY = 'motogearpk.wishlist.v1';

export function CustomerStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<CartEntry[]>(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(CART_KEY) ?? '[]');
      if (!Array.isArray(stored)) return [];
      return stored.flatMap((item: unknown) => {
        if (typeof item !== 'object' || item === null) return [];
        const candidate = item as { productId?: unknown; quantity?: unknown };
        if (typeof candidate.productId !== 'string' || !Number.isInteger(candidate.quantity) || Number(candidate.quantity) < 1 || Number(candidate.quantity) > 99) return [];
        return [{ productId: candidate.productId, quantity: Number(candidate.quantity) }];
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) setProfile(null);
      setError('');
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session?.user.id) {
      setProfile(null);
      return;
    }
    void getCustomerProfile(session.user.id)
      .then((value) => { if (active) setProfile(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your customer profile.'); });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const [wishlistItems, setWishlistItems] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(WISHLIST_KEY) ?? '[]');
      if (!Array.isArray(stored)) return [];
      return [...new Set(stored.filter((item): item is string => typeof item === 'string' && item.length > 0))];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const auth = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    error,
    async signUp(email, password, fullName, phone) {
      if (!supabase) throw new Error('Configure Supabase to create a customer account.');
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (signUpError) throw signUpError;
    },
    async signIn(email, password) {
      if (!supabase) throw new Error('Configure Supabase to sign in.');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    },
    async signInWithGoogle() {
      if (!supabase) throw new Error('Configure Supabase to sign in with Google.');
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/account` },
      });
      if (oauthError) throw oauthError;
    },
    async signOut() {
      if (!supabase) return;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    async refreshProfile() {
      if (!session?.user.id) return;
      setProfile(await getCustomerProfile(session.user.id));
    },
    setProfile,
  }), [session, profile, loading, error]);

  const cart = useMemo<CartState>(() => ({
    items,
    count: items.reduce((total, item) => total + item.quantity, 0),
    add(productId) {
      setItems((current) => {
        const found = current.find((item) => item.productId === productId);
        if (found) return current.map((item) => item.productId === productId ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item);
        return [...current, { productId, quantity: 1 }];
      });
    },
    setQuantity(productId, quantity) {
      if (!Number.isInteger(quantity) || quantity < 1) return;
      setItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity: Math.min(99, quantity) } : item));
    },
    remove(productId) { setItems((current) => current.filter((item) => item.productId !== productId)); },
    clear() { setItems([]); },
  }), [items]);

  const wishlist = useMemo<WishlistState>(() => ({
    items: wishlistItems,
    count: wishlistItems.length,
    has(productId) { return wishlistItems.includes(productId); },
    toggle(productId) {
      setWishlistItems((current) => current.includes(productId)
        ? current.filter((item) => item !== productId)
        : [...current, productId]);
    },
    remove(productId) { setWishlistItems((current) => current.filter((item) => item !== productId)); },
    clear() { setWishlistItems([]); },
  }), [wishlistItems]);

  return (
    <AuthContext.Provider value={auth}>
      <CartContext.Provider value={cart}>
        <WishlistContext.Provider value={wishlist}>{children}</WishlistContext.Provider>
      </CartContext.Provider>
    </AuthContext.Provider>
  );
}

export function useCustomerAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('CustomerStateProvider is missing.');
  return value;
}

export function useCustomerCart(): CartState {
  const value = useContext(CartContext);
  if (!value) throw new Error('CustomerStateProvider is missing.');
  return value;
}

export function useCustomerWishlist(): WishlistState {
  const value = useContext(WishlistContext);
  if (!value) throw new Error('CustomerStateProvider is missing.');
  return value;
}
