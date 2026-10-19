export interface BusinessDisplaySettings {
  businessName: string;
  currency: string;
  deliveryFee: number;
  supportPhone: string;
  supportEmail: string;
  whatsappNumber: string;
  returnPolicySummary: string;
  defaultWarrantyText: string;
}

let settings: BusinessDisplaySettings = {
  businessName: 'MotoGear PK',
  currency: 'PKR',
  deliveryFee: 0,
  supportPhone: '',
  supportEmail: '',
  whatsappNumber: '',
  returnPolicySummary: '',
  defaultWarrantyText: '',
};

export function setBusinessDisplaySettings(next: Partial<BusinessDisplaySettings>): void {
  settings = { ...settings, ...next };
}

export function getBusinessDisplaySettings(): BusinessDisplaySettings {
  return settings;
}

export function formatBusinessMoney(amount: number): string {
  const locale = settings.currency === 'PKR' ? 'en-PK' : undefined;
  return `${settings.currency} ${amount.toLocaleString(locale)}`;
}