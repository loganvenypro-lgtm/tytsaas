/** Shared types for the user's folders, used by the "Save" menu and the /folders pages. */

export type SavedItemType = "video" | "channel"

/** What a card showed when it was saved: enough to render it again without a lookup. */
export interface SavedItemSnapshot {
  title: string
  thumbnail?: string | null
  /** Videos: the channel that posted it. */
  channelId?: string | null
  channelName?: string | null
  views?: number | null
  multiplier?: number | null
  publishedAt?: string | null
  isShort?: boolean
  /** Channels. */
  handle?: string | null
  subscribers?: number | null
}

export interface SavedItemInput {
  type: SavedItemType
  id: string
  snapshot: SavedItemSnapshot
}

export interface SavedFolder {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  videoCount: number
  channelCount: number
  /** Up to 4 thumbnails for the folder preview. */
  previews: string[]
  /** Set when the list was asked about one item: whether this folder holds it. */
  containsItem?: boolean
}

export interface SavedItem {
  type: SavedItemType
  id: string
  snapshot: SavedItemSnapshot
  addedAt: string
  /** Videos only: the ideation notes attached to it in this folder, oldest first. */
  notes?: FolderNote[]
}

/** Fired on window after any folder change, so open menus and pages refresh. */
export const FOLDERS_CHANGED_EVENT = "folders-changed"

export const FOLDER_NAME_MAX = 80

/** Kinds of ideation notes a video saved in a folder can carry. */
export const NOTE_KINDS = ["idea", "hook", "title"] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

export const NOTE_BODY_MAX = 4000

/** A block of text (idea, hook, title) the user attached to a saved video. */
export interface FolderNote {
  id: string
  videoId: string
  kind: NoteKind
  body: string
  createdAt: string
  updatedAt: string
}
