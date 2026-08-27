import { readFile, writeFile } from 'node:fs/promises';
import seedSchemes from './schemes.json' with { type: 'json' };
import stateDirectories from './state-schemes.json' with { type: 'json' };

const remoteFile = new URL('./remote-schemes.json', import.meta.url);
const sixHours = 6 * 60 * 60 * 1000;

const clean = (value) => String(value || '').trim();
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function readRemote() {
  try { return JSON.parse(await readFile(remoteFile, 'utf8')); }
  catch { return { updatedAt: null, sources: [], schemes: [] }; }
}

function normalize(item, source) {
  const title = clean(item.title || item.name || item.scheme_name);
  if (!title) return null;
  return {
    id: slug(item.id || `${source.name}-${title}`),
    title,
    type: clean(item.type || item.category || 'Welfare scheme'),
    providerType: clean(item.providerType || item.provider_type || source.providerType || 'Government'),
    level: clean(item.level || item.state || source.level || 'Central'),
    department: clean(item.department || item.ministry || item.organisation || source.name),
    benefit: clean(item.benefit || item.description || 'See the official source for the current benefit details.'),
    eligibilitySummary: clean(item.eligibilitySummary || item.eligibility || 'Review the current official eligibility notice.'),
    attachments: Array.isArray(item.attachments) ? item.attachments : ['Identity proof', 'Eligibility proof'],
    rules: item.rules && typeof item.rules === 'object' ? item.rules : {},
    sourceUrl: clean(item.sourceUrl || item.url || source.url),
    syncedAt: new Date().toISOString()
  };
}

export async function getCatalog() {
  const remote = await readRemote();
  const byId = new Map([...seedSchemes, ...stateDirectories].map((scheme) => [scheme.id, scheme]));
  for (const scheme of remote.schemes || []) byId.set(scheme.id, scheme);
  return [...byId.values()];
}

export async function catalogStatus() {
  const remote = await readRemote();
  return { updatedAt: remote.updatedAt, sourceCount: remote.sources?.length || 0, importedCount: remote.schemes?.length || 0, seedCount: seedSchemes.length + stateDirectories.length };
}

export async function syncCatalog() {
  let feeds;
  try { feeds = JSON.parse(process.env.SCHEME_FEEDS || '[]'); }
  catch { return { skipped: true, reason: 'SCHEME_FEEDS is not valid JSON; syncing is disabled.' }; }
  if (!Array.isArray(feeds) || feeds.length === 0) return { skipped: true, reason: 'No official feeds configured.' };

  const imported = [];
  const sources = [];
  for (const source of feeds) {
    if (!source?.url || !/^https:\/\//.test(source.url)) continue;
    const response = await fetch(source.url, { headers: source.headers || {} });
    if (!response.ok) throw new Error(`${source.name || source.url} returned ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.schemes || payload.records || payload.data || [];
    if (!Array.isArray(items)) continue;
    imported.push(...items.map((item) => normalize(item, source)).filter(Boolean));
    sources.push({ name: source.name || source.url, url: source.url, imported: items.length });
  }
  const unique = [...new Map(imported.map((scheme) => [scheme.id, scheme])).values()];
  await writeFile(remoteFile, JSON.stringify({ updatedAt: new Date().toISOString(), sources, schemes: unique }, null, 2));
  return { skipped: false, sources, imported: unique.length };
}

export function startCatalogSync() {
  if (process.env.AUTO_SYNC_SCHEMES !== 'true') return;
  syncCatalog().catch((error) => console.error('Initial catalog sync failed:', error.message));
  setInterval(() => syncCatalog().catch((error) => console.error('Catalog sync failed:', error.message)), sixHours).unref();
}
