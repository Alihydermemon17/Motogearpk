revoke all on public.reviews from anon;
grant select (id, product_id, rating, title, body, verified_purchase, is_visible, created_at)
	on public.reviews to anon;
