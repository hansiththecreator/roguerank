create or replace view public.hashtag_summaries as
select
  tag,
  count(*)::integer as poll_count,
  coalesce(sum(total_votes), 0)::integer as vote_count,
  coalesce(sum(likes), 0)::integer as like_count
from (
  select
    lower(trim(both from regexp_replace(raw_tag, '^#', ''))) as tag,
    coalesce(total_votes, 0) as total_votes,
    coalesce(likes, 0) as likes
  from public.polls
  cross join lateral unnest(coalesce(hashtags, array[]::text[])) as tags(raw_tag)
) normalized_tags
where tag <> ''
group by tag;
