import { Router } from "express";
import { requireUser } from "../lib/admin.js";
import * as videos from "../controllers/videos.js";
import * as channels from "../controllers/channels.js";
import * as home from "../controllers/home.js";

const router = Router();

// Guarded per route: this router is mounted on /api, a router-wide guard would catch every /api path
router.get("/home", requireUser, home.home);
router.get("/videos/top", requireUser, videos.topVideos);
router.get("/channels/breakout", requireUser, channels.breakout);
router.get("/channels/:channelId/similar", requireUser, channels.similar);

// Express 5 forwards rejected handlers here; answer in JSON like the routes do
router.use((err, req, res, next) => {
  console.error("[explore]", err);
  res.status(500).json({ error: "Impossible de charger les données." });
});

export default router;
