// supabase/functions/order-confirmation-email/index.ts
//
// Sends the customer a branded "Thank you for your order" email right after a
// COD order is placed. The order is re-read from the database using the
// caller's own JWT, so a client can only trigger mail for its own order and
// can never forge the totals shown in the message.
//
// Two providers are supported and picked automatically from the secrets that
// are actually set, so switching later needs no code change:
//
//   BREVO_API_KEY  (xkeysib-...)  - free 300/day, sender address only, no DNS
//   RESEND_API_KEY (re_...)       - requires a verified domain
//
// EMAIL_PROVIDER can force one of them: "brevo" or "resend".
// EMAIL_FROM accepts both "Name <address>" and a bare address.
//
// Without a provider the function still runs and reports sent:false, so
// checkout never breaks while email is unconfigured.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const EMAIL_PROVIDER = (Deno.env.get("EMAIL_PROVIDER") ?? "").trim().toLowerCase();
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "MotoGear PK <orders@motogear.pk>";
const RAW_STORE_URL = (Deno.env.get("STORE_URL") ?? "http://localhost:5173").replace(/\/+$/, "");

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const money = (value: number) =>
  "PKR " + Math.round(Number(value) || 0).toLocaleString("en-PK");

const ENTITIES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ENTITIES[character] ?? "");

interface ParsedFrom { name: string; email: string }

function parseFrom(raw: string): ParsedFrom {
  const match = raw.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match && match[2].includes("@")) {
    return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2].trim() };
  }
  return { name: "MotoGear PK", email: raw.trim() };
}

function resolveProvider(): "brevo" | "resend" | "" {
  if (EMAIL_PROVIDER === "brevo" || EMAIL_PROVIDER === "resend") return EMAIL_PROVIDER;
  if (BREVO_API_KEY) return "brevo";
  if (RESEND_API_KEY) return "resend";
  return "";
}

interface EmailItem { name: string; sku: string; qty: number; total: number }

