import { z } from 'zod';
import type { HealthResponse, Order, Product } from './types';

export const routeContracts = {
  health: { method: 'GET', path: '/api/health', response: {} as HealthResponse },
  catalog: { method: 'GET', path: '/api/catalog', response: [] as Product[] },
  product: { method: 'GET', path: '/api/products/:slug', params: z.object({ slug: z.string().min(1) }), response: {} as Product },
  accountOrders: { method: 'GET', path: '/api/account/orders', response: [] as Order[] },
  adminOrders: { method: 'GET', path: '/api/admin/orders', response: [] as Order[] },
} as const;

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'SERVICE_UNAVAILABLE';
export interface ApiErrorResponse { error: { code: ApiErrorCode; message: string; details?: Record<string, string> }; }

export function validateProductParams(params: unknown): { slug: string } {
  return routeContracts.product.params.parse(params);
}
