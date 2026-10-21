// Load .env so `node server.js` works without --env-file.
// Must be the first import: modules like lib/auth.js read process.env at import time.
try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on the real environment.
}
