import { configDiffHints, type ConfigDiffHints } from "./registry";

export interface Change {
  /** Human-readable location, e.g. `sla.targets[INPATIENT].businessDays`. */
  path: string;
  /** Config dimension the change belongs to (first path segment). */
  dimension: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

type Json = unknown;

const isObject = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function identity(item: Json, key: string | string[]): string {
  const parts = Array.isArray(key) ? key : [key];
  return parts.map((k) => String(isObject(item) ? item[k] : item)).join("/");
}

/**
 * Structural diff of two tenant configs (or any two versions of one).
 * Arrays are matched by identity, not position, so a reordered list is not a change and a
 * removed tier is not reported as "every later tier changed". See `DiffHints` in types.ts.
 */
export function diffConfigs(
  a: Json,
  b: Json,
  hints: ConfigDiffHints = configDiffHints(),
): Change[] {
  const changes: Change[] = [];

  const push = (path: string, kind: Change["kind"], before?: Json, after?: Json) => {
    changes.push({ path, dimension: path.split(/[.[]/)[0], kind, before, after });
  };

  const walk = (path: string, hintPath: string, left: Json, right: Json) => {
    if (left === undefined && right === undefined) return;
    if (left === undefined) return push(path, "added", undefined, right);
    if (right === undefined) return push(path, "removed", left, undefined);

    if (Array.isArray(left) && Array.isArray(right)) {
      if (hints.sets.has(hintPath)) {
        const key = (v: Json) => JSON.stringify(v);
        const leftKeys = new Set(left.map(key));
        const rightKeys = new Set(right.map(key));
        for (const item of left) if (!rightKeys.has(key(item))) push(`${path}[${String(item)}]`, "removed", item);
        for (const item of right) if (!leftKeys.has(key(item))) push(`${path}[${String(item)}]`, "added", undefined, item);
        return;
      }
      const keyed = hints.keyed[hintPath];
      if (keyed) {
        const leftMap = new Map(left.map((item) => [identity(item, keyed), item]));
        const rightMap = new Map(right.map((item) => [identity(item, keyed), item]));
        for (const [id, item] of leftMap) {
          if (!rightMap.has(id)) push(`${path}[${id}]`, "removed", item);
          else walk(`${path}[${id}]`, hintPath, item, rightMap.get(id));
        }
        for (const [id, item] of rightMap) {
          if (!leftMap.has(id)) push(`${path}[${id}]`, "added", undefined, item);
        }
        return;
      }
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        walk(`${path}[${i}]`, hintPath, left[i], right[i]);
      }
      return;
    }

    if (isObject(left) && isObject(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const k of keys) walk(path ? `${path}.${k}` : k, hintPath ? `${hintPath}.${k}` : k, left[k], right[k]);
      return;
    }

    if (!deepEqual(left, right)) push(path, "changed", left, right);
  };

  walk("", "", a, b);
  return changes;
}
