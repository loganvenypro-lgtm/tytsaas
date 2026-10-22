// Teams: the request's workspace, team names and slugs, roles (lib/teams.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEAM_NAME_MAX, canManageTeam, pickWorkspace, parseTeamName, teamSlug } from "../lib/teams.js";

test("workspace: the active team when the user is a member, else the personal space", () => {
  assert.deepEqual(pickWorkspace("u1", null, null), { userId: "u1", teamId: null, role: null });
  assert.deepEqual(pickWorkspace("u1", "org1", "admin"), { userId: "u1", teamId: "org1", role: "admin" });
  // Removed from the team (no member row): back to the personal space at once
  assert.deepEqual(pickWorkspace("u1", "org1", undefined), { userId: "u1", teamId: null, role: null });
  assert.deepEqual(pickWorkspace("u1", "org1", "intruder"), { userId: "u1", teamId: null, role: null });
});

test("roles: owners and admins manage the team, members don't", () => {
  assert.equal(canManageTeam("owner"), true);
  assert.equal(canManageTeam("admin"), true);
  assert.equal(canManageTeam("member"), false);
  assert.equal(canManageTeam(null), false);
});

test("team names: trimmed, spaces collapsed, 1 to 60 characters", () => {
  assert.equal(parseTeamName("  Studio   Shorts "), "Studio Shorts");
  assert.equal(parseTeamName("   "), null);
  assert.equal(parseTeamName(42), null);
  assert.equal(parseTeamName("x".repeat(TEAM_NAME_MAX)), "x".repeat(TEAM_NAME_MAX));
  assert.equal(parseTeamName("x".repeat(TEAM_NAME_MAX + 1)), null);
});

test("slugs: ASCII from the name, with a suffix to keep them unique", () => {
  assert.equal(teamSlug("Équipe Vidéo #1", "a1b2c3"), "equipe-video-1-a1b2c3");
  assert.equal(teamSlug("🔥🔥", "a1b2c3"), "team-a1b2c3");
  assert.match(teamSlug("x".repeat(60), "abc"), /^x{40}-abc$/);
});
