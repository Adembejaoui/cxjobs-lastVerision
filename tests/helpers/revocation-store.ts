import { PUBLISH_MAX_LUA, type RevocationStore } from "../../lib/server/session-revocation";

/**
 * In-memory RevocationStore that emulates PUBLISH_MAX_LUA exactly (EVAL is
 * atomic in Redis; JS here is single-threaded, so each call is atomic too).
 * It refuses any other script, so a change to the production script without
 * a matching test change fails loudly.
 */
export function createMemoryRevocationStore() {
  const data = new Map<string, { v: string; ex: number }>();
  const store: RevocationStore = {
    async get(key) {
      return data.get(key)?.v ?? null;
    },
    async eval(script, keys, args) {
      if (script !== PUBLISH_MAX_LUA) throw new Error("unexpected script");
      const [key] = keys;
      const [vRaw, exRaw] = args;
      const curNum = Number(data.get(key)?.v);
      const cur = Number.isFinite(curNum) ? curNum : -1;
      const v = Number(vRaw);
      const ex = Number(exRaw);
      if (v > cur) {
        data.set(key, { v: vRaw, ex });
        return v;
      }
      const existing = data.get(key);
      if (existing) existing.ex = ex;
      return cur;
    },
  };
  return { store, data, value: (key: string) => data.get(key)?.v ?? undefined };
}
