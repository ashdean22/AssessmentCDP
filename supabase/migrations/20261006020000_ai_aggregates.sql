-- Applied via Supabase MCP on 2026-10-06.
-- Aggregates used by the AI tools and the dashboard. Nothing here returns a
-- row-level identifier; only counts, percentages, page paths and dates.

create or replace function source_quality()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(row_to_json(q) order by q.signups desc), '[]'::jsonb) from (
    select s.source,
      count(*)::int as signups,
      round(100.0 * count(*) filter (where s.status = 'active') / count(*), 1) as pct_active,
      round(avg(s.engagement_score), 1) as avg_score,
      round(100.0 * count(*) filter (where exists (select 1 from app_users u where u.subscriber_id = s.id)) / count(*), 1) as pct_with_app,
      round(100.0 * count(*) filter (where s.signup_date <= reference_date() - 90 and s.last_open_date >= reference_date() - 30) / count(*), 1) as pct_loyal,
      round(100.0 * count(*) filter (where s.last_open_date is null or s.last_open_date < reference_date() - 30) / count(*), 1) as pct_cold
    from subscribers s group by s.source) q
$$;

-- First page each new subscriber hit on/after signup, aggregated.
create or replace function first_pages(new_within_days int default 30, lim int default 10)
returns jsonb language sql stable as $$
  with newbies as (
    select id, signup_date from subscribers
    where signup_date >= reference_date() - new_within_days),
  firsts as (
    select distinct on (w.subscriber_id) w.subscriber_id, w.page
    from web_events w join newbies n on n.id = w.subscriber_id
    where w.ts >= n.signup_date::timestamptz
    order by w.subscriber_id, w.ts asc)
  select jsonb_build_object(
    'new_subscribers', (select count(*) from newbies),
    'with_a_first_page', (select count(*) from firsts),
    'pages', coalesce((select jsonb_agg(row_to_json(p) order by p.count desc) from (
        select page, count(*)::int as count,
               round(100.0 * count(*) / greatest(1, (select count(*) from firsts)), 1) as pct
        from firsts group by page order by count desc limit lim) p), '[]'::jsonb))
$$;

create or replace function app_newsletter_overlap()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'app_users', (select count(*) from app_users),
    'app_users_matched_to_newsletter', (select count(*) from app_users where subscriber_id is not null),
    'app_users_not_in_newsletter', (select count(*) from app_users where subscriber_id is null),
    'app_users_never_opened', (select count(*) from app_users u join subscribers s on s.id = u.subscriber_id where s.last_open_date is null),
    'app_users_cold', (select count(*) from app_users u join subscribers s on s.id = u.subscriber_id
                        where s.last_open_date is null or s.last_open_date < reference_date() - 30),
    'app_users_unsubscribed', (select count(*) from app_users u join subscribers s on s.id = u.subscriber_id where s.status = 'unsubscribed'),
    'subscribers_total', (select count(*) from subscribers),
    'subscribers_with_app', (select count(*) from subscribers s where exists (select 1 from app_users u where u.subscriber_id = s.id)))
$$;

-- Weekly / daily series ending at reference_date().
create or replace function trend(metric text, bucket text default 'week', periods int default 12)
returns jsonb language plpgsql stable as $$
declare
  src text; col text; start_ts timestamptz; out jsonb;
begin
  if bucket not in ('day','week') then raise exception 'bucket must be day or week'; end if;
  if periods < 1 or periods > 104 then raise exception 'periods out of range'; end if;
  case metric
    when 'signups'    then src := 'subscribers'; col := 'signup_date::timestamptz';
    when 'last_opens' then src := 'subscribers'; col := 'last_open_date::timestamptz';
    when 'web_visits' then src := 'web_events';  col := 'ts';
    when 'app_events' then src := 'app_events';  col := 'ts';
    else raise exception 'unknown metric %', metric;
  end case;
  start_ts := date_trunc(bucket, reference_date()::timestamptz) - make_interval(days => periods * (case bucket when 'week' then 7 else 1 end));
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''period'', to_char(p, ''YYYY-MM-DD''), ''count'', c) order by p), ''[]''::jsonb)
     from (select date_trunc(%L, %s) as p, count(*)::int as c from %I
           where %s is not null and %s >= $1 and %s < reference_date()::timestamptz + interval ''1 day''
           group by 1) t', bucket, col, src, col, col, col)
  into out using start_ts;
  return out;
end $$;

-- Dashboard headline numbers.
create or replace function dashboard_stats()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'subscribers', (select count(*) from subscribers),
    'active', (select count(*) from subscribers where status = 'active'),
    'cold', (select count(*) from subscribers where last_open_date is null or last_open_date < reference_date() - 30),
    'app_users', (select count(*) from app_users),
    'web_events', (select count(*) from web_events),
    'app_events', (select count(*) from app_events),
    'events_today', (select count(*) from app_events where ts >= reference_date()::timestamptz and ts < reference_date()::timestamptz + interval '1 day'),
    'tiers', (select coalesce(jsonb_object_agg(coalesce(churn_tier,'unscored'), n), '{}'::jsonb) from (select churn_tier, count(*) n from subscribers group by churn_tier) t),
    'by_source', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'count', n) order by n desc), '[]'::jsonb) from (select source, count(*) n from subscribers group by source) t))
$$;

revoke execute on function source_quality() from anon, authenticated, public;
revoke execute on function first_pages(int, int) from anon, authenticated, public;
revoke execute on function app_newsletter_overlap() from anon, authenticated, public;
revoke execute on function trend(text, text, int) from anon, authenticated, public;
revoke execute on function dashboard_stats() from anon, authenticated, public;
