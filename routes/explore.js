import { Router } from "express";
import { requireUser } from "../lib/admin.js";
import * as videos from "../controllers/videos.js";
import * as channels from "../controllers/channels.js";
import * as home from "../controllers/home.js";
import * as filters from "../controllers/filters.js";
import * as folders from "../controllers/folders.js";

const router = Router();

// Guarded per route: this router is mounted on /api, a router-wide guard would catch every /api path
router.get("/home", requireUser, home.home);
router.get("/filters/videos", requireUser, filters.videoFilters);
router.get("/filters/channels", requireUser, filters.channelFilters);
router.get("/taxonomy", requireUser, filters.taxonomy);
router.get("/videos/top", requireUser, videos.topVideos);
router.get("/videos/:videoId/variants", requireUser, videos.variants);
router.get("/videos/:videoId/thumbnails/:version", requireUser, videos.thumbnailImage);
router.get("/channels/breakout", requireUser, channels.breakout);
router.get("/channels/monetization", requireUser, channels.monetizationEvents);
router.get("/channels/niche-finder", requireUser, channels.nicheFinder);
router.get("/channels/:channelId/similar", requireUser, channels.similar);
router.get("/trending", requireUser, channels.trending);
router.get("/folders", requireUser, folders.list);
router.post("/folders", requireUser, folders.create);
router.get("/folders/:folderId", requireUser, folders.get);
router.patch("/folders/:folderId", requireUser, folders.rename);
router.delete("/folders/:folderId", requireUser, folders.remove);
router.post("/folders/:folderId/items", requireUser, folders.addItem);
router.delete("/folders/:folderId/items", requireUser, folders.removeItem);

// Express 5 forwards rejected handlers here; answer in JSON like the routes do
router.use((err, req, res, next) => {
  console.error("[explore]", err);
  res.status(500).json({ error: "Impossible de charger les données." });
});

export default router;
