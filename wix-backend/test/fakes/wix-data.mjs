// A small in-memory stand-in for wix-data: just the calls the clean-up uses.
export const db = new Map();   // collection -> Map(_id -> item)
export const calls = [];
const table = (c) => (db.has(c) ? db.get(c) : db.set(c, new Map()).get(c));
const t = (v) => (v instanceof Date ? v.getTime() : Date.parse(v));
const empty = (v) => v === undefined || v === null || v === '';

class Query {
  constructor(c) { this.c = c; this.f = []; this.order = null; this._skip = 0; this._limit = 50; }
  eq(k, v) { this.f.push((i) => i[k] === v); return this; }
  lt(k, v) { this.f.push((i) => !empty(i[k]) && t(i[k]) < t(v)); return this; }
  startsWith(k, v) { this.f.push((i) => String(i[k] ?? '').startsWith(v)); return this; }
  hasSome(k, vs) { this.f.push((i) => vs.includes(i[k])); return this; }
  isEmpty(k) { this.f.push((i) => empty(i[k])); return this; }
  ascending(k) { this.order = k; return this; }
  skip(n) { this._skip = n; return this; }
  limit(n) { this._limit = n; return this; }
  async find(opts) {
    if (!opts?.suppressAuth) throw new Error('permission denied');
    let all = [...table(this.c).values()].filter((i) => this.f.every((f) => f(i)));
    if (this.order) all.sort((a, b) => (t(a[this.order]) || 0) - (t(b[this.order]) || 0));
    const items = all.slice(this._skip, this._skip + this._limit).map((i) => ({ ...i }));
    const more = all.length > this._skip + this._limit;
    return { items, hasNext: () => more };
  }
}

export default {
  query: (c) => new Query(c),
  async get(c, id, opts) { if (!opts?.suppressAuth) throw new Error('permission denied'); const i = table(c).get(id); return i ? { ...i } : null; },
  async update(c, item, opts) { if (!opts?.suppressAuth) throw new Error('permission denied'); calls.push(['update', c, item._id]); table(c).set(item._id, { ...item, _updatedDate: new Date() }); return item; },
  async remove(c, id, opts) { if (!opts?.suppressAuth) throw new Error('permission denied'); calls.push(['remove', c, id]); table(c).delete(id); }
};
