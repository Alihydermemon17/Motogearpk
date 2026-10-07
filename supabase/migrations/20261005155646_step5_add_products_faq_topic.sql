alter table public.faq_entries
	drop constraint faq_entries_topic_check;

alter table public.faq_entries
	add constraint faq_entries_topic_check
	check (topic in (
		'PRODUCTS',
		'ORDERS',
		'DELIVERY',
		'RETURNS',
		'WARRANTY',
		'COMPATIBILITY',
		'INSTALLATION',
		'PAYMENT',
		'SUPPLIER_FULFILLMENT'
	));
