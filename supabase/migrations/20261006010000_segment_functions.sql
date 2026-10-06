-- Applied via Supabase MCP on 2026-10-06.

-- The brief fixes "today"; every DB-side day calculation uses this.
create or replace function reference_date() returns date
language sql immutable as $$ select date '2026-09-28' $$;

-- Per-subscriber activity counts used to compute engagement scores in app code.
create or replace view subscriber_activity as
select
  s.id as subscriber_id,
  (select count(*) from web_events w
     where w.subscriber_id = s.id and w.ts >= (reference_date() - 30)::timestamptz) as web_last30,
  (select count(*) from app_events e
     join app_users u on u.user_id = e.resolved_user_id
     where u.subscriber_id = s.id and e.ts >= (reference_date() - 30)::timestamptz) as app_last30
from subscribers s;

-- Segment execution. `where_clause` is produced ONLY by lib/segments/compile.ts
-- from an allowlist; all user values travel in `params` (jsonb) and are read
-- inside the clause as ($1->>'pN'), so no value is ever interpolated into SQL.
create or replace function segment_count(where_clause text, params jsonb)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from subscribers s where %s', where_clause) into n using params;
  return n;
end $$;

create or replace function segment_rows(where_clause text, params jsonb, lim int, off int)
returns jsonb language plpgsql as $$
declare out jsonb;
begin
  execute format(
    'select coalesce(jsonb_agg(r), ''[]''::jsonb) from (
       select s.id, s.email, s.email_hash, s.status, s.source, s.signup_date, s.last_open_date,
              s.engagement_score, s.churn_tier
       from subscribers s where %s
       order by s.engagement_score desc nulls last, s.id
       limit %s offset %s) r',
    where_clause, greatest(0, least(lim, 5000)), greatest(0, off)
  ) into out using params;
  return out;
end $$;

-- Only the server (service role) may call these.
revoke execute on function segment_count(text, jsonb) from anon, authenticated, public;
revoke execute on function segment_rows(text, jsonb, int, int) from anon, authenticated, public;
revoke all on subscriber_activity from anon, authenticated, public;

-- Known page paths for the filter builder's autocomplete.
create or replace function distinct_pages()
returns table(page text) language sql stable as $$
  select page from web_events group by page order by count(*) desc limit 200
$$;
revoke execute on function distinct_pages() from anon, authenticated, public;
