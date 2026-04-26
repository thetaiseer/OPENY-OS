-- Client brand image URL (public CDN or storage URL), shown in UI and on asset covers.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo text;
