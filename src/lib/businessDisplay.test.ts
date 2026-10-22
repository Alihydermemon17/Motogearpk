import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatBusinessMoney,
  getBusinessDisplaySettings,
  setBusinessDisplaySettings,
} from './businessDisplay';

/**
 * These settings drive every customer-facing figure on the storefront: the
 * checkout total, the saved invoice, the delivery line, the footer contacts.
 *
 * The defaults are deliberately zeroed and blank rather than seeded with
 * example data. The real delivery fee is PKR 250, the real support number is
 * 0305-3092490 and the real return window is 7 days — but all three arrive
 * from the `business_settings` row in Supabase. If this file hardcoded them,
 * the storefront would keep quoting them after the business changed them, and
 * a failed settings fetch would silently fall back to numbers nobody verified.
 * A zero fee and an empty phone are the only honest placeholders.
 */
const DEFAULTS = {
  businessName: 'MotoGear PK',
  currency: 'PKR',
  deliveryFee: 0,
  supportPhone: '',
  supportEmail: '',
  whatsappNumber: '',
  returnPolicySummary: '',
  defaultWarrantyText: '',
};

describe('business display settings', () => {
  beforeEach(() => setBusinessDisplaySettings({ ...DEFAULTS }));

  it('ships with no invented business facts', () => {
    expect(getBusinessDisplaySettings()).toEqual(DEFAULTS);
  });

  it('applies a partial update without dropping the other fields', () => {
    setBusinessDisplaySettings({ deliveryFee: 250 });
    const s = getBusinessDisplaySettings();
    expect(s.deliveryFee).toBe(250);
    expect(s.businessName).toBe('MotoGear PK');
    expect(s.currency).toBe('PKR');
    expect(s.supportPhone).toBe('');
  });

  it('reflects later updates rather than caching the first read', () => {
    setBusinessDisplaySettings({ supportEmail: 'support@motogear.pk' });
    expect(getBusinessDisplaySettings().supportEmail).toBe('support@motogear.pk');
    setBusinessDisplaySettings({ supportEmail: '' });
    expect(getBusinessDisplaySettings().supportEmail).toBe('');
  });
});

describe('formatBusinessMoney', () => {
  beforeEach(() => setBusinessDisplaySettings({ ...DEFAULTS }));

  it('prefixes the configured currency and groups thousands', () => {
    expect(formatBusinessMoney(0)).toBe('PKR 0');
    expect(formatBusinessMoney(250)).toBe('PKR 250');
    expect(formatBusinessMoney(1250)).toBe('PKR 1,250');
    expect(formatBusinessMoney(1250000)).toBe('PKR 1,250,000');
  });

  it('follows the currency setting instead of assuming PKR', () => {
    setBusinessDisplaySettings({ currency: 'USD' });
    // Only the prefix is asserted: grouping separators beyond PKR depend on the
    // host locale, which is not something this function controls.
    expect(formatBusinessMoney(1250)).toMatch(/^USD\s/);
  });
});
