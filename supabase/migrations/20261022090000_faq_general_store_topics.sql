-- Phase 7: general store FAQ topics.
--
-- The help centre already answered the LED/headlight-specific questions. The
-- brief also requires general store coverage — ordering, payment, delivery,
-- tracking, compatibility, unavailable items, damaged items, returns and how
-- to contact us. Most of those were already present (see the seed below, which
-- is guarded so existing rows are never touched); the genuinely missing ones
-- are added here, and a `SUPPORT` topic is introduced so the contact question
-- has a correct home instead of being filed under Orders.
--
-- Nothing is deleted or updated: `where not exists` on the question text makes
-- every insert a no-op if the row is already there.

alter table public.faq_entries drop constraint if exists faq_entries_topic_check;

alter table public.faq_entries add constraint faq_entries_topic_check check (
  topic = any (array[
    'PRODUCTS'::text,
    'ORDERS'::text,
    'DELIVERY'::text,
    'RETURNS'::text,
    'WARRANTY'::text,
    'COMPATIBILITY'::text,
    'INSTALLATION'::text,
    'PAYMENT'::text,
    'SUPPLIER_FULFILLMENT'::text,
    'SUPPORT'::text
  ])
);

-- Every answer below states only what the storefront or database actually does:
--   * checkout is behind a sign-in (ProtectedRoute in App.tsx);
--   * confirmation + invoice number render on screen after checkout;
--   * tracking lives in the signed-in account's Orders list and shows the five
--     stages plus courier/tracking_number once the order ships;
--   * payment_method currently allows only CASH_ON_DELIVERY;
--   * availability_status is AVAILABLE | UNAVAILABLE | CHECK_REQUIRED and
--     checkout blocks cart items that are no longer listed;
--   * support phone / email / WhatsApp are read from business_settings and
--     rendered in the footer and on the invoice, so no number is hard-coded.
insert into public.faq_entries (topic, question, answer, active, sort_order)
select v.topic, v.question, v.answer, true, v.sort_order
from (values
  ('PRODUCTS'::text,
   'A product I want shows as unavailable — how do I get it?',
   'Every product page shows its own availability. An item marked unavailable cannot be ordered, and if one is already in your cart checkout will stop you and ask you to remove it before you can continue. Send us the product name through the Support page and we will confirm what we can currently supply.',
   35),

  ('PAYMENT'::text,
   'What payment methods do you accept?',
   'Cash on delivery is the payment method available right now, so there is no card or bank transfer to set up before your order ships. You hand over the payment when the parcel is in your hand, and the amount you pay is the order total shown at checkout.',
   145),

  ('ORDERS'::text,
   'How do I place an order?',
   'Browse the shop, add what you need to the cart, then open the cart and continue to checkout. Checkout asks you to sign in first so the order belongs to your account, then you confirm your delivery details and place it. The confirmation and your invoice number appear on screen straight away, and the order is listed under Orders in your account.',
   175),

  ('ORDERS'::text,
   'How do I track my order after it ships?',
   'Sign in and open Orders in your account — every order has its own tracking view that moves through order received, confirmed, being prepared, on the way and delivered. Once it ships, the courier and tracking number appear on that same order so you can follow it to your door.',
   185),

  ('SUPPORT'::text,
   'How do I contact MotoGear PK?',
   'Open the Support page from the footer or the header to start a conversation and our team replies there. The phone, email and WhatsApp details in the footer reach us directly, and the same contact details are printed on your invoice, so you always have them with your order.',
   200)
) as v(topic, question, answer, sort_order)
where not exists (
  select 1 from public.faq_entries e
  where e.question = v.question
);
