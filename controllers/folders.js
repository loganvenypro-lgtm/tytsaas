import crypto from "node:crypto";
import { sql } from "../lib/sql.js";
import { FOLDER_NAME_MAX, parseFolderName, parseItem } from "../lib/savedFolders.js";

const NAME_ERROR = `Le nom doit faire entre 1 et ${FOLDER_NAME_MAX} caractères.`;

function folderJson(r) {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    videoCount: Number(r.video_count ?? 0),
    channelCount: Number(r.channel_count ?? 0),
    previews: (r.previews ?? []).filter(Boolean),
    ...(r.contains_item != null ? { containsItem: r.contains_item } : {}),
  };
}

async function ownsFolder(folderId, userId) {
  const [row] = await sql`SELECT 1 FROM saved_folders WHERE id = ${folderId} AND user_id = ${userId}`;
  return Boolean(row);
}

/**
 * The user's folders, newest first. With `?type=video&id=…` each folder also
 * says whether it already holds that item (for the "Save" menu).
 */
export async function list(req, res) {
  const { type, id } = req.query;
  const lookup = (type === "video" || type === "channel") && typeof id === "string" && id ? { type, id } : null;

  const rows = await sql`
    SELECT f.id, f.name, f.created_at, f.updated_at,
      (SELECT count(*) FROM saved_folder_items i WHERE i.folder_id = f.id AND i.item_type = 'video')::int AS video_count,
      (SELECT count(*) FROM saved_folder_items i WHERE i.folder_id = f.id AND i.item_type = 'channel')::int AS channel_count,
      (SELECT array_agg(p.thumb) FROM (
        SELECT i.snapshot->>'thumbnail' AS thumb FROM saved_folder_items i
        WHERE i.folder_id = f.id AND i.snapshot->>'thumbnail' IS NOT NULL ORDER BY i.added_at DESC LIMIT 4
      ) p) AS previews
      ${lookup
        ? sql`, EXISTS (SELECT 1 FROM saved_folder_items i
                WHERE i.folder_id = f.id AND i.item_type = ${lookup.type} AND i.item_id = ${lookup.id}) AS contains_item`
        : sql``}
    FROM saved_folders f
    WHERE f.user_id = ${req.user.id}
    ORDER BY f.created_at DESC`;
  res.json({ folders: rows.map(folderJson) });
}

/** Create a folder, optionally saving a first item in it right away. */
export async function create(req, res) {
  const name = parseFolderName(req.body?.name);
  if (!name) return res.status(400).json({ error: NAME_ERROR });
  const item = req.body?.item ? parseItem(req.body.item) : null;
  if (req.body?.item && !item) return res.status(400).json({ error: "Élément invalide." });

  const id = `fld_${crypto.randomBytes(8).toString("hex")}`;
  const [folder] = await sql.begin(async (tx) => {
    const created = await tx`
      INSERT INTO saved_folders (id, user_id, name) VALUES (${id}, ${req.user.id}, ${name})
      RETURNING id, name, created_at, updated_at`;
    if (item) {
      await tx`
        INSERT INTO saved_folder_items (folder_id, item_type, item_id, snapshot)
        VALUES (${id}, ${item.type}, ${item.id}, ${tx.json(item.snapshot)})`;
    }
    return created;
  });

  res.status(201).json({
    folder: folderJson({
      ...folder,
      video_count: item?.type === "video" ? 1 : 0,
      channel_count: item?.type === "channel" ? 1 : 0,
      previews: item?.snapshot.thumbnail ? [item.snapshot.thumbnail] : [],
      ...(item ? { contains_item: true } : {}),
    }),
  });
}

/**
 * One folder with its items, newest first. Views, multiplier and subscribers
 * come from our tables when the scanner knows the video or channel, so they
 * stay current; the snapshot covers the rest.
 */
export async function get(req, res) {
  const [folder] = await sql`
    SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM saved_folders WHERE id = ${req.params.folderId} AND user_id = ${req.user.id}`;
  if (!folder) return res.status(404).json({ error: "Dossier introuvable." });

  const rows = await sql`
    SELECT i.item_type, i.item_id, i.snapshot, i.added_at,
           v.view_count, v.outlier_multiplier, v.is_short,
           c.subscriber_count, c.thumbnail_url AS channel_avatar, c.handle
    FROM saved_folder_items i
    LEFT JOIN videos v ON i.item_type = 'video' AND v.youtube_video_id = i.item_id
    LEFT JOIN channels c ON i.item_type = 'channel' AND c.youtube_channel_id = i.item_id
    WHERE i.folder_id = ${folder.id}
    ORDER BY i.added_at DESC`;

  const items = rows.map((r) => {
    const live =
      r.item_type === "video"
        ? {
            ...(r.view_count != null && { views: Number(r.view_count) }),
            ...(r.outlier_multiplier != null && { multiplier: Number(r.outlier_multiplier) }),
            ...(r.is_short != null && { isShort: r.is_short }),
          }
        : {
            ...(r.subscriber_count != null && { subscribers: Number(r.subscriber_count) }),
            ...(r.channel_avatar && { thumbnail: r.channel_avatar }),
            ...(r.handle && { handle: r.handle }),
          };
    return { type: r.item_type, id: r.item_id, snapshot: { ...r.snapshot, ...live }, addedAt: r.added_at };
  });
  res.json({ folder, items });
}

export async function rename(req, res) {
  const name = parseFolderName(req.body?.name);
  if (!name) return res.status(400).json({ error: NAME_ERROR });
  const [folder] = await sql`
    UPDATE saved_folders SET name = ${name}, updated_at = now()
    WHERE id = ${req.params.folderId} AND user_id = ${req.user.id}
    RETURNING id, name`;
  if (!folder) return res.status(404).json({ error: "Dossier introuvable." });
  res.json({ folder });
}

/** Delete a folder and everything saved in it. */
export async function remove(req, res) {
  const deleted = await sql`
    DELETE FROM saved_folders WHERE id = ${req.params.folderId} AND user_id = ${req.user.id} RETURNING id`;
  if (!deleted.length) return res.status(404).json({ error: "Dossier introuvable." });
  res.json({ success: true });
}

/** Save a video or channel in a folder (saving it again refreshes its snapshot). */
export async function addItem(req, res) {
  const { folderId } = req.params;
  if (!(await ownsFolder(folderId, req.user.id))) return res.status(404).json({ error: "Dossier introuvable." });
  const item = parseItem(req.body);
  if (!item) return res.status(400).json({ error: "Élément invalide." });

  await sql`
    INSERT INTO saved_folder_items (folder_id, item_type, item_id, snapshot)
    VALUES (${folderId}, ${item.type}, ${item.id}, ${sql.json(item.snapshot)})
    ON CONFLICT (folder_id, item_type, item_id) DO UPDATE SET snapshot = excluded.snapshot`;
  await sql`UPDATE saved_folders SET updated_at = now() WHERE id = ${folderId}`;
  res.status(201).json({ success: true });
}

/** Remove an item: `?type=video&id=…`. */
export async function removeItem(req, res) {
  const { folderId } = req.params;
  if (!(await ownsFolder(folderId, req.user.id))) return res.status(404).json({ error: "Dossier introuvable." });
  const { type, id } = req.query;
  if ((type !== "video" && type !== "channel") || typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Élément invalide." });
  }

  await sql`DELETE FROM saved_folder_items WHERE folder_id = ${folderId} AND item_type = ${type} AND item_id = ${id}`;
  await sql`UPDATE saved_folders SET updated_at = now() WHERE id = ${folderId}`;
  res.json({ success: true });
}
