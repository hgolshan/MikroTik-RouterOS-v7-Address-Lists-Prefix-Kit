/**
 * PrefixList - Live BGP Sync & RouterOS Address-List Prebuilder
 * Author: Hossein Golshan
 * 
 * Fetches live BGP routing tables from RIPEstat (by ASN) and IPdeny (by Country ISO2),
 * collapses adjacent/nested subnets into minimal CIDRs, and exports:
 * 1. public/lists/org/*.rsc & public/lists/countries/*.rsc
 * 2. public/lists/index.json (master catalog index)
 * 3. src/data/livePrefixes.json (for instant client-side catalog rendering)
 */

import fs from 'node:fs';
import path from 'node:path';
import { BASE_POPULAR_ORGANIZATIONS, BASE_POPULAR_COUNTRIES } from '../src/data/catalogData.ts';
import { aggregateIPv4, aggregateIPv6 } from '../src/utils/cidrAggregator.ts';
import { generateRouterOsScript } from '../src/utils/routerosGenerator.ts';

const REPO_NAME = process.env.GITHUB_REPOSITORY || 'hgolshan/MikroTik-RouterOS-v7-Address-Lists-Prefix-Kit';
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const SRC_DATA_DIR = path.resolve(process.cwd(), 'src/data');
const LISTS_DIR = path.join(PUBLIC_DIR, 'lists');
const ORG_DIR = path.join(LISTS_DIR, 'org');
const COUNTRIES_DIR = path.join(LISTS_DIR, 'countries');
const LIVE_PREFIXES_FILE = path.join(SRC_DATA_DIR, 'livePrefixes.json');

// Ensure output directories exist
fs.mkdirSync(ORG_DIR, { recursive: true });
fs.mkdirSync(COUNTRIES_DIR, { recursive: true });
fs.mkdirSync(SRC_DATA_DIR, { recursive: true });

// Load existing livePrefixes cache if present
let existingLivePrefixes: Record<string, any> = {};
try {
  if (fs.existsSync(LIVE_PREFIXES_FILE)) {
    const raw = fs.readFileSync(LIVE_PREFIXES_FILE, 'utf-8');
    existingLivePrefixes = JSON.parse(raw);
  }
} catch {
  existingLivePrefixes = {};
}

interface IndexEntry {
  id: string;
  name: string;
  slug: string;
  type: 'org' | 'country';
  category?: string;
  asns?: number[];
  iso2?: string;
  flag?: string;
  ipv4Count: number;
  ipv6Count: number;
  totalPrefixes: number;
  filename: string;
  rscUrl: string;
  rawUrl: string;
  lastUpdated: string;
  isLiveSynced: boolean;
}

const indexEntries: IndexEntry[] = [];
const updatedLivePrefixes: Record<string, {
  ipv4Prefixes: string[];
  ipv6Prefixes: string[];
  lastUpdated: string;
  isLive: boolean;
}> = { ...existingLivePrefixes };

const nowIso = new Date().toISOString();

/**
 * Fetch announced BGP prefixes for a specific ASN from RIPEstat
 */
