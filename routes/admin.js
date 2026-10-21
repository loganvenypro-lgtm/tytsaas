import { Router } from "express";
import { requireAdmin } from "../lib/admin.js";
import * as admin from "../controllers/admin.js";
import * as worker from "../controllers/worker.js";

const router = Router();

router.use(requireAdmin);

router.get("/overview", admin.overview);
router.get("/users", admin.users);
router.get("/onboardings", admin.onboardings);
router.get("/folders", admin.folders);
router.get("/tracked", admin.tracked);
router.get("/ab-tests", admin.abTests);
router.get("/thumbnails", admin.thumbnail);
router.get("/tables", admin.tables);
router.get("/tables/:name", admin.tableRows);
router.get("/worker", worker.status);
router.post("/worker/run", worker.run);
router.post("/worker/discord-test", worker.testDiscord);

// Express 5 forwards rejected handlers here; answer in JSON like the routes do
router.use((err, req, res, next) => {
  console.error("[admin]", err);
  res.status(500).json({ error: err.message || "Erreur serveur." });
});

export default router;
