import crypto from "node:crypto";
import { sql } from "../lib/sql.js";
import { FOLDER_NAME_MAX, NOTE_BODY_MAX, NOTE_KINDS, parseFolderName, parseItem, parseNote } from "../lib/savedFolders.js";
import { inWorkspace } from "../lib/teams.js";
import { AiRefusedError, aiEnabled, assistNote as assistNoteWithAi } from "../lib/ideationAI.js";

const NAME_ERROR = `Le nom doit faire entre 1 et ${FOLDER_NAME_MAX} caractères.`;
const NOTE_ERROR = `La note doit faire entre 1 et ${NOTE_BODY_MAX} caractères.`;

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

async function ownsFolder(folderId, ws) {
  const [row] = await sql`SELECT 1 FROM saved_folders WHERE id = ${folderId} AND ${inWorkspace(ws)}`;
  return Boolean(row);
}

/**
 * The folders of the workspace (personal space or active team), newest first.
 * With `?type=video&id=…` each folder also says whether it already holds that
 * item (for the "Save" menu).
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
    WHERE ${inWorkspace(req.workspace, "f")}
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
      INSERT INTO saved_folders (id, user_id, organization_id, name)
      VALUES (${id}, ${req.user.id}, ${req.workspace.teamId}, ${name})
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

function noteJson(r) {
  return { id: r.id, videoId: r.item_id, kind: r.kind, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at };
}

/**
 * One folder with its items, newest first. Views, multiplier and subscribers
 * come from our tables when the scanner knows the video or channel, so they
 * stay current; the snapshot covers the rest. Videos also carry their
 * ideation notes, oldest first.
 */
export async function get(req, res) {
  const [folder] = await sql`
    SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM saved_folders WHERE id = ${req.params.folderId} AND ${inWorkspace(req.workspace)}`;
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
  const notes = await sql`
    SELECT id, item_id, kind, body, created_at, updated_at FROM saved_folder_notes
    WHERE folder_id = ${folder.id} ORDER BY created_at`;
  const notesByVideo = Map.groupBy(notes.map(noteJson), (n) => n.videoId);

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
    return {
      type: r.item_type,
      id: r.item_id,
      snapshot: { ...r.snapshot, ...live },
      addedAt: r.added_at,
      ...(r.item_type === "video" && { notes: notesByVideo.get(r.item_id) ?? [] }),
    };
  });
  res.json({ folder, items });
}

export async function rename(req, res) {
  const name = parseFolderName(req.body?.name);
  if (!name) return res.status(400).json({ error: NAME_ERROR });
  const [folder] = await sql`
    UPDATE saved_folders SET name = ${name}, updated_at = now()
    WHERE id = ${req.params.folderId} AND ${inWorkspace(req.workspace)}
    RETURNING id, name`;
  if (!folder) return res.status(404).json({ error: "Dossier introuvable." });
  res.json({ folder });
}

/** Delete a folder and everything saved in it. */
export async function remove(req, res) {
  const deleted = await sql`
    DELETE FROM saved_folders WHERE id = ${req.params.folderId} AND ${inWorkspace(req.workspace)} RETURNING id`;
  if (!deleted.length) return res.status(404).json({ error: "Dossier introuvable." });
  res.json({ success: true });
}

/** Save a video or channel in a folder (saving it again refreshes its snapshot). */
export async function addItem(req, res) {
  const { folderId } = req.params;
  if (!(await ownsFolder(folderId, req.workspace))) return res.status(404).json({ error: "Dossier introuvable." });
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
  if (!(await ownsFolder(folderId, req.workspace))) return res.status(404).json({ error: "Dossier introuvable." });
  const { type, id } = req.query;
  if ((type !== "video" && type !== "channel") || typeof id !== "string" || !id) {
    return res.status(400).json({ error: "Élément invalide." });
  }

  await sql`DELETE FROM saved_folder_items WHERE folder_id = ${folderId} AND item_type = ${type} AND item_id = ${id}`;
  await sql`UPDATE saved_folders SET updated_at = now() WHERE id = ${folderId}`;
  res.json({ success: true });
}

