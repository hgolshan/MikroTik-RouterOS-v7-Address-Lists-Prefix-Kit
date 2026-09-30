/**
 * PrefixList - Static Site & Address-List Prebuilder
 * Author: Hossein Golshan
 * Generates ready-to-use RouterOS .rsc files into public/lists/
 */

import fs from 'node:fs';
import path from 'node:path';
import { POPULAR_ORGANIZATIONS, POPULAR_COUNTRIES } from '../src/data/catalogData.ts';
import { aggregateIPv4, aggregateIPv6 } from '../src/utils/cidrAggregator.ts';
import { generateRouterOsScript } from '../src/utils/routerosGenerator.ts';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const LISTS_DIR = path.join(PUBLIC_DIR, 'lists');
const ORG_DIR = path.join(LISTS_DIR, 'org');
const COUNTRIES_DIR = path.join(LISTS_DIR, 'countries');

// Ensure directories exist
fs.mkdirSync(ORG_DIR, { recursive: true });
fs.mkdirSync(COUNTRIES_DIR, { recursive: true });

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
}

const indexEntries: IndexEntry[] = [];
const nowIso = new Date().toISOString();

console.log('⚡ Generating Prebuilt Organization Address Lists...');
for (const org of POPULAR_ORGANIZATIONS) {
  const aggregatedV4 = aggregateIPv4(org.ipv4Prefixes);
  const aggregatedV6 = aggregateIPv6(org.ipv6Prefixes);
  const listName = org.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
  const filename = `${org.slug}.rsc`;
  const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/${filename}`;

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
    lastUpdated: nowIso
  });
}

console.log(`✅ Generated ${POPULAR_ORGANIZATIONS.length} organization address lists.`);

console.log('⚡ Generating Prebuilt Country Address Lists...');
for (const country of POPULAR_COUNTRIES) {
  const aggregatedV4 = aggregateIPv4(country.ipv4Prefixes);
  const aggregatedV6 = aggregateIPv6(country.ipv6Prefixes);
  const filename = `${country.code.toLowerCase()}.rsc`;
  const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/countries/${filename}`;

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
    lastUpdated: nowIso
  });
}

console.log(`✅ Generated ${POPULAR_COUNTRIES.length} country address lists.`);

// Write master catalog index.json
const indexPath = path.join(LISTS_DIR, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify({
  repository: 'https://github.com/hgolshan/prefixlist',
  author: 'Hossein Golshan',
  generatedAt: nowIso,
  totalLists: indexEntries.length,
  lists: indexEntries
}, null, 2), 'utf-8');

console.log(`✅ Wrote master catalog index.json (${indexEntries.length} items). All done!`);
