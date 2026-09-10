/* PostgreSQL document repository. MongoDB BSON types are retained only for contract
 * compatibility; every database read/write goes through Drizzle, not MongoDB.
 * Collection-scoped advisory locks make legacy read/modify/write operations atomic.
 */
import { db } from '@/db';
import { coreDocuments } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { BSON, ObjectId, type Collection, type Document } from 'mongodb';
type Doc = Record<string, any>;
function stripUndefined(v: any): any { if (v instanceof Date || v instanceof ObjectId) return v; if (Array.isArray(v)) return v.map(stripUndefined); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, stripUndefined(x)])); return v; }
const encode = (d: Doc) => BSON.EJSON.serialize(stripUndefined(d), { relaxed: false }) as Doc;
const decode = (d: Doc) => BSON.EJSON.deserialize(d) as Doc;
function comparable(v: any): any { return v instanceof ObjectId ? v.toHexString() : v instanceof Date ? v.getTime() : v; }
function match(doc: Doc, filter: Doc): boolean { return Object.entries(filter).every(([k, v]) => { if (k === '$or') return v.some((f: Doc) => match(doc, f)); if (k === '$and') return v.every((f: Doc) => match(doc, f)); const a = comparable(k.split('.').reduce((o, key) => o?.[key], doc)); if (v && typeof v === 'object' && !(v instanceof ObjectId) && !(v instanceof Date)) { return Object.entries(v).every(([op, b]) => { const x = comparable(b); if (op === '$in') return (b as any[]).map(comparable).includes(a); if (op === '$ne') return a !== x; if (op === '$lte') return a <= x; if (op === '$gte') return a >= x; if (op === '$lt') return a < x; if (op === '$gt') return a > x; if (op === '$exists') return (a !== undefined) === b; return JSON.stringify(a) === JSON.stringify(v); }); } return a === comparable(v); }); }
function identity(name: string, d: Doc) { if (name === 'disputes') return d.disputeId; if (name === 'merchants') return d.shopDomain; if (name === 'evidence') return d.disputeId; if (name === 'orders') return `${d.merchantId}:${d.orderId}`; if (d.idempotencyKey) return d.idempotencyKey; return String(d._id); }
function collection<T extends Document>(name: string): Collection<T> {
    const all = async () => (await db.select().from(coreDocuments).where(eq(coreDocuments.collection, name))).map(r => decode(r.data));
    const mutate = async (filter: Doc, update: Doc, options: Doc = {}, insert = false) => db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`shieldpay:${name}`}))`);
        const rows = await tx.select().from(coreDocuments).where(eq(coreDocuments.collection, name));
        const row = insert ? undefined : rows.find(r => match(decode(r.data), filter)); const before = row ? decode(row.data) : null;
        if (!before && !options.upsert && !insert) return null;
        const doc: Doc = before ? { ...before } : { ...filter, _id: new ObjectId(), ...update.$setOnInsert };
        for (const [k, v] of Object.entries(update.$set ?? update)) { if (k.startsWith('$')) continue; if (v === undefined) continue; const keys = k.split('.'); let target = doc; for (const key of keys.slice(0, -1)) target = target[key] ??= ({}); target[keys[keys.length - 1]] = v; }
        for (const k of Object.keys(update.$unset ?? {})) delete doc[k];
        const id = row?.id ?? identity(name, doc);
        if (insert && rows.some(r => r.id === id)) { const error = Object.assign(new Error('Duplicate document'), { code: 11000 }); throw error; }
        await tx.insert(coreDocuments).values({ collection: name, id, data: encode(doc) }).onConflictDoUpdate({ target: [coreDocuments.collection, coreDocuments.id], set: { data: encode(doc) } });
        return options.returnDocument === 'before' ? before : doc;
    });
    return {
        findOne: async (filter: Doc = {}) => (await all()).find(d => match(d, filter)) ?? null,
        find: (filter: Doc = {}) => { let ordering: Doc = {}, max = Infinity; const cursor = { sort: (s: Doc) => { ordering = s; return cursor; }, limit: (n: number) => { max = n; return cursor; }, toArray: async () => { const docs = (await all()).filter(d => match(d, filter)); docs.sort((a, b) => { for (const [k, dir] of Object.entries(ordering)) { const av = comparable(a[k]), bv = comparable(b[k]); if (av !== bv) return (av > bv ? 1 : -1) * Number(dir); } return 0; }); return docs.slice(0, max); } }; return cursor; },
        insertOne: async (doc: Doc) => { const result = await mutate({}, { $set: doc }, { upsert: true }, true); return { acknowledged: true, insertedId: result!._id }; },
        findOneAndUpdate: mutate,
        updateOne: async (f: Doc, u: Doc, o: Doc = {}) => { const result = await mutate(f, u, o); return { acknowledged: true, matchedCount: result ? 1 : 0, modifiedCount: result ? 1 : 0 }; },
        deleteMany: async (filter: Doc = {}) => { let count = 0; for (const row of await db.select().from(coreDocuments).where(eq(coreDocuments.collection, name))) { if (match(decode(row.data), filter)) { await db.delete(coreDocuments).where(and(eq(coreDocuments.collection, name), eq(coreDocuments.id, row.id))); count++; } } return { deletedCount: count }; },
        countDocuments: async (filter: Doc = {}) => (await all()).filter(d => match(d, filter)).length,
        createIndex: async () => `${name}_contract_index`,
    } as unknown as Collection<T>;
}
export async function getDb() { return { collection }; }
export async function closeDb() { }
