import { Router } from "express";
import { requireUser } from "../lib/admin.js";
import * as videos from "../controllers/videos.js";
import * as channels from "../controllers/channels.js";
import * as channelLookup from "../controllers/channelLookup.js";
import * as home from "../controllers/home.js";
import * as filters from "../controllers/filters.js";
import * as folders from "../controllers/folders.js";
import * as onboarding from "../controllers/onboarding.js";
import * as titleFormats from "../controllers/titleFormats.js";
import * as inspirations from "../controllers/inspirations.js";
import * as alerts from "../controllers/alerts.js";
import * as keywords from "../controllers/keywords.js";
import * as mcp from "../controllers/mcp.js";
import * as myChannel from "../controllers/myChannel.js";
import * as teams from "../controllers/teams.js";
import { landing } from "../controllers/landing.js";
import { weeklyDigest } from "../controllers/weeklyDigest.js";
import * as notifications from "../controllers/notifications.js";
import * as shareLinks from "../controllers/shareLinks.js";
import * as digestSettings from "../controllers/digestSettings.js";
import { similarVideos } from "../controllers/similarVideos.js";
import * as account from "../controllers/account.js";
import * as feedback from "../controllers/feedback.js";

const router = Router();

// Guarded per route: this router is mounted on /api, a router-wide guard would catch every /api path
// Public: the landing page (/welcome) is shown to signed-out visitors
router.get("/landing", landing);
router.get("/onboarding/channel", requireUser, onboarding.findChannel);
router.get("/onboarding/niche/:niche", requireUser, onboarding.nicheChannels);
router.post("/onboarding", requireUser, onboarding.complete);
router.get("/home", requireUser, home.home);
router.post("/feedback", requireUser, feedback.send);
router.post("/account/youtube/disconnect", requireUser, account.disconnectYouTube);
router.delete("/account", requireUser, account.deleteAccount);
router.get("/weekly-digest", requireUser, weeklyDigest);
router.get("/digest-settings", requireUser, digestSettings.get);
router.put("/digest-settings", requireUser, digestSettings.update);
router.get("/notifications", requireUser, notifications.list);
router.get("/filters/videos", requireUser, filters.videoFilters);
router.get("/filters/channels", requireUser, filters.channelFilters);
router.get("/taxonomy", requireUser, filters.taxonomy);
router.get("/videos/top", requireUser, videos.topVideos);
router.get("/videos/similar", requireUser, similarVideos);
router.get("/keywords", requireUser, keywords.search);
router.get("/videos/:videoId/variants", requireUser, videos.variants);
router.get("/videos/:videoId/thumbnails/:version", requireUser, videos.thumbnailImage);
router.get("/channels/breakout", requireUser, channels.breakout);
router.get("/channels/monetization", requireUser, channels.monetizationEvents);
router.get("/channels/niche-finder", requireUser, channels.nicheFinder);
router.get("/channels/terminated", requireUser, channels.terminatedChannels);
router.get("/channels/lookup", requireUser, channelLookup.lookup);
router.get("/channels/videos/:videoId", requireUser, channelLookup.videoStats);
router.get("/channels/:channelId/videos", requireUser, channelLookup.channelVideos);
router.get("/channels/:channelId/similar", requireUser, channels.similar);
router.get("/channels/:channelId/profile", requireUser, channelLookup.profile);
router.get("/trending", requireUser, channels.trending);
router.get("/channels/search", requireUser, inspirations.searchChannels);
router.get("/followed-ids", requireUser, inspirations.ids);
// Followed channels: /inspirations and /competitors share their handlers
for (const [path, kind] of [["/inspirations", "inspiration"], ["/competitors", "competitor"]]) {
  router.get(path, requireUser, inspirations.list(kind));
  router.post(path, requireUser, inspirations.follow(kind));
  router.post(`${path}/seen`, requireUser, inspirations.markSeen(kind));
  router.post(`${path}/import-outlr`, requireUser, inspirations.importOutlr(kind));
  router.patch(`${path}/:channelId`, requireUser, inspirations.update(kind));
  router.delete(`${path}/:channelId`, requireUser, inspirations.unfollow(kind));
}
router.get("/alerts", requireUser, alerts.list);
router.post("/alerts", requireUser, alerts.create);
router.get("/alerts/unread", requireUser, alerts.unread);
router.get("/alerts/feed", requireUser, alerts.feed);
router.post("/alerts/preview", requireUser, alerts.preview);
router.post("/alerts/read", requireUser, alerts.markRead);
router.patch("/alerts/:alertId", requireUser, alerts.update);
router.delete("/alerts/:alertId", requireUser, alerts.remove);
router.post("/alerts/:alertId/test", requireUser, alerts.testDiscord);
// The user's own channel ("Ma chaîne"): linked through Google OAuth, data from the database first
router.get("/my-channel", requireUser, myChannel.status);
router.post("/my-channel/connect", requireUser, myChannel.connect);
router.post("/my-channel/sync", requireUser, myChannel.sync);
router.get("/my-channel/overview", requireUser, myChannel.overview);
router.get("/my-channel/ab-tests", requireUser, myChannel.abTests);
router.get("/my-channel/revivals", requireUser, myChannel.revivals);
router.post("/my-channel/videos/:videoId/report", requireUser, myChannel.report);
router.get("/formats", requireUser, titleFormats.list);
router.get("/formats/:formatId/videos", requireUser, titleFormats.videos);
// Teams: the rest (members, invitations, switching) is Better Auth's /api/auth/organization/*
router.get("/workspace", requireUser, teams.workspace);
router.post("/teams", requireUser, teams.create);
// Share links: managed by the owner, opened by anyone (/shared/:token is public)
router.get("/share/:kind/:targetId", requireUser, shareLinks.get);
router.post("/share/:kind/:targetId", requireUser, shareLinks.enable);
router.delete("/share/:kind/:targetId", requireUser, shareLinks.disable);
router.get("/shared/:token", shareLinks.open);
router.post("/shared/:token/join", requireUser, shareLinks.join);
router.get("/folders", requireUser, folders.list);
router.post("/folders", requireUser, folders.create);
router.get("/folders/:folderId", requireUser, folders.get);
router.patch("/folders/:folderId", requireUser, folders.rename);
router.delete("/folders/:folderId", requireUser, folders.remove);
router.post("/folders/:folderId/items", requireUser, folders.addItem);
router.delete("/folders/:folderId/items", requireUser, folders.removeItem);
router.post("/folders/:folderId/items/:videoId/notes", requireUser, folders.addNote);
router.patch("/folders/:folderId/notes/:noteId", requireUser, folders.updateNote);
router.delete("/folders/:folderId/notes/:noteId", requireUser, folders.removeNote);
router.post("/folders/:folderId/items/:videoId/notes/assist", requireUser, folders.assistNote);
// The MCP server authenticates with the user's MCP key, not the session cookie
router.all("/mcp", mcp.handle);
router.get("/mcp-keys", requireUser, mcp.listKeys);
router.post("/mcp-keys", requireUser, mcp.createKey);
router.delete("/mcp-keys/:keyId", requireUser, mcp.revokeKey);

// Express 5 forwards rejected handlers here; answer in JSON like the routes do
router.use((err, req, res, next) => {
  console.error("[explore]", err);
  res.status(500).json({ error: "Impossible de charger les données." });
});

export default router;
