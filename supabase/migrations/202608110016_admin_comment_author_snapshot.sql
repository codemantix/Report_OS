-- Report OS — persist the comment author's name on each admin comment.
--
-- Previously comments stored only `admin_id`, and the legacy comment API
-- attributed comments to "the first admin found" (or null), so existing rows
-- could not reliably display who actually wrote them. We add a denormalized
-- `author_name_snapshot` captured at insert time so the display name is always
-- available even if the author is later deleted or the row predates the fix.

alter table public.admin_comments
  add column if not exists author_name_snapshot text;

comment on column public.admin_comments.author_name_snapshot is
  'Denormalized author display name captured when the comment was written. Preserved even if the author user is later deleted.';

-- Backfill existing rows where a linked author still resolves.
update public.admin_comments comment
set author_name_snapshot = coalesce(
  nullif(trim(author.display_name), ''),
  nullif(trim(author.full_name), ''),
  author.email
)
from public.users author
where comment.admin_id = author.id
  and comment.author_name_snapshot is null;

-- An index for reporting/audit lookups by author name.
create index if not exists admin_comments_author_snapshot_idx
  on public.admin_comments (author_name_snapshot)
  where author_name_snapshot is not null;
