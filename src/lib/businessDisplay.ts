export interface BusinessDisplaySettings {
  businessName: string;
  currency: string;
  deliveryFee: number;
}

let settings: BusinessDisplaySettings = {
  businessName: 'MotoGear PK',
  currency: 'PKR',
  deliveryFee: 0,
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