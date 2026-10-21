/**
 * Quota pilot: keeps the database growing only as fast as the quota can keep
 * it fresh. headroom = daily budget - what the refresh schedule and the daily
 * trending charts need per day.
 *   - discovery gets PILOT_DISCOVERY_SHARE of the headroom per day
 *   - new channels may add PILOT_GROWTH_SHARE of the headroom to the daily
 *     refresh demand per day, so growth slows down as the ceiling gets closer
 *   - under PILOT_MIN_HEADROOM_SHARE of the budget, discovery stops and the
 *     backfill slows down until refreshes fit again
 * Pure: the demand is measured by worker/refreshPolicy.js.
 */
export function planQuota({ demand, dailyBudget, fixedUnits = 0, config }) {
  const needed = demand.total + fixedUnits;
  const headroom = dailyBudget - needed;
  const runsPerDay = 24 / config.discoveryIntervalHours;
  const saturated = headroom < dailyBudget * config.pilotMinHeadroomShare;
  return {
    demand,
    fixedUnits,
    headroom,
    saturated,
    discoveryUnits: saturated
      ? 0
      : Math.floor(Math.min(config.discoveryQuota, (headroom * config.pilotDiscoveryShare) / runsPerDay)),
    maxNewChannels: saturated
      ? 0
      : Math.floor(
          Math.min(
            config.discoveryMaxNewPerRun,
            (headroom * config.pilotGrowthShare) / Math.max(demand.unitsPerChannel, 0.1) / runsPerDay,
          ),
        ),
  };
}

/**
 * The tick's share of the daily budget: an even split over the day's ticks,
 * doubled so the worker can catch up after downtime, never past what's left today.
 */
export function tickAllowance({ dailyBudget, usedToday, tickMinutes }) {
  const leftToday = Math.max(0, dailyBudget - usedToday);
  const ticksPerDay = Math.max(1, Math.floor(1440 / tickMinutes));
  return { leftToday, allowance: Math.min(leftToday, Math.ceil((dailyBudget / ticksPerDay) * 2)) };
}
