-- Fix: journal_insights had RLS enabled with only a SELECT policy, so the
-- Weekly Insight generation route (POST /api/journal/insight, which inserts as
-- the signed-in user) was blocked by RLS (42501) and never cached. Insights
-- were regenerated on every read. Add the missing own-row INSERT policy so the
-- 7-day cache works. Idempotent — safe to run more than once.
--
-- Paste into the Supabase SQL editor for project imnfadaavznjmirybhti and run.

drop policy if exists "journal_insights_insert_own" on public.journal_insights;
create policy "journal_insights_insert_own"
on public.journal_insights
for insert
to authenticated
with check (user_id = (select auth.uid()));
