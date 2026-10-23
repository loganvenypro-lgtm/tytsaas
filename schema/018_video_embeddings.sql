-- CLIP embeddings of each video's thumbnail and title (worker/jobs/embeddings.js),
-- for "Similar videos" (lib/similarVideos.js). Both live in CLIP's shared
-- 512-d space, so a text query can also be matched against thumbnails.
--
-- With pgvector the columns are vector(512) with HNSW indexes. Without it
-- (pgvector not installed on this server) they are real[] and the API searches
-- an in-memory copy instead; once pgvector is installed, the next
-- `npm run db:migrate` converts the columns and builds the indexes.
do $$
declare
  has_vector boolean := exists (select 1 from pg_available_extensions where name = 'vector');
begin
  if has_vector then
    create extension if not exists vector;
  end if;

  create table if not exists video_embeddings (
    youtube_video_id varchar primary key references videos(youtube_video_id) on delete cascade,
    -- Model and precision the vectors come from: vectors of different models can't be compared
    model text not null,
    -- Null when the thumbnail couldn't be downloaded
    thumbnail real[],
    title real[],
    -- videos.thumbnail_variants / title_variants when embedded: a change re-embeds the video
    thumbnail_version smallint,
    title_version smallint,
    embedded_at timestamptz not null default now()
  );

  if has_vector then
    if (select format_type(atttypid, atttypmod) from pg_attribute
        where attrelid = 'video_embeddings'::regclass and attname = 'thumbnail') <> 'vector(512)' then
      alter table video_embeddings
        alter column thumbnail type vector(512) using thumbnail::vector(512),
        alter column title type vector(512) using title::vector(512);
    end if;
    create index if not exists idx_video_embeddings_thumbnail on video_embeddings using hnsw (thumbnail vector_cosine_ops);
    create index if not exists idx_video_embeddings_title on video_embeddings using hnsw (title vector_cosine_ops);
  else
    raise notice 'pgvector is not installed: video_embeddings uses real[] (in-memory search)';
  end if;
end $$;

create index if not exists idx_video_embeddings_embedded on video_embeddings (embedded_at);
