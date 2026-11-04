-- BTS official score: one published rating per firm and jurisdiction, shared by the website and Ask.
-- Run in the Supabase SQL editor. Additive and idempotent; bts_scores (Layer 1) is untouched.
--
-- A live check (bts_l2_assessments row) becomes the official score when status = 'published'.
-- Code publishes it automatically only when its evidence passes the checks; otherwise it is
-- stored as 'review' with the reason, and stays private until someone sets it to 'published'
-- (or 'rejected') in the table editor. The newest published row per (subject, user_country)
-- is the official score; user_country 'XX' is the global rating.

alter table public.bts_l2_assessments
  add column if not exists status text not null default 'candidate',
  add column if not exists review_reason text;

-- Rows from before this migration were never reviewed: keep them private.
do $$ begin
  alter table public.bts_l2_assessments
    add constraint bts_l2_assessments_status_check check (status in ('candidate', 'published', 'review', 'rejected'));
exception when duplicate_object then null; end $$;

create index if not exists bts_l2_assessments_published
  on public.bts_l2_assessments (subject, user_country, checked_at desc)
  where status = 'published';
