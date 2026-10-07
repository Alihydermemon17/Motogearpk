import { api } from './index';
import { validateProductParams } from './contracts';

export const routeHandlers = {
  health: () => api.getHealth(),
  catalog: () => api.getCatalog(),
  product: (params: unknown) => api.getProduct(validateProductParams(params).slug),
  accountOrders: () => api.getAccountOrders(),
  adminOrders: () => api.getAdminOrders(),
};