/** Add an ideation note (`{ kind, body }`) to a video saved in the folder. */
export async function addNote(req, res) {
  const { folderId, videoId } = req.params;
  if (!(await ownsFolder(folderId, req.workspace))) return res.status(404).json({ error: "Dossier introuvable." });
  const note = parseNote(req.body);
  if (!note) return res.status(400).json({ error: NOTE_ERROR });
  const [item] = await sql`
    SELECT 1 FROM saved_folder_items WHERE folder_id = ${folderId} AND item_type = 'video' AND item_id = ${videoId}`;
  if (!item) return res.status(404).json({ error: "Vidéo introuvable dans ce dossier." });

  const id = `note_${crypto.randomBytes(8).toString("hex")}`;
  const [row] = await sql`
    INSERT INTO saved_folder_notes (id, folder_id, item_id, kind, body)
    VALUES (${id}, ${folderId}, ${videoId}, ${note.kind}, ${note.body})
    RETURNING id, item_id, kind, body, created_at, updated_at`;
  await sql`UPDATE saved_folders SET updated_at = now() WHERE id = ${folderId}`;
  res.status(201).json({ note: noteJson(row) });
}

/** Edit a note's text and/or kind. */
export async function updateNote(req, res) {
  const { folderId, noteId } = req.params;
  if (!(await ownsFolder(folderId, req.workspace))) return res.status(404).json({ error: "Dossier introuvable." });
  const note = parseNote(req.body, { partial: true });
  if (!note) return res.status(400).json({ error: NOTE_ERROR });

  const [row] = await sql`
    UPDATE saved_folder_notes SET ${sql(note)}, updated_at = now()
    WHERE id = ${noteId} AND folder_id = ${folderId}
    RETURNING id, item_id, kind, body, created_at, updated_at`;
  if (!row) return res.status(404).json({ error: "Note introuvable." });
  res.json({ note: noteJson(row) });
}

export async function removeNote(req, res) {
  const { folderId, noteId } = req.params;
  if (!(await ownsFolder(folderId, req.workspace))) return res.status(404).json({ error: "Dossier introuvable." });
  const deleted = await sql`
    DELETE FROM saved_folder_notes WHERE id = ${noteId} AND folder_id = ${folderId} RETURNING id`;
  if (!deleted.length) return res.status(404).json({ error: "Note introuvable." });
  res.json({ success: true });
}

/**
 * AI help while writing a note: `{ mode: "complete" | "fix", kind, body, locale }`
 * returns `{ text }`, the suggested note. Nothing is saved; the client puts the
 * text in the editor and the user keeps or undoes it.
 */
export async function assistNote(req, res) {
  const { folderId, videoId } = req.params;
  if (!(await ownsFolder(folderId, req.workspace))) return res.status(404).json({ error: "Dossier introuvable." });
  if (!aiEnabled()) return res.status(503).json({ error: "L'IA n'est pas configurée sur ce serveur (GROQ_API_KEY)." });

  const { mode, kind, body = "", locale } = req.body ?? {};
  if ((mode !== "complete" && mode !== "fix") || !NOTE_KINDS.includes(kind) || typeof body !== "string") {
    return res.status(400).json({ error: "Requête invalide." });
  }
  if (body.length > NOTE_BODY_MAX) return res.status(400).json({ error: NOTE_ERROR });
  if (mode === "fix" && !body.trim()) return res.status(400).json({ error: "Écris d'abord un texte à corriger." });

  const [item] = await sql`
    SELECT i.snapshot, v.view_count, v.outlier_multiplier, v.is_short
    FROM saved_folder_items i
    LEFT JOIN videos v ON v.youtube_video_id = i.item_id
    WHERE i.folder_id = ${folderId} AND i.item_type = 'video' AND i.item_id = ${videoId}`;
  if (!item) return res.status(404).json({ error: "Vidéo introuvable dans ce dossier." });
  const video = {
    ...item.snapshot,
    ...(item.view_count != null && { views: Number(item.view_count) }),
    ...(item.outlier_multiplier != null && { multiplier: Number(item.outlier_multiplier) }),
    ...(item.is_short != null && { isShort: item.is_short }),
  };

  try {
    const text = await assistNoteWithAi({ mode, kind, body, locale: locale === "en" ? "en" : "fr", video });
    res.json({ text: text.slice(0, NOTE_BODY_MAX) });
  } catch (err) {
    if (err instanceof AiRefusedError) return res.status(422).json({ error: "L'IA n'a pas pu proposer de texte pour cette note." });
    console.error("[folders] AI assist failed:", err);
    res.status(502).json({ error: "L'IA est indisponible pour le moment. Réessaie dans un instant." });
  }
}
