import "./lib/env.js";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import adminRoutes from "./routes/admin.js";
import exploreRoutes from "./routes/explore.js";

const app = express();
app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

// Better Auth must be mounted before express.json(), otherwise the request body is consumed
app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api", exploreRoutes);

app.use((req, res) => res.status(404).json({ error: "Introuvable." }));

// Errors no router caught (a malformed JSON body, one over the size limit): Express's
// own handler would answer with the stack trace and server paths
app.use((err, req, res, next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error("[api]", err);
  res.status(status).json({ error: status === 500 ? "Erreur serveur." : "Requête invalide." });
});

// Only Next (same machine) needs to reach the API; HOST=0.0.0.0 opens it to the network
const port = process.env.PORT || 3000;
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
