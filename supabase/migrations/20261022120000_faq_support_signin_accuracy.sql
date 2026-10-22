-- Corrects the Support FAQ answer so it describes what the app actually does.
--
-- /support is rendered inside ProtectedRoute (see src/app/App.tsx), so a
-- visitor who is not signed in is sent to /login?required=1. The answer added
-- by 20261022090000_faq_general_store_topics.sql told people to "open the
-- Support page from the footer or the header to start a conversation", which
-- is not what happens if they have no account — they hit the sign-in screen.
--
-- The phone, email and WhatsApp routes genuinely need no account, so those
-- stay as the account-free options. The specific number is deliberately not
-- written into this answer: it comes from business_settings and would go stale
-- here the moment it changed, so the answer points at the footer instead.
--
-- Idempotent: updates exactly the one row guarded-inserted by the previous
-- migration, and re-running it is a no-op.

update public.faq_entries
set answer = 'Sign in first — the Support page asks you to log in if you have not already, and once you are in you can start a conversation there and our team replies in that same thread. You do not need an account to reach us directly: the phone, email and WhatsApp details in the footer get to us straight away, and the same contact details are printed on your invoice so you always have them with your order.'
where question = 'How do I contact MotoGear PK?';
