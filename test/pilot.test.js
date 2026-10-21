import { test } from "node:test";
import assert from "node:assert/strict";
import { planQuota, tickAllowance } from "../worker/pilot.js";

const config = {
  discoveryIntervalHours: 6,
  discoveryQuota: 900,
  discoveryMaxNewPerRun: 300,
  pilotDiscoveryShare: 0.4,
  pilotGrowthShare: 0.25,
  pilotMinHeadroomShare: 0.1,
};
const demand = (total, unitsPerChannel = 0.4) => ({ total, unitsPerChannel, activeChannels: 5000 });

test("with plenty of headroom, discovery is capped by its own limits", () => {
  const plan = planQuota({ demand: demand(1000), dailyBudget: 9000, fixedUnits: 104, config });
  assert.equal(plan.saturated, false);
  assert.equal(plan.headroom, 9000 - 1104);
  // 40 % of the headroom over 4 runs a day = 790, under the 900 cap.
  assert.equal(plan.discoveryUnits, 789);
  // 25 % of the headroom / 0.4 units per channel / 4 runs = 1233, capped at 300.
  assert.equal(plan.maxNewChannels, 300);
});

test("growth slows down as refreshes approach the budget", () => {
  const roomy = planQuota({ demand: demand(4000), dailyBudget: 9000, config });
  const tight = planQuota({ demand: demand(7500), dailyBudget: 9000, config });
  assert.ok(tight.discoveryUnits < roomy.discoveryUnits);
  assert.ok(tight.maxNewChannels < roomy.maxNewChannels);
  assert.ok(tight.maxNewChannels > 0);
});

test("under the minimum headroom, discovery stops", () => {
  const plan = planQuota({ demand: demand(8000), dailyBudget: 9000, fixedUnits: 104, config });
  assert.equal(plan.saturated, true);
  assert.equal(plan.discoveryUnits, 0);
  assert.equal(plan.maxNewChannels, 0);
});

test("fixed daily costs (trending charts) count against the headroom", () => {
  const without = planQuota({ demand: demand(7900), dailyBudget: 9000, config });
  const withTrending = planQuota({ demand: demand(7900), dailyBudget: 9000, fixedUnits: 300, config });
  assert.equal(without.saturated, false);
  assert.equal(withTrending.saturated, true);
});

test("a tick gets twice its even share, never more than what's left today", () => {
  assert.deepEqual(tickAllowance({ dailyBudget: 9000, usedToday: 0, tickMinutes: 30 }), { leftToday: 9000, allowance: 375 });
  assert.deepEqual(tickAllowance({ dailyBudget: 9000, usedToday: 8900, tickMinutes: 30 }), { leftToday: 100, allowance: 100 });
  assert.deepEqual(tickAllowance({ dailyBudget: 9000, usedToday: 9500, tickMinutes: 30 }), { leftToday: 0, allowance: 0 });
});
