/**
 * CIDR Parsing, Validation, and Aggregation Utilities
 * Efficient IPv4 and IPv6 overlap collapsing for MikroTik RouterOS address-lists.
 */

export interface AggregationResult {
  ipv4: string[];
  ipv6: string[];
  originalCount: number;
  aggregatedCount: number;
  savingsCount: number;
}

// Convert IPv4 string to 32-bit unsigned number
function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Convert 32-bit unsigned number to IPv4 string
function longToIpv4(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

/**
 * Collapse and aggregate an array of IPv4 CIDR blocks
 */
export function aggregateIPv4(cidrs: string[]): string[] {
  if (!cidrs || cidrs.length === 0) return [];

  // Parse valid CIDRs into [start, end] ranges
  interface Range {
    start: number;
    end: number;
  }

  const ranges: Range[] = [];

  for (const cidr of cidrs) {
    const trimmed = cidr.trim();
    if (!trimmed) continue;

    let ip = trimmed;
    let mask = 32;

    if (trimmed.includes('/')) {
      const [ipPart, maskPart] = trimmed.split('/');
      ip = ipPart;
      mask = parseInt(maskPart, 10);
      if (isNaN(mask) || mask < 0 || mask > 32) mask = 32;
    }

    const ipNum = ipv4ToLong(ip);
    const hostMask = mask === 0 ? 0xffffffff : ((1 << (32 - mask)) - 1) >>> 0;
    const netMask = ~hostMask >>> 0;
    const start = (ipNum & netMask) >>> 0;
    const end = (start | hostMask) >>> 0;

    ranges.push({ start, end });
  }

  if (ranges.length === 0) return [];

  // Sort ranges by start address, then by end desc
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  // Merge overlapping and adjacent ranges
  const merged: Range[] = [];
  let current = ranges[0];

  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i];
    // Check if overlapping or directly adjacent
    if (next.start <= current.end + 1) {
      current.end = Math.max(current.end, next.end) >>> 0;
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  // Convert merged ranges back into minimal CIDR blocks
  const result: string[] = [];

  for (const range of merged) {
    let start = range.start;
    const end = range.end;

    while (start <= end) {
      // Find max power-of-2 size that divides start and fits in (end - start + 1)
      let maxMask = 32;
      while (maxMask > 0) {
        const step = (1 << (32 - (maxMask - 1))) >>> 0;
        if (start % step === 0 && start + step - 1 <= end && start + step - 1 >= start) {
          maxMask--;
        } else {
          break;
        }
      }

      result.push(`${longToIpv4(start)}/${maxMask}`);
      const step = (1 << (32 - maxMask)) >>> 0;
      if (start + step < start) break; // Overflow protection
      start = (start + step) >>> 0;
    }
  }

  return result;
}

/**
 * Basic IPv6 prefix overlap collapsing (hierarchical containment)
 */
export function aggregateIPv6(cidrs: string[]): string[] {
  if (!cidrs || cidrs.length === 0) return [];

  // Deduplicate and normalize
  const cleanList = Array.from(new Set(cidrs.map(c => c.trim().toLowerCase()).filter(Boolean)));

  // Simple containment check: if a broader /32 is present, drop /36 or /48 starting with same prefix
  const sorted = cleanList.sort((a, b) => {
    const maskA = parseInt(a.split('/')[1] || '128', 10);
    const maskB = parseInt(b.split('/')[1] || '128', 10);
    return maskA - maskB; // Shorter prefixes first
  });

  const kept: string[] = [];
  for (const cidr of sorted) {
    // If not contained by an already kept shorter prefix
    let contained = false;
    const [ip, maskStr] = cidr.split('/');
    const mask = parseInt(maskStr || '128', 10);

    for (const parent of kept) {
      const [parentIp, parentMaskStr] = parent.split('/');
      const parentMask = parseInt(parentMaskStr || '128', 10);

      if (parentMask <= mask) {
        // Quick prefix check based on hex characters
        const pNorm = parentIp.replace(/::.*$/, '').replace(/:/g, '');
        const cNorm = ip.replace(/::.*$/, '').replace(/:/g, '');
        if (pNorm && cNorm.startsWith(pNorm)) {
          contained = true;
          break;
        }
      }
    }

    if (!contained) {
      kept.push(cidr);
    }
  }

  return kept;
}

/**
 * Full aggregation helper
 */
export function aggregatePrefixes(prefixes: string[]): AggregationResult {
  const originalCount = prefixes.length;
  const ipv4List: string[] = [];
  const ipv6List: string[] = [];

  for (const prefix of prefixes) {
    const trimmed = prefix.trim();
    if (!trimmed) continue;
    if (trimmed.includes(':')) {
      ipv6List.push(trimmed);
    } else {
      ipv4List.push(trimmed);
    }
  }

  const aggregatedV4 = aggregateIPv4(ipv4List);
  const aggregatedV6 = aggregateIPv6(ipv6List);
  const aggregatedCount = aggregatedV4.length + aggregatedV6.length;

  return {
    ipv4: aggregatedV4,
    ipv6: aggregatedV6,
    originalCount,
    aggregatedCount,
    savingsCount: Math.max(0, originalCount - aggregatedCount)
  };
}
