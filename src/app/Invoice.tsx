import { useEffect, useRef, useState } from 'react';
import { Badge, Body1, Button, Caption1, Title3 } from '@fluentui/react-components';
import { ArrowDownloadRegular, PrintRegular, CheckmarkCircleRegular, DismissRegular, LocationRegular, MailRegular, PhoneRegular, ArrowLeftRegular } from '@fluentui/react-icons';
import { formatBusinessMoney, getBusinessDisplaySettings } from '../lib/businessDisplay';
import type { CustomerOrder, CustomerOrderItem, CustomerOrderDetails } from '../api/customer';
import type { AdminOrderBundle } from '../api/admin';

const money = (value: number) => formatBusinessMoney(value);
const statusLabel = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/* ---------- number to words (Pakistani numbering) ---------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t] ?? ''}${o ? ` ${ONES[o] ?? ''}` : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = '';
  if (h) s += `${ONES[h] ?? ''} Hundred`;
  if (r) s += `${h ? ' ' : ''}${twoDigits(r)}`;
  return s;
}

function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}

interface InvoiceProps {
  order: CustomerOrder | AdminOrderBundle;
  items: CustomerOrderItem[] | (AdminOrderBundle['items'][0] & { product_name: string; product_sku: string; quantity: number; unit_price: number; line_total: number })[];
  type?: 'customer' | 'admin';
  onClose?: () => void;
  showActions?: boolean;
}

function getStatusColor(status: string) {
  const s = status.toUpperCase();
  if (s === 'DELIVERED' || s === 'PAID') return 'success';
  if (s === 'CANCELLED' || s === 'REFUNDED' || s === 'RETURNED') return 'danger';
  if (s === 'IN_TRANSIT' || s === 'SUPPLIER_SHIPPED' || s === 'SUPPLIER_PROCESSING') return 'warning';
  if (s === 'CONFIRMED') return 'brand';
  return 'informative';
}

export function Invoice({ order, items, onClose, showActions = true }: InvoiceProps) {
  const business = getBusinessDisplaySettings();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    document.title = `Invoice ${order.order_number}`;
  }, [order.order_number]);

  const printInvoice = () => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 1000);
  };

  const downloadInvoice = () => {
    if (!invoiceRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = document.querySelector('style[data-invoice-styles]')?.outerHTML || '';
    const content = invoiceRef.current.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${order.order_number}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
          ${styles}
          <style>
            body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #eceef2; padding: 24px; margin: 0; }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            @media print {
              .invoice-actions, .no-print { display: none !important; }
              body { background: white; padding: 0; margin: 0; }
              .invoice-container { box-shadow: none; border-radius: 0; max-width: 100%; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  const discount = items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
  const deliveryFee = Number(order.delivery_fee);
  const total = Number(order.total);
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit'
  });

  const paymentStatus = String((order as CustomerOrder).payment_status ?? 'PENDING');
  const isPaid = paymentStatus.toUpperCase() === 'PAID';
  const paymentMethod = String((order as CustomerOrder).payment_method ?? 'CASH_ON_DELIVERY');

  return (
    <div className="invoice-page" ref={invoiceRef} data-invoice-styles="">
      <div className="invoice-container">
        <div className="invoice-accent" />

        {/* Header */}
        <div className="invoice-header">
          <div className="invoice-brand">
            <div className="inv-mark">MG</div>
            <div className="brand-text">
              <div className="inv-brand-name"><span>MOTOGEAR</span><b>PK</b></div>
              <div className="brand-tagline">Gears &amp; Parts · Pakistan</div>
            </div>
          </div>
          <div className="invoice-meta">
            <h1 className="invoice-title">Tax Invoice</h1>
            <div className="invoice-number">#{order.order_number}</div>
            <Badge appearance="filled" color={getStatusColor(order.status)} className="invoice-status">
              {statusLabel(order.status)}
            </Badge>
          </div>
        </div>

        {/* Meta strip */}
        <div className="invoice-facts">
          <div className="fact">
            <span className="fact-label">Issued</span>
            <span className="fact-value">{formatDate(order.created_at)}</span>
            <span className="fact-sub">{formatTime(order.created_at)}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Payment Method</span>
            <span className="fact-value">{statusLabel(paymentMethod)}</span>
            <span className="fact-sub">Collected on delivery</span>
          </div>
          <div className="fact">
            <span className="fact-label">Payment Status</span>
            <span className="fact-value">{statusLabel(paymentStatus)}</span>
            <span className="fact-sub">{isPaid ? 'Received in full' : 'Due on delivery'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Total Units</span>
            <span className="fact-value">{totalUnits}</span>
            <span className="fact-sub">{items.length} line item{items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* From / To */}
        <div className="invoice-parties">
          <div className="party from-party">
            <Title3 as="h2" className="inv-label">From</Title3>
            <Body1 className="party-name"><b>{business.businessName || 'MotoGear PK'}</b></Body1>
            <Body1 className="party-address">
              {business.supportPhone && <span className="contact-line"><PhoneRegular /> {business.supportPhone}</span>}
              {business.supportEmail && <span className="contact-line"><MailRegular /> {business.supportEmail}</span>}
              {business.whatsappNumber && <span className="contact-line"><LocationRegular /> WhatsApp: {business.whatsappNumber}</span>}
            </Body1>
          </div>
          <div className="party to-party">
            <Title3 as="h2" className="inv-label">Ship To</Title3>
            <Body1 className="party-name"><b>{order.shipping_full_name}</b></Body1>
            <Body1 className="party-address">
              {order.shipping_phone && <span className="contact-line"><PhoneRegular /> {order.shipping_phone}</span>}
              {order.shipping_email && <span className="contact-line"><MailRegular /> {order.shipping_email}</span>}
              <span className="contact-line"><LocationRegular /> {order.shipping_address}</span>
              <span className="contact-line indent">{order.shipping_city}, {order.shipping_province}</span>
            </Body1>
          </div>
        </div>

        {/* Items Table */}
        <div className="invoice-table-wrapper">
          <table className="invoice-table">
            <thead>
              <tr>
                <th className="col-item">Item / Description</th>
                <th className="col-qty">Qty</th>
                <th className="col-price">Unit Price</th>
                <th className="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id || index} className="invoice-row">
                  <td className="col-item">
                    <div className="item-row">
                      <span className="item-index">{String(index + 1).padStart(2, '0')}</span>
                      <div className="item-body">
                        <div className="item-name">{item.product_name}</div>
                        <div className="item-sku">SKU: {item.product_sku}</div>
                        {item.warranty && item.warranty.trim() && (
                          <div className="item-warranty"><CheckmarkCircleRegular fontSize="12" /> Warranty: {item.warranty}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="col-qty"><span className="qty-pill">{item.quantity}</span></td>
                  <td className="col-price">{money(Number(item.unit_price))}</td>
                  <td className="col-total">{money(Number(item.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary: notes + totals */}
        <div className="invoice-summary">
          <div className="summary-side">
            <div className="side-card">
              <Title3 as="h2" className="inv-h">Payment</Title3>
              <Badge appearance="filled" color="brand">Cash on Delivery (COD)</Badge>
              <Caption1 className="inv-p muted">Please keep the exact amount ready. Our courier will hand over the parcel after payment.</Caption1>
            </div>
            {order.customer_notes && (
              <div className="side-card">
                <Title3 as="h2" className="inv-h">Order Notes</Title3>
                <Body1 className="inv-p">{order.customer_notes}</Body1>
              </div>
            )}
          </div>

          <div className="totals-table">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="totals-row discount">
                <span>Discount</span>
                <span>−{money(discount)}</span>
              </div>
            )}
            <div className="totals-row">
              <span>Delivery</span>
              <span>{deliveryFee > 0 ? money(deliveryFee) : 'Free'}</span>
            </div>
            <div className="totals-row grand-total">
              <span>Total Amount</span>
              <span>{money(total)}</span>
            </div>
            <div className="totals-foot">
              <div className="amount-words">In words: <b>{numberToWords(total)} Rupees Only</b></div>
              <div className={`stamp ${isPaid ? 'stamp-paid' : 'stamp-due'}`}>
                {isPaid ? 'Paid' : 'Due'}
              </div>
            </div>
          </div>
        </div>

        {/* Terms + signature */}
        <div className="invoice-foot">
          <div className="invoice-terms">
            <Title3 as="h2" className="inv-h">Terms &amp; Conditions</Title3>
            <div className="terms-list">
              <div className="terms-item"><span className="terms-num">1.</span><span>Goods once sold will not be taken back or exchanged unless covered under warranty.</span></div>
              <div className="terms-item"><span className="terms-num">2.</span><span>Warranty claims are subject to manufacturer/supplier terms.</span></div>
              <div className="terms-item"><span className="terms-num">3.</span><span>Cash on Delivery orders must be paid at the time of delivery.</span></div>
              <div className="terms-item"><span className="terms-num">4.</span><span>Delivery timeline is estimated and may vary based on location and supplier stock.</span></div>
              <div className="terms-item"><span className="terms-num">5.</span><span>For support, contact us at {business.supportPhone || 'our support line'} or {business.supportEmail || 'support@motogear.pk'}.</span></div>
            </div>
          </div>

          <div className="invoice-signature">
            <div className={`seal ${isPaid ? 'seal-paid' : ''}`}>
              <CheckmarkCircleRegular fontSize="28" />
            </div>
            <div className="sig-line"></div>
            <Caption1 className="inv-p muted">Authorized Signatory</Caption1>
            <Caption1 className="inv-p muted sig-company">{business.businessName || 'MotoGear PK'}</Caption1>
          </div>
        </div>

        {/* Footer bar */}
        <div className="invoice-bottom">
          <span className="bottom-thanks">Thank you for riding with us</span>
          <span className="bottom-contact">
            {business.supportPhone} · {business.supportEmail}
          </span>
        </div>

        {/* Actions */}
        {showActions && !isPrinting && (
          <div className="invoice-actions no-print">
            {onClose && (
              <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={onClose}>
                Back
              </Button>
            )}
            <Button appearance="secondary" icon={<PrintRegular />} onClick={printInvoice}>
              Print Invoice
            </Button>
            <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={downloadInvoice}>
              Download PDF
            </Button>
          </div>
        )}
      </div>

      <style data-invoice-styles>{`
        .invoice-page {
          min-height: 100vh;
          background: var(--motogear-bg, #eceef2);
          padding: 40px 20px;
        }
        .invoice-container {
          max-width: 860px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.28);
          overflow: hidden;
          color: #1a1d23;
          position: relative;
        }
        .invoice-accent {
          height: 6px;
          background: linear-gradient(90deg, #477C78 0%, #3B6763 45%, #1a1d23 100%);
        }

        /* ---------- Header ---------- */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          padding: 34px 44px 30px;
          background: linear-gradient(135deg, #1a1d23 0%, #232833 55%, #1a1d23 100%);
          color: #ffffff;
        }
        .invoice-brand { display: flex; align-items: center; gap: 16px; }
        .inv-mark {
          width: 56px; height: 56px; border-radius: 14px;
          background: linear-gradient(135deg, #477C78 0%, #3B6763 100%);
          color: #121316; font-weight: 800; font-size: 20px;
          display: grid; place-items: center;
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          letter-spacing: 0.04em;
          box-shadow: 0 8px 24px rgba(71, 124, 120, 0.35);
          flex-shrink: 0;
        }
        .inv-brand-name {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 30px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #ffffff; line-height: 1;
        }
        .inv-brand-name b {
          color: #477C78; margin-left: 9px;
          background: none; padding: 0; border-radius: 0;
          display: inline; vertical-align: baseline;
        }
        .brand-tagline {
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,255,255,0.45); margin-top: 7px;
        }
        .invoice-meta { text-align: right; flex-shrink: 0; }
        .invoice-title {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.32em; text-transform: uppercase;
          color: #7fb3ae; margin: 0 0 6px;  /* sits on the graphite header: 6.30:1 (the #2E524F tuned for white was 1.71:1) */
        }
        .invoice-number {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 24px; font-weight: 800;
          color: #ffffff; letter-spacing: 0.02em;
          line-height: 1.1; margin: 0; word-break: break-all;
        }
        .invoice-status { margin-top: 10px; font-size: 12px; padding: 6px 12px; }

        /* ---------- Facts strip ---------- */
        .invoice-facts {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: #f6f7f9;
          border-bottom: 1px solid #e8eaee;
        }
        .fact {
          padding: 16px 24px;
          display: flex; flex-direction: column; gap: 3px;
          border-right: 1px solid #e8eaee;
        }
        .fact:last-child { border-right: none; }
        .fact-label {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px; font-weight: 700; letter-spacing: 0.16em;
          text-transform: uppercase; color: #5f6873;
        }
        .fact-value { font-size: 15px; font-weight: 700; color: #1a1d23; line-height: 1.3; }
        .fact-sub { font-size: 11px; color: #5f6873; }

        /* ---------- Parties ---------- */
        .invoice-parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 30px 44px;
        }
        .party {
          background: #fbfbfc;
          border: 1px solid #eceef2;
          border-left: 3px solid #477C78;
          border-radius: 10px;
          padding: 18px 20px;
        }
        .party.to-party { border-left-color: #1a1d23; }
        .inv-label {
          display: block;
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: #5f6873; line-height: 1.2; margin: 0 0 10px;
        }
        .party-name {
          display: block;
          font-size: 18px; font-weight: 700; line-height: 1.3;
          color: #1a1d23; margin: 0 0 12px;
        }
        .party-address { display: block; color: #5b6270; line-height: 1.6; font-size: 14px; margin: 0; }
        .contact-line { display: flex; align-items: center; gap: 8px; min-height: 22px; }
        .contact-line.indent { padding-left: 24px; }
        .contact-line svg { color: #477C78; flex-shrink: 0; }

        /* ---------- Table ---------- */
        .invoice-table-wrapper { padding: 0 44px 8px; overflow-x: auto; }
        .invoice-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
        }
        .invoice-table th {
          text-align: left;
          padding: 13px 16px;
          background: #1a1d23;
          color: rgba(255,255,255,0.85);
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        .invoice-table th:first-child { border-radius: 8px 0 0 8px; }
        .invoice-table th:last-child { border-radius: 0 8px 8px 0; }
        .invoice-table td {
          padding: 16px;
          border-bottom: 1px solid #f0f1f4;
          vertical-align: top;
          font-variant-numeric: tabular-nums;
        }
        .invoice-table th.col-qty { text-align: center; }
        .invoice-table th.col-price,
        .invoice-table th.col-total { text-align: right; }
        .invoice-table th,
        .invoice-table td { white-space: nowrap; }
        .invoice-table th.col-item,
        .invoice-table td.col-item { white-space: normal; }
        .invoice-row:nth-child(even) td { background: #fbfbfc; }
        .invoice-row:last-child td { border-bottom: none; }
        .col-item { width: 46%; }
        .col-qty { width: 10%; text-align: center; }
        .col-price { width: 22%; text-align: right; }
        .col-total { width: 22%; text-align: right; font-weight: 700; }
        .item-row { display: flex; gap: 12px; align-items: flex-start; }
        .item-index {
          flex-shrink: 0;
          width: 26px; height: 26px; border-radius: 6px;
          background: #E3EDEB; color: #2E524F;  /* 7.22:1 — was #b07800 at 3.18:1, under the 4.5:1 floor */
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px; font-weight: 700;
          display: grid; place-items: center; margin-top: 1px;
        }
        .item-name { font-weight: 600; color: #1a1d23; margin: 0 0 6px; line-height: 1.4; }
        .item-sku { font-size: 12px; color: #5f6873; margin: 0 0 8px; letter-spacing: 0.02em; }
        .item-warranty {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; color: #147943;
          background: #ecfdf5; border: 1px solid #d1fae5;
          padding: 4px 9px; border-radius: 999px;
        }
        .qty-pill {
          display: inline-grid; place-items: center;
          min-width: 30px; height: 30px; padding: 0 8px;
          border-radius: 8px; background: #f0f1f4;
          font-weight: 700; color: #1a1d23; font-size: 14px;
        }

        /* ---------- Summary ---------- */
        .invoice-summary {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 28px;
          align-items: start;
          padding: 26px 44px 30px;
          border-top: 1px solid #e8eaee;
          margin-top: 22px;
        }
        .summary-side { display: grid; gap: 14px; align-content: start; }
        .side-card {
          background: #fbfbfc; border: 1px solid #eceef2;
          border-left: 3px solid #477C78; border-radius: 10px;
          padding: 16px 18px;
        }
        .inv-h {
          display: block;
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #1a1d23; line-height: 1.2; margin: 0 0 10px;
        }
        .inv-p { display: block; margin: 10px 0 0; color: #5b6270; font-size: 13px; line-height: 1.65; }
        .inv-p.muted { color: #5f6873; }

        .totals-table {
          display: grid;
          grid-template-columns: auto minmax(150px, auto);
          gap: 10px 40px;
          align-items: baseline;
          min-width: 360px;
        }
        .totals-row { display: contents; }
        .totals-row > span:first-child { color: #5b6270; font-size: 14px; }
        .totals-row > span:last-child {
          color: #1a1d23; font-size: 14px; font-weight: 600;
          text-align: right; font-variant-numeric: tabular-nums;
        }
        .totals-row.discount > span:last-child { color: #b42318; }
        .totals-row.grand-total {
          display: flex; justify-content: space-between; align-items: center;
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #1a1d23 0%, #262b36 100%);
          border-radius: 12px; padding: 16px 22px; margin-top: 6px;
        }
        .totals-row.grand-total > span:first-child {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 19px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.7);
        }
        .totals-row.grand-total > span:last-child {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 30px; font-weight: 800; color: #7fb3ae;  /* on graphite band: 6.05:1 (was #477C78 = 2.99:1) */
          text-align: right; line-height: 1;
        }
        .totals-foot {
          grid-column: 1 / -1;
          display: flex; justify-content: space-between; align-items: center;
          gap: 16px; margin-top: 14px; flex-wrap: wrap;
        }
        .amount-words { font-size: 12px; color: #5f6873; }
        .amount-words b { color: #5b6270; font-weight: 600; }
        .stamp {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px; font-weight: 800; letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 6px 16px; border-radius: 6px;
          border: 2px solid; transform: rotate(-6deg);
        }
        .stamp-paid { color: #147943; border-color: #147943; background: #ecfdf5; }
        .stamp-due { color: #b42318; border-color: #b42318; background: #fef3f2; }

        /* ---------- Terms + signature ---------- */
        .invoice-foot {
          display: grid;
          grid-template-columns: 1fr 260px;
          gap: 32px;
          padding: 28px 44px;
          border-top: 1px solid #e8eaee;
        }
        .terms-list { display: grid; gap: 6px; }
        .terms-item { display: flex; gap: 10px; color: #5f6873; font-size: 12px; line-height: 1.7; }
        .terms-num { flex-shrink: 0; width: 16px; font-weight: 600; color: #5b6270; }
        .invoice-signature { text-align: center; }
        .seal {
          width: 60px; height: 60px; border-radius: 50%;
          border: 2px dashed #d4d7de; color: #d4d7de;
          display: grid; place-items: center;
          margin: 0 auto 14px;
        }
        .seal-paid { border-color: #147943; color: #147943; border-style: solid; }
        .sig-line { width: 180px; height: 1px; background: #1a1d23; margin: 0 auto 8px; }
        .invoice-signature .inv-p { margin: 0; }
        .sig-company { font-weight: 600; color: #5b6270; }

        /* ---------- Footer bar ---------- */
        .invoice-bottom {
          display: flex; justify-content: space-between; align-items: center;
          gap: 16px; flex-wrap: wrap;
          padding: 16px 44px;
          background: #1a1d23; color: rgba(255,255,255,0.75);
          font-size: 12px;
        }
        .bottom-thanks {
          font-family: 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #7fb3ae;  /* on graphite: 7.20:1 (was #477C78 = 3.55:1) */
        }
        .bottom-contact { letter-spacing: 0.02em; }

        .invoice-actions {
          display: flex; gap: 12px; justify-content: flex-end;
          padding: 20px 44px; border-top: 1px solid #e8eaee; background: #f6f7f9;
        }

        @media print {
          .invoice-page { background: white; padding: 0; }
          .invoice-container { box-shadow: none; border-radius: 0; max-width: 100%; }
          .invoice-actions { display: none; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media (max-width: 700px) {
          .invoice-container { margin: 0; border-radius: 0; }
          .invoice-header { flex-direction: column; align-items: flex-start; gap: 20px; padding: 24px 20px; }
          .invoice-meta { text-align: left; }
          .invoice-facts { grid-template-columns: 1fr 1fr; }
          .fact:nth-child(2n) { border-right: none; }
          .invoice-parties { grid-template-columns: 1fr; padding: 24px 20px; }
          .invoice-table-wrapper { padding: 0 20px 8px; }
          .invoice-table { font-size: 12px; }
          .invoice-table th, .invoice-table td { padding: 10px 8px; }
          .item-index { display: none; }
          .invoice-summary { grid-template-columns: 1fr; padding: 24px 20px; }
          .totals-table { min-width: 0; width: 100%; }
          .invoice-foot { grid-template-columns: 1fr; padding: 24px 20px; }
          .invoice-signature { text-align: left; }
          .seal { margin: 0 0 14px; }
          .sig-line { margin: 0 0 8px; }
          .invoice-bottom { padding: 14px 20px; }
          .invoice-actions { padding: 16px 20px; }
        }
      `}</style>
    </div>
  );
}

export function InvoiceModal({ isOpen, onClose, order, items, type = 'customer' }: {
  isOpen: boolean;
  onClose: () => void;
  order: CustomerOrder | AdminOrderBundle;
  items: CustomerOrderItem[] | (AdminOrderBundle['items'][0] & { product_name: string; product_sku: string; quantity: number; unit_price: number; line_total: number })[];
  type?: 'customer' | 'admin';
}) {
  if (!isOpen) return null;

  return (
    <div className="invoice-modal-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-modal-header">
          <Title3 className="inv-modal-title">Invoice #{order.order_number}</Title3>
          <Button appearance="subtle" icon={<DismissRegular />} onClick={onClose} aria-label="Close" />
        </div>
        <div className="invoice-modal-body">
          <Invoice order={order} items={items} type={type} showActions={false} />
        </div>
      </div>
      <style>{`
        .invoice-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10,10,14,0.75);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        .invoice-modal {
          width: 100%;
          max-width: 960px;
          max-height: 92vh;
          background: var(--motogear-panel);
          border: 1px solid var(--motogear-border);
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s var(--motion-ease);
        }
        .invoice-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          border-bottom: 1px solid var(--motogear-border);
          background: var(--motogear-surface);
        }
        .inv-modal-title { display: block; margin: 0; }
        .invoice-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 0;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
