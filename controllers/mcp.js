import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sql } from "../lib/sql.js";
import { MCP_SERVER_INFO, registerMcpTools } from "../lib/mcpTools.js";
import {
  MCP_KEY_NAME_MAX,
  MCP_KEYS_PER_USER,
  countMcpKeys,
  createMcpKey,
  listMcpKeys,
  resolveMcpKey,
  revokeMcpKey,
} from "../lib/mcpKeys.js";

/**
 * GET|POST|DELETE /api/mcp: the MCP server (Streamable HTTP, stateless). Each
 * user connects Claude with a personal key, sent as `Authorization: Bearer` or
 * as `?key=` for clients that only take a URL (claude.ai custom connectors).
 */
export async function handle(req, res) {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const key = (bearer ?? (typeof req.query.key === "string" ? req.query.key : "")).trim();
  const owner = key ? await resolveMcpKey(key) : null;
  if (!owner) {
    res.set("WWW-Authenticate", 'Bearer realm="tytsaas"');
    return res.status(401).json({ error: "Clé MCP manquante ou révoquée. Crée-en une sur la page Connecter Claude." });
  }

  const server = new McpServer(MCP_SERVER_INFO);
  registerMcpTools(server, sql, { allowSql: owner.isAdmin });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

/** GET /api/mcp-keys: the signed-in user's active keys. */
export async function listKeys(req, res) {
  res.json({ keys: await listMcpKeys(req.user.id) });
}

/** POST /api/mcp-keys: the response carries the plain key, the only time it is ever shown. */
export async function createKey(req, res) {
  const name = (typeof req.body?.name === "string" ? req.body.name.trim() : "") || "Claude";
  if (name.length > MCP_KEY_NAME_MAX) {
    return res.status(400).json({ error: `Nom trop long (${MCP_KEY_NAME_MAX} caractères max).` });
  }
  if ((await countMcpKeys(req.user.id)) >= MCP_KEYS_PER_USER) {
    return res.status(400).json({ error: `Maximum ${MCP_KEYS_PER_USER} clés actives. Révoque-en une d'abord.` });
  }
  res.status(201).json(await createMcpKey(req.user.id, name));
}

/** DELETE /api/mcp-keys/:keyId: Claude loses access right away. */
export async function revokeKey(req, res) {
  if (!(await revokeMcpKey(req.user.id, req.params.keyId))) {
    return res.status(404).json({ error: "Clé introuvable." });
  }
  res.json({ ok: true });
}
