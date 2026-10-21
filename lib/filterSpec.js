/**
 * Declarative filters for the explore API. One spec per list (videos, channels)
 * drives three things, so they can never disagree:
 *   - parsing and validating the query string (unknown values are ignored)
 *   - the SQL WHERE / ORDER BY fragments
 *   - the /api/filters metadata the frontend renders its controls from
 *
 * Filter types:
 *   enum     one or several values (comma-separated) from a fixed list; `column = any(...)`
 *   tags     like enum, matched against a text[] column with && (has any of)
 *   range    numeric min/max: params min<Key> / max<Key>
 *   bool     "true" / "false"
 *   choice   one value among options, each with its own SQL
 *   text     free text search
 */
import { sql } from "./sql.js";

const MAX_LIST = 30;

function parseList(raw) {
  if (raw == null || raw === "" || raw === "all") return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST);
}

function parseNumber(raw) {
  if (raw == null || raw === "" || raw === "all") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Parse req.query against a spec. Returns the applied values (for the
 * response) and the SQL condition (a fragment, TRUE when nothing applies).
 */
export function applyFilters(spec, query) {
  const applied = {};
  const conditions = [];

  for (const filter of spec.filters) {
    const raw = query[filter.key];
    switch (filter.type) {
      case "enum":
      case "tags": {
        const allowed = filter.values ? new Set(filter.values()) : null;
        let values = parseList(raw);
        if (filter.numeric) values = values.map(Number).filter(Number.isFinite);
        if (allowed) values = values.filter((v) => allowed.has(filter.numeric ? Number(v) : v));
        if (filter.pattern) values = values.filter((v) => filter.pattern.test(String(v)));
        if (!values.length) break;
        applied[filter.key] = values;
        conditions.push(
          filter.type === "tags"
            ? sql`${filter.column} && ${values}::text[]`
            // Plain arrays with a cast: sql.array() is sent as text on a connection's first query.
            : filter.where?.(values) ??
                (filter.numeric ? sql`${filter.column} = any(${values}::int[])` : sql`${filter.column} = any(${values}::text[])`),
        );
        break;
      }
      case "range": {
        const scale = filter.scale ?? 1;
        const min = parseNumber(query[`min${capitalize(filter.key)}`]);
        const max = parseNumber(query[`max${capitalize(filter.key)}`]);
        if (min != null) {
          applied[`min${capitalize(filter.key)}`] = min;
          conditions.push(sql`${filter.column} >= ${min * scale}`);
        }
        if (max != null) {
          applied[`max${capitalize(filter.key)}`] = max;
          conditions.push(sql`${filter.column} <= ${max * scale}`);
        }
        break;
      }
      case "bool": {
        const value = raw === "true" ? true : raw === "false" ? false : filter.default;
        if (value == null) break;
        applied[filter.key] = value;
        const fragment = filter.where(value);
        if (fragment) conditions.push(fragment);
        break;
      }
      case "choice": {
        const option = filter.options.find((o) => o.value === raw) ?? filter.options.find((o) => o.value === filter.default);
        if (!option) break;
        applied[filter.key] = option.value;
        if (option.where) conditions.push(option.where);
        break;
      }
      case "text": {
        const text = String(raw ?? "").trim().slice(0, 100);
        if (!text) break;
        applied[filter.key] = text;
        conditions.push(filter.where(text));
        break;
      }
    }
  }

  const where = conditions.length
    ? conditions.reduce((acc, c, i) => (i === 0 ? sql`(${c})` : sql`${acc} and (${c})`), sql``)
    : sql`true`;
  return { where, applied };
}

export function applySort(spec, query) {
  const option = spec.sorts.find((s) => s.value === query.sort) ?? spec.sorts.find((s) => s.value === spec.defaultSort);
  return { sort: option.value, orderBy: option.orderBy };
}

export function parsePage(query, pageSize) {
  const page = Math.max(0, Math.floor(parseNumber(query.page) ?? 0));
  return { page, limit: pageSize, offset: page * pageSize };
}

/** Metadata for the frontend: what can be filtered, with labels and allowed values. */
export function describeSpec(spec, counts = {}) {
  return {
    filters: spec.filters.map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      ...(f.type === "range" ? { params: [`min${capitalize(f.key)}`, `max${capitalize(f.key)}`], unit: f.unit ?? null, presets: f.presets ?? null } : {}),
      ...(f.type === "bool" ? { default: f.default ?? null } : {}),
      ...(f.type === "choice"
        ? { default: f.default, options: f.options.map((o) => ({ value: o.value, label: o.label })) }
        : {}),
      ...(f.options && f.type !== "choice"
        ? {
            options: f.options().map((o) => ({
              ...o,
              count: counts[f.key]?.get(String(o.value)) ?? (counts[f.key] ? 0 : undefined),
            })),
          }
        : {}),
    })),
    sorts: spec.sorts.map((s) => ({ value: s.value, label: s.label })),
    defaultSort: spec.defaultSort,
  };
}