interface EmailInput {
  businessName: string;
  supportPhone: string;
  supportEmail: string;
  orderNumber: string;
  orderUrl: string;
  storeUrl: string;
  firstName: string;
  createdAt: string;
  items: EmailItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

function renderEmail(input: EmailInput): string {
  const parts: string[] = [];

  parts.push(
    '<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:28px 14px;"><tr><td align="center">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">'
  );

  // Header band
  parts.push(
    '<tr><td style="padding:22px 30px;border-bottom:3px solid #FFB400;">',
    '<div style="font-size:22px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#1a1d23;">',
    esc(input.businessName), '</div>',
    '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#98a0ad;margin-top:4px;">Gears &amp; Parts &middot; Pakistan</div>',
    '</td><td align="right" style="padding:22px 30px;border-bottom:3px solid #FFB400;white-space:nowrap;">',
    '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#98a0ad;">Order</div>',
    '<div style="font-size:14px;font-weight:800;color:#1a1d23;margin-top:3px;">', esc(input.orderNumber), '</div>',
    '</td></tr>'
  );

  // Greeting
  parts.push(
    '<tr><td colspan="2" style="padding:34px 30px 10px;">',
    '<h1 style="margin:0;font-size:26px;line-height:1.2;color:#1a1d23;">Thank you for your order',
    input.firstName ? ", " + esc(input.firstName) : "", '!</h1>',
    '<p style="margin:12px 0 0;font-size:15px;line-height:1.65;color:#6b7280;">',
    'We are getting your order ready to be shipped. We will notify you as soon as it has been sent.</p>',
    '</td></tr>'
  );

  // Buttons
  parts.push(
    '<tr><td colspan="2" style="padding:22px 30px 6px;">',
    '<table role="presentation" cellspacing="0" cellpadding="0"><tr>',
    '<td style="background:#1a1d23;border-radius:9px;"><a href="', esc(input.orderUrl),
    '" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#FFB400;text-decoration:none;">View your order</a></td>',
    '<td style="padding-left:16px;font-size:14px;color:#6b7280;">or&nbsp;<a href="', esc(input.storeUrl),
    '" style="color:#b07800;font-weight:600;text-decoration:none;">Visit our store</a></td>',
    '</tr></table></td></tr>'
  );

  // Order summary
  parts.push(
    '<tr><td colspan="2" style="padding:26px 30px 34px;">',
    '<div style="border:1px solid #eceef2;border-radius:12px;padding:18px 20px 6px;">',
    '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#98a0ad;margin-bottom:6px;">Order summary</div>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
  );

  for (const item of input.items) {
    parts.push(
      '<tr><td style="padding:14px 0;border-bottom:1px solid #eceef2;">',
      '<div style="font-size:14px;font-weight:700;color:#1a1d23;">', esc(item.name), '</div>',
      '<div style="font-size:12px;color:#98a0ad;margin-top:3px;">SKU ', esc(item.sku), ' &middot; Qty ', esc(item.qty), '</div>',
      '</td><td align="right" style="padding:14px 0;border-bottom:1px solid #eceef2;font-size:14px;font-weight:700;color:#1a1d23;white-space:nowrap;">',
      money(item.total), '</td></tr>'
    );
  }

  parts.push(
    '</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;">',
    '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Subtotal</td>',
    '<td align="right" style="padding:6px 0;font-size:14px;color:#1a1d23;">', money(input.subtotal), '</td></tr>'
  );

  if (input.discount > 0) {
    parts.push(
      '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Discount</td>',
      '<td align="right" style="padding:6px 0;font-size:14px;color:#b42318;">-', money(input.discount), '</td></tr>'
    );
  }

  parts.push(
    '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;">Delivery</td>',
    '<td align="right" style="padding:6px 0;font-size:14px;color:#1a1d23;">',
    input.deliveryFee > 0 ? money(input.deliveryFee) : "Free", '</td></tr></table>',
    '<div style="margin-top:14px;background:#1a1d23;border-radius:10px;padding:14px 18px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>',
    '<td style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Total due on delivery</td>',
    '<td align="right" style="font-size:24px;font-weight:800;color:#FFB400;white-space:nowrap;">', money(input.total), '</td>',
    '</tr></table></div></div>',
    '<p style="margin:18px 0 0;font-size:13px;line-height:1.65;color:#98a0ad;">',
    'Please keep the exact amount ready for the courier. No online payment is required. Placed on ',
    esc(input.createdAt), '.</p></td></tr>'
  );

  // Footer
  parts.push(
    '<tr><td colspan="2" style="background:#1a1d23;padding:20px 30px;">',
    '<div style="font-size:12px;color:rgba(255,255,255,0.72);line-height:1.7;">Need help? Call or WhatsApp ',
    '<span style="color:#FFB400;font-weight:700;">', esc(input.supportPhone), '</span> or email ',
    '<a href="mailto:', esc(input.supportEmail), '" style="color:#FFB400;font-weight:700;text-decoration:none;">',
    esc(input.supportEmail), '</a>.</div></td></tr>'
  );

  parts.push('</table></td></tr></table></body></html>');
  return parts.join("");
}

interface DeliveryInput {
  provider: "brevo" | "resend";
  from: ParsedFrom;
  to: string;
  toName: string;
  subject: string;
  html: string;
}

async function deliver(input: DeliveryInput): Promise<{ ok: boolean; detail: string }> {
  const fromHeader = input.from.name
    ? input.from.name + " <" + input.from.email + ">"
    : input.from.email;

  if (input.provider === "brevo") {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: input.from.name || "MotoGear PK", email: input.from.email },
        to: [{ email: input.to, name: input.toName || input.to }],
        subject: input.subject,
        htmlContent: input.html,
      }),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, detail: text.slice(0, 400) };
    return { ok: true, detail: text.slice(0, 200) };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromHeader, to: [input.to], subject: input.subject, html: input.html }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, detail: text.slice(0, 400) };
  return { ok: true, detail: text.slice(0, 200) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Function is not configured." }, 500);

  let orderId = "";
  try {
    const body = await request.json();
    orderId = String(body?.order_id ?? "");
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!orderId) return json({ error: "order_id is required." }, 400);

  const rawAuth = request.headers.get("Authorization") ?? "";
  const token = rawAuth.startsWith("Bearer ") ? rawAuth.slice(7).trim() : rawAuth.trim();

  // Prefer the caller's real origin so order links work in production without
  // having to remember to update STORE_URL after every deploy.
  const requestOrigin = (request.headers.get("Origin") ?? "").replace(/\/+$/, "");
  const storeUrl = requestOrigin.startsWith("http") ? requestOrigin : RAW_STORE_URL;

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Confirm the caller owns this order before mailing anything.
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "Unauthorized." }, 401);
  const userId = userData.user.id;

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("customer_id", userId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: "Order not found." }, 404);

  const results = await Promise.all([
    db.from("order_items").select("*").eq("order_id", orderId),
    db.from("business_settings").select("setting_key, setting_value"),
  ]);
  const items = results[0].data ?? [];
  const settingsRows = results[1].data ?? [];

  const settings = new Map<string, string>();
  for (const row of settingsRows) {
    const value = (row as Record<string, unknown>).setting_value;
    settings.set(
      String((row as Record<string, unknown>).setting_key),
      typeof value === "string" ? value : String(value ?? "")
    );
  }

  const recipient = String(order.shipping_email ?? "").trim();
  if (!recipient.includes("@")) {
    return json({ sent: false, reason: "Order has no valid email address." });
  }

  const fullName = String(order.shipping_full_name ?? "").trim();
  const html = renderEmail({
    businessName: settings.get("business_name") || "MotoGear PK",
    supportPhone: settings.get("support_phone") || "",
    supportEmail: settings.get("support_email") || "",
    orderNumber: String(order.order_number),
    orderUrl: storeUrl + "/orders/" + orderId,
    storeUrl: storeUrl + "/shop",
    firstName: fullName.split(" ")[0] ?? "",
    createdAt: new Date(order.created_at).toLocaleDateString("en-PK", {
      weekday: "long", day: "numeric", month: "short", year: "numeric",
    }),
    items: items.map((item: Record<string, unknown>) => ({
      name: String(item.product_name ?? ""),
      sku: String(item.product_sku ?? "-"),
      qty: Number(item.quantity ?? 0),
      total: Number(item.line_total ?? 0),
    })),
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount_amount ?? 0),
    deliveryFee: Number(order.delivery_fee ?? 0),
    total: Number(order.total ?? 0),
  });

  const provider = resolveProvider();
  if (!provider) {
    return json({
      sent: false,
      reason: "No email provider configured. Set BREVO_API_KEY or RESEND_API_KEY in Edge Function secrets.",
      preview: html,
    });
  }

  const subject = "Order " + String(order.order_number) + " confirmed";
  const result = await deliver({
    provider,
    from: parseFrom(EMAIL_FROM),
    to: recipient,
    toName: fullName,
    subject,
    html,
  });

  if (!result.ok) return json({ sent: false, provider, reason: result.detail }, 502);
  return json({ sent: true, provider });
});