async function fetchAsnAnnouncements(asn: number): Promise<{ ipv4: string[]; ipv6: string[] } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`, {
      headers: { 'User-Agent': 'PrefixList-BGP-Sync/1.0 (RouterOS Automation)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const prefixes: string[] = (json?.data?.prefixes || [])
      .map((p: any) => p?.prefix)
      .filter((p: string) => typeof p === 'string' && p.includes('/'));

    const ipv4 = prefixes.filter((p) => !p.includes(':'));
    const ipv6 = prefixes.filter((p) => p.includes(':'));
    return { ipv4, ipv6 };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Fetch country IP block zones from IPdeny
 */
async function fetchCountryZone(iso2: string): Promise<string[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://www.ipdeny.com/ipblocks/data/aggregated/${iso2.toLowerCase()}-aggregated.zone`, {
      headers: { 'User-Agent': 'PrefixList-Country-Sync/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const text = await res.text();
    const prefixes = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('/'));

    return prefixes.length > 0 ? prefixes : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function main() {
  console.log(`⚡ PrefixList Prebuilder & Live BGP Sync`);
  console.log(`📡 Repository Target: ${REPO_NAME}`);
  console.log(`📅 Timestamp: ${nowIso}\n`);

  // ==========================================
  // 1. Sync & Generate Organizations
  // ==========================================
  console.log(`🔍 [1/2] Processing ${BASE_POPULAR_ORGANIZATIONS.length} Organizations (Querying RIPEstat ASNs)...`);

  for (const org of BASE_POPULAR_ORGANIZATIONS) {
    let collectedV4: string[] = [];
    let collectedV6: string[] = [];
    let liveSyncSuccess = false;

    // Fetch live prefixes across all ASNs for this organization
    try {
      const asnPromises = org.asns.map((asn) => fetchAsnAnnouncements(asn));
      const results = await Promise.allSettled(asnPromises);

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          collectedV4.push(...res.value.ipv4);
          collectedV6.push(...res.value.ipv6);
          liveSyncSuccess = true;
        }
      }
    } catch {
      // Fallback
    }

    // If live fetch was successful and non-empty, use it; otherwise fallback to curated baseline
    const finalV4 = liveSyncSuccess && collectedV4.length > 0 ? collectedV4 : org.ipv4Prefixes;
    const finalV6 = liveSyncSuccess && collectedV6.length > 0 ? collectedV6 : org.ipv6Prefixes;

    // Aggregate subnets to minimize memory footprint in RouterOS
    const aggregatedV4 = aggregateIPv4(finalV4);
    const aggregatedV6 = aggregateIPv6(finalV6);

    const listName = org.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    const filename = `${org.slug}.rsc`;
    const rawUrl = `https://raw.githubusercontent.com/${REPO_NAME}/main/public/lists/org/${filename}`;

    const rscContent = generateRouterOsScript({
      listName: listName,
      ipv4Prefixes: aggregatedV4,
      ipv6Prefixes: aggregatedV6,
      includeIPv4: true,
      includeIPv6: true,
      comment: 'PrefixList',
      sourceUrl: rawUrl,
      sourceName: `${org.name} (ASNs: ${org.asns.join(', ')})`,
    });

    const filePath = path.join(ORG_DIR, filename);
    fs.writeFileSync(filePath, rscContent, 'utf-8');

    // Update in-memory live prefix map
    updatedLivePrefixes[org.id] = {
      ipv4Prefixes: aggregatedV4,
      ipv6Prefixes: aggregatedV6,
      lastUpdated: nowIso,
      isLive: liveSyncSuccess,
    };

    indexEntries.push({
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: 'org',
      category: org.category,
      asns: org.asns,
      ipv4Count: aggregatedV4.length,
      ipv6Count: aggregatedV6.length,
      totalPrefixes: aggregatedV4.length + aggregatedV6.length,
      filename: `org/${filename}`,
      rscUrl: `/lists/org/${filename}`,
      rawUrl,
      lastUpdated: nowIso,
      isLiveSynced: liveSyncSuccess,
    });

    const statusBadge = liveSyncSuccess ? '🟢 Live BGP' : '🟡 Baseline';
    console.log(`  ✓ ${org.name.padEnd(28)} [${statusBadge}] -> ${aggregatedV4.length} v4, ${aggregatedV6.length} v6 CIDRs`);
  }

  // ==========================================
  // 2. Sync & Generate Countries
  // ==========================================
  console.log(`\n🌍 [2/2] Processing ${BASE_POPULAR_COUNTRIES.length} Country Zones (Querying IPdeny)...`);

  for (const country of BASE_POPULAR_COUNTRIES) {
    let liveSyncSuccess = false;
    let liveV4: string[] = [];

    const fetched = await fetchCountryZone(country.code);
    if (fetched && fetched.length > 0) {
      liveV4 = fetched;
      liveSyncSuccess = true;
    }

    const finalV4 = liveSyncSuccess ? liveV4 : country.ipv4Prefixes;
    const finalV6 = country.ipv6Prefixes;

    const aggregatedV4 = aggregateIPv4(finalV4);
    const aggregatedV6 = aggregateIPv6(finalV6);

    const filename = `${country.code.toLowerCase()}.rsc`;
    const rawUrl = `https://raw.githubusercontent.com/${REPO_NAME}/main/public/lists/countries/${filename}`;

    const rscContent = generateRouterOsScript({
      listName: country.code.toUpperCase(),
      ipv4Prefixes: aggregatedV4,
      ipv6Prefixes: aggregatedV6,
      includeIPv4: true,
      includeIPv6: true,
      comment: 'PrefixList',
      sourceUrl: rawUrl,
      sourceName: `${country.name} (${country.code})`,
    });

    const filePath = path.join(COUNTRIES_DIR, filename);
    fs.writeFileSync(filePath, rscContent, 'utf-8');

    updatedLivePrefixes[`country-${country.code.toLowerCase()}`] = {
      ipv4Prefixes: aggregatedV4,
      ipv6Prefixes: aggregatedV6,
      lastUpdated: nowIso,
      isLive: liveSyncSuccess,
    };

    indexEntries.push({
      id: `country-${country.code.toLowerCase()}`,
      name: country.name,
      slug: country.code.toLowerCase(),
      type: 'country',
      iso2: country.code,
      flag: country.flag,
      ipv4Count: aggregatedV4.length,
      ipv6Count: aggregatedV6.length,
      totalPrefixes: aggregatedV4.length + aggregatedV6.length,
      filename: `countries/${filename}`,
      rscUrl: `/lists/countries/${filename}`,
      rawUrl,
      lastUpdated: nowIso,
      isLiveSynced: liveSyncSuccess,
    });

    const statusBadge = liveSyncSuccess ? '🟢 Live Zone' : '🟡 Baseline';
    console.log(`  ✓ ${country.name.padEnd(20)} (${country.code}) [${statusBadge}] -> ${aggregatedV4.length} v4 CIDRs`);
  }

  // ==========================================
  // 3. Write Master Index and Live Catalog
  // ==========================================
  // Save live prefix cache for frontend app
  fs.writeFileSync(LIVE_PREFIXES_FILE, JSON.stringify(updatedLivePrefixes, null, 2), 'utf-8');
  console.log(`\n💾 Saved updated prefixes to ${LIVE_PREFIXES_FILE}`);

  // Save master catalog index
  const indexPath = path.join(LISTS_DIR, 'index.json');
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        repository: `https://github.com/${REPO_NAME}`,
        author: 'Hossein Golshan',
        generatedAt: nowIso,
        totalLists: indexEntries.length,
        lists: indexEntries,
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`📑 Saved master catalog to ${indexPath} (${indexEntries.length} address lists).`);
  console.log(`\n✨ All RouterOS prefix lists and catalog data successfully synced!`);
}

main().catch((err) => {
  console.error('Fatal error in build-prebuilt-lists:', err);
  process.exit(1);
});
