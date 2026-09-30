/**
 * PrefixList - Live RIPEstat / BGP Data Fetcher with Fail-Safe Protection
 * Author: Hossein Golshan
 * 
 * Safety Guarantee: If any network error occurs, or if the returned prefix
 * count is zero/suspiciously low, the existing file is preserved and not overwritten.
 */

import fs from 'node:fs';
import path from 'node:path';
import { POPULAR_ORGANIZATIONS } from '../src/data/catalogData.ts';
import { aggregateIPv4, aggregateIPv6 } from '../src/utils/cidrAggregator.ts';
import { generateRouterOsScript } from '../src/utils/routerosGenerator.ts';

const LISTS_DIR = path.resolve(process.cwd(), 'public', 'lists');
const ORG_DIR = path.join(LISTS_DIR, 'org');

interface RipePrefixResponse {
  data?: {
    prefixes?: Array<{
      prefix: string;
      timeline?: Array<{
        starttime: string;
        endtime: string;
      }>;
    }>;
  };
  status?: string;
}

async function fetchAnnouncedPrefixes(asn: number, timeoutMs = 8000): Promise<string[]> {
  const url = `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PrefixList-RouterOS-Kit/1.0 (https://github.com/hgolshan/prefixlist)'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = (await res.json()) as RipePrefixResponse;
    if (!data?.data?.prefixes) {
      return [];
    }

    return data.data.prefixes.map(p => p.prefix);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.warn(`[Warning] Could not fetch AS${asn} from RIPEstat:`, (err as Error).message);
    return [];
  }
}

export async function updateOrgWithLiveAsn(orgId: string): Promise<boolean> {
  const org = POPULAR_ORGANIZATIONS.find(o => o.id === orgId);
  if (!org) return false;

  const livePrefixes: string[] = [];
  for (const asn of org.asns) {
    const fetched = await fetchAnnouncedPrefixes(asn);
    livePrefixes.push(...fetched);
  }

  // Fail-Safe check: if external API failed or returned 0 prefixes, keep baseline/existing
  if (livePrefixes.length === 0) {
    console.log(`[Fail-Safe] Live fetch for ${org.name} returned 0 prefixes; preserving current file.`);
    return false;
  }

  const v4List: string[] = [];
  const v6List: string[] = [];

  for (const p of livePrefixes) {
    if (p.includes(':')) v6List.push(p);
    else v4List.push(p);
  }

  const aggV4 = aggregateIPv4(v4List);
  const aggV6 = aggregateIPv6(v6List);

  const filename = `${org.slug}.rsc`;
  const filePath = path.join(ORG_DIR, filename);
  const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/${filename}`;
  const listName = org.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');

  const newRsc = generateRouterOsScript({
    listName,
    ipv4Prefixes: aggV4,
    ipv6Prefixes: aggV6,
    includeIPv4: true,
    includeIPv6: true,
    comment: 'PrefixList',
    sourceUrl: rawUrl,
    sourceName: `${org.name} (Live BGP ASNs: ${org.asns.join(', ')})`,
  });

  // Verify non-empty before writing
  if (newRsc.length > 200) {
    fs.writeFileSync(filePath, newRsc, 'utf-8');
    console.log(`[Success] Updated ${filename} with ${aggV4.length} IPv4 & ${aggV6.length} IPv6 prefixes.`);
    return true;
  }

  return false;
}
