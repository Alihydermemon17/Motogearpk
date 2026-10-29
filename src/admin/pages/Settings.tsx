import { useEffect, useState } from 'react';
import { OpenRegular } from '@fluentui/react-icons';
import {
  getBusinessSettings,
  saveBusinessSettings,
  type BusinessSettings,
} from '../../api/admin';
import { useLeaveGuard } from '../AdminDashboard';
import {
  EmptyState,
  PageHeader,
  ToastHost,
  failureText,
  useToast,
} from '../components/ui';

type FormState = Record<keyof BusinessSettings, string>;

const emptyForm: FormState = {
  business_name: '',
  currency: 'PKR',
  delivery_fee: '',
  support_phone: '',
  support_email: '',
  whatsapp_number: '',
  return_policy_summary: '',
  default_warranty_text: '',
};

const RETURN_LIMIT = 600;
const WARRANTY_LIMIT = 300;

export function SettingsPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const settings = await getBusinessSettings();
      const next: FormState = {
        ...emptyForm,
        ...Object.fromEntries(
          Object.entries(settings).map(([key, value]) => [key, value ?? '']),
        ),
      } as FormState;
      next.currency = next.currency || 'PKR';
      setForm(next);
      setBaseline(JSON.stringify(next));
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      setLoadError(failureText(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const dirty = JSON.stringify(form) !== baseline && !loading;
  useLeaveGuard(dirty, 'You have unsaved settings. Leave without saving?');

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.business_name.trim()) next.business_name = 'Store name is required.';
    if (form.support_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.support_email.trim())) {
      next.support_email = 'Enter a valid email address.';
    }
    const phoneDigits = form.support_phone.replace(/[^0-9]/g, '');
    if (form.support_phone.trim() && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      next.support_phone = 'Use a phone number with 10–15 digits.';
    }
    const whatsappDigits = form.whatsapp_number.replace(/[^0-9]/g, '');
    if (form.whatsapp_number.trim() && (whatsappDigits.length < 10 || whatsappDigits.length > 15)) {
      next.whatsapp_number = 'Use a WhatsApp number with 10–15 digits.';
    }
    if (form.delivery_fee.trim() === '' || Number.isNaN(Number(form.delivery_fee)) || Number(form.delivery_fee) < 0) {
      next.delivery_fee = 'Enter a delivery fee of zero or more.';
    }
    if (form.return_policy_summary.length > RETURN_LIMIT) {
      next.return_policy_summary = `Keep the return policy under ${RETURN_LIMIT} characters.`;
    }
    if (form.default_warranty_text.length > WARRANTY_LIMIT) {
      next.default_warranty_text = `Keep the warranty text under ${WARRANTY_LIMIT} characters.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.error('Check the highlighted fields and try again.');
      return;
    }
    setSaving(true);
    try {
      await saveBusinessSettings({
        business_name: form.business_name.trim(),
        currency: 'PKR',
        delivery_fee: String(Math.round(Number(form.delivery_fee))),
        support_phone: form.support_phone.trim(),
        support_email: form.support_email.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
        return_policy_summary: form.return_policy_summary,
        default_warranty_text: form.default_warranty_text,
      });
      setBaseline(JSON.stringify({ ...form, currency: 'PKR' }));
      toast.success('Store settings saved.');
      setUpdatedAt(Date.now());
    } catch (reason: unknown) {
      toast.error(failureText(reason));
    } finally {
      setSaving(false);
    }
  };

  const whatsappDigits = form.whatsapp_number.replace(/[^0-9]/g, '');

  if (loading) {
    return (
      <div className="adm-page">
        <PageHeader crumb="System / Settings" title="Store settings" description="Loading the current store configuration." />
        <div className="adm-settings-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => <div className="adm-card adm-sk-panel" key={index} />)}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="adm-page">
        <PageHeader crumb="System / Settings" title="Store settings" description="The store configuration could not be loaded." updatedAt={updatedAt} onRefresh={() => void load()} refreshing={loading} />
        <EmptyState title="Settings are unavailable" body={loadError} actionLabel="Try again" onAction={() => void load()} />
      </div>
    );
  }

  return (
    <div className={`adm-page adm-settings${dirty ? ' is-dirty' : ''}`}>
      <PageHeader
        crumb="System / Settings"
        title="Store settings"
        description="The copy and contact details the storefront reads."
        updatedAt={updatedAt}
        onRefresh={() => void load()}
        refreshing={loading}
      />

      <div className="adm-settings-grid">
        <section className="adm-card" aria-labelledby="settings-store">
          <header className="adm-card-head">
            <div>
              <h2 id="settings-store">Store</h2>
              <p>The name used across the storefront and admin.</p>
            </div>
          </header>
          <div className="adm-form-grid">
            <label className="adm-field is-wide">
              <span>Store name</span>
              <input value={form.business_name} onChange={(event) => setField('business_name', event.target.value)} aria-invalid={Boolean(errors.business_name)} />
              {errors.business_name && <small className="is-error">{errors.business_name}</small>}
            </label>
            <label className="adm-field is-wide">
              <span>Currency</span>
              <select value="PKR" disabled aria-describedby="currency-hint">
                <option value="PKR">PKR — Pakistani Rupee</option>
              </select>
              <small id="currency-hint">Only PKR is configured for this store. The storefront formats every price in PKR.</small>
            </label>
          </div>
        </section>

        <section className="adm-card is-tall" aria-labelledby="settings-contact">
          <header className="adm-card-head">
            <div>
              <h2 id="settings-contact">Contact</h2>
              <p>Shown on the storefront, support pages and every WhatsApp link.</p>
            </div>
          </header>
          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Support phone</span>
              <input value={form.support_phone} onChange={(event) => setField('support_phone', event.target.value)} aria-invalid={Boolean(errors.support_phone)} />
              {errors.support_phone && <small className="is-error">{errors.support_phone}</small>}
            </label>
            <label className="adm-field">
              <span>WhatsApp number</span>
              <input value={form.whatsapp_number} onChange={(event) => setField('whatsapp_number', event.target.value)} aria-invalid={Boolean(errors.whatsapp_number)} />
              {errors.whatsapp_number
                ? <small className="is-error">{errors.whatsapp_number}</small>
                : <small>{whatsappDigits ? `wa.me/${whatsappDigits}` : 'No WhatsApp number configured'}</small>}
            </label>
            <label className="adm-field is-wide">
              <span>Support email</span>
              <input type="email" value={form.support_email} onChange={(event) => setField('support_email', event.target.value)} aria-invalid={Boolean(errors.support_email)} />
              {errors.support_email && <small className="is-error">{errors.support_email}</small>}
            </label>
          </div>
          <div className="adm-detail-actions">
            <a
              className={`adm-btn adm-btn--quiet${whatsappDigits ? '' : ' is-disabled'}`}
              href={whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!whatsappDigits}
              onClick={(event) => { if (!whatsappDigits) event.preventDefault(); }}
            >
              <OpenRegular aria-hidden="true" />
              Test WhatsApp link
            </a>
            <span className="adm-hint">Opens the saved conversation link in a new tab. Nothing is sent.</span>
          </div>
        </section>

        <section className="adm-card" aria-labelledby="settings-delivery">
          <header className="adm-card-head">
            <div>
              <h2 id="settings-delivery">Delivery</h2>
              <p>Added to every order at checkout.</p>
            </div>
          </header>
          <div className="adm-form-grid">
            <label className="adm-field is-wide">
              <span>Delivery fee</span>
              <span className="adm-input-prefix">
                <span aria-hidden="true">PKR</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form.delivery_fee}
                  onChange={(event) => setField('delivery_fee', event.target.value)}
                  aria-invalid={Boolean(errors.delivery_fee)}
                />
              </span>
              {errors.delivery_fee
                ? <small className="is-error">{errors.delivery_fee}</small>
                : <small>Currently read by checkout as a flat nationwide fee.</small>}
            </label>
          </div>
        </section>

        <section className="adm-card is-wide" aria-labelledby="settings-policies">
          <header className="adm-card-head">
            <div>
              <h2 id="settings-policies">Policies</h2>
              <p>Plain-language policy shown on product pages and the help centre.</p>
            </div>
          </header>
          <div className="adm-form-grid">
            <label className="adm-field is-wide">
              <span>Return policy</span>
              <textarea
                rows={5}
                value={form.return_policy_summary}
                onChange={(event) => setField('return_policy_summary', event.target.value)}
                aria-invalid={Boolean(errors.return_policy_summary)}
              />
              <small className={form.return_policy_summary.length > RETURN_LIMIT ? 'is-error' : undefined}>
                {form.return_policy_summary.length} / {RETURN_LIMIT} characters
              </small>
              {errors.return_policy_summary && <small className="is-error">{errors.return_policy_summary}</small>}
            </label>
            <label className="adm-field is-wide">
              <span>Default warranty text</span>
              <textarea
                rows={4}
                value={form.default_warranty_text}
                onChange={(event) => setField('default_warranty_text', event.target.value)}
                aria-invalid={Boolean(errors.default_warranty_text)}
              />
              <small className={form.default_warranty_text.length > WARRANTY_LIMIT ? 'is-error' : undefined}>
                {form.default_warranty_text.length} / {WARRANTY_LIMIT} characters
              </small>
              {errors.default_warranty_text && <small className="is-error">{errors.default_warranty_text}</small>}
            </label>
          </div>
        </section>
      </div>

      {dirty && (
        <div className="adm-savebar" role="status">
          <span>Unsaved changes</span>
          <div>
            <button
              type="button"
              className="adm-btn adm-btn--quiet"
              onClick={() => {
                setForm(JSON.parse(baseline) as FormState);
                setErrors({});
              }}
              disabled={saving}
            >
              Discard
            </button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      <ToastHost toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
}
