import React, { useState, useMemo } from 'react';
import { Search, Download, Copy, Check, Eye, Terminal, Globe, Cloud, Server, Shield, Radio, Sparkles } from 'lucide-react';
import { POPULAR_ORGANIZATIONS, POPULAR_COUNTRIES, OrgItem, CountryItem } from '../data/catalogData.ts';
import { generateRouterOsScript } from '../utils/routerosGenerator.ts';

interface CatalogViewProps {
  onInspectList: (list: {
    title: string;
    filename: string;
    rscContent: string;
    rawUrl: string;
    prefixStats: { ipv4: number; ipv6: number; total: number };
  }) => void;
  onOpenInBuilder: (orgOrCountry: OrgItem | CountryItem, type: 'org' | 'country') => void;
}

type CategoryFilter = 'all' | 'countries' | 'cloud' | 'social' | 'streaming' | 'hosting';

export const CatalogView: React.FC<CatalogViewProps> = ({ onInspectList, onOpenInBuilder }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy RouterOS one-line import snippet
  const handleCopyTerminal = async (id: string, rawUrl: string, filename: string) => {
    const cmd = `/tool fetch url="${rawUrl}" dst-path="${filename}"\n/import ${filename}\n/file remove [find name="${filename}"]`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadRsc = (item: OrgItem | CountryItem, type: 'org' | 'country') => {
    let rsc = '';
    let filename = '';
    if (type === 'org') {
      const org = item as OrgItem;
      filename = `${org.slug}.rsc`;
      const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/${filename}`;
      rsc = generateRouterOsScript({
        listName: org.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''),
        ipv4Prefixes: org.ipv4Prefixes,
        ipv6Prefixes: org.ipv6Prefixes,
        sourceUrl: rawUrl,
        sourceName: org.name,
      });
    } else {
      const country = item as CountryItem;
      filename = `${country.code.toLowerCase()}.rsc`;
      const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/countries/${filename}`;
      rsc = generateRouterOsScript({
        listName: country.code.toUpperCase(),
        ipv4Prefixes: country.ipv4Prefixes,
        ipv6Prefixes: country.ipv6Prefixes,
        sourceUrl: rawUrl,
        sourceName: `${country.name} (${country.code})`,
      });
    }

    const blob = new Blob([rsc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInspect = (item: OrgItem | CountryItem, type: 'org' | 'country') => {
    if (type === 'org') {
      const org = item as OrgItem;
      const filename = `${org.slug}.rsc`;
      const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/${filename}`;
      const rsc = generateRouterOsScript({
        listName: org.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, ''),
        ipv4Prefixes: org.ipv4Prefixes,
        ipv6Prefixes: org.ipv6Prefixes,
        sourceUrl: rawUrl,
        sourceName: `${org.name} (ASNs: ${org.asns.join(', ')})`,
      });
      onInspectList({
        title: org.name,
        filename,
        rscContent: rsc,
        rawUrl,
        prefixStats: {
          ipv4: org.ipv4Prefixes.length,
          ipv6: org.ipv6Prefixes.length,
          total: org.ipv4Prefixes.length + org.ipv6Prefixes.length,
        },
      });
    } else {
      const country = item as CountryItem;
      const filename = `${country.code.toLowerCase()}.rsc`;
      const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/countries/${filename}`;
      const rsc = generateRouterOsScript({
        listName: country.code.toUpperCase(),
        ipv4Prefixes: country.ipv4Prefixes,
        ipv6Prefixes: country.ipv6Prefixes,
        sourceUrl: rawUrl,
        sourceName: `${country.name} (${country.code})`,
      });
      onInspectList({
        title: `${country.name} (${country.code})`,
        filename,
        rscContent: rsc,
        rawUrl,
        prefixStats: {
          ipv4: country.ipv4Prefixes.length,
          ipv6: country.ipv6Prefixes.length,
          total: country.ipv4Prefixes.length + country.ipv6Prefixes.length,
        },
      });
    }
  };

  // Filtered items
  const filteredOrgs = useMemo(() => {
    if (activeCategory === 'countries') return [];
    return POPULAR_ORGANIZATIONS.filter((org) => {
      const matchesSearch =
        !searchQuery ||
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.asns.some((a) => a.toString().includes(searchQuery.replace(/as/i, ''))) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        activeCategory === 'all' ||
        (activeCategory === 'cloud' && org.category === 'cloud') ||
        (activeCategory === 'social' && (org.category === 'social' || org.category === 'tech')) ||
        (activeCategory === 'streaming' && (org.category === 'streaming' || org.category === 'gaming')) ||
        (activeCategory === 'hosting' && org.category === 'hosting');

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const filteredCountries = useMemo(() => {
    if (activeCategory !== 'all' && activeCategory !== 'countries') return [];
    return POPULAR_COUNTRIES.filter((country) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        country.name.toLowerCase().includes(q) ||
        country.code.toLowerCase().includes(q) ||
        country.iso3.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, activeCategory]);

  const totalResults = filteredOrgs.length + filteredCountries.length;

  return (
    <div className="space-y-8">
      {/* Hero / Value Section */}
      <div className="relative rounded-2xl border border-slate-800 bg-gradient-to-b from-[#101726] to-[#0a0e17] p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2">
            <span>Hossein Golshan</span>
            <span aria-hidden="true">·</span>
            <span>MikroTik RouterOS v7 & v6</span>
            <span aria-hidden="true">·</span>
            <span>Automated Weekly Sync</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
            MikroTik RouterOS v7 Address Lists & Prefix Kit
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
            A high-performance, public MikroTik RouterOS v7 prefix kit and web builder. Automatically generate and maintain optimized, idempotent firewall address lists, ASN blocks, and country zones for weekly automated updates.
          </p>
        </div>

        {/* Metric Summary Bar (Zero-Pill discipline) */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-slate-400">Curated Organizations</div>
            <div className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
              {POPULAR_ORGANIZATIONS.length} Networks
            </div>
          </div>
          <div>
            <div className="text-slate-400">ISO Country Lists</div>
            <div className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
              {POPULAR_COUNTRIES.length} Nations
            </div>
          </div>
          <div>
            <div className="text-slate-400">Update Cadence</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
              Weekly Sundays
            </div>
          </div>
          <div>
            <div className="text-slate-400">BGP Aggregation</div>
            <div className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-0.5">
              Auto Collapsed
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ASN (e.g. 15169), or ISO code..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-900/90 border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Interactive Segmented Filter Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-lg overflow-x-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Lists ({POPULAR_ORGANIZATIONS.length + POPULAR_COUNTRIES.length})
          </button>
          <button
            onClick={() => setActiveCategory('cloud')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'cloud'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cloud & CDN
          </button>
          <button
            onClick={() => setActiveCategory('social')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'social'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tech & Social
          </button>
          <button
            onClick={() => setActiveCategory('hosting')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'hosting'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hosting & Compute
          </button>
          <button
            onClick={() => setActiveCategory('streaming')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'streaming'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Streaming & Gaming
          </button>
          <button
            onClick={() => setActiveCategory('countries')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeCategory === 'countries'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Countries ({POPULAR_COUNTRIES.length})
          </button>
        </div>
      </div>

      {/* Grid of Ready-Made Lists */}
      {totalResults === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Globe className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No address lists found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or clear filters to view all prebuilt organizations and countries.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="mt-4 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 rounded-md hover:bg-cyan-900/40"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Organizations */}
          {filteredOrgs.map((org) => {
            const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/${org.slug}.rsc`;
            const isCopied = copiedId === org.id;

            return (
              <div
                key={org.id}
                className="group relative rounded-xl border border-slate-800/90 bg-[#0d131f] hover:border-slate-700 p-5 flex flex-col justify-between transition-all duration-150"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/80 text-cyan-400">
                        {org.category === 'cloud' && <Cloud className="h-4 w-4" />}
                        {org.category === 'hosting' && <Server className="h-4 w-4" />}
                        {org.category === 'social' && <Radio className="h-4 w-4" />}
                        {org.category === 'streaming' && <Sparkles className="h-4 w-4" />}
                        {org.category === 'gaming' && <Shield className="h-4 w-4" />}
                        {org.category === 'tech' && <Globe className="h-4 w-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                          {org.name}
                        </h3>
                        <div className="text-xs text-slate-500 font-mono">
                          {org.asns.map((a) => `AS${a}`).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {org.description}
                  </p>

                  {/* Clean unboxed metadata with dot separators */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 tabular-nums">{org.ipv4Prefixes.length}</span>
                      <span>IPv4</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-300 tabular-nums">{org.ipv6Prefixes.length}</span>
                      <span>IPv6</span>
                    </div>
                    <span className="text-slate-400">
                      ~{((org.ipv4Prefixes.length + org.ipv6Prefixes.length) * 0.08).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleCopyTerminal(org.id, rawUrl, `${org.slug}.rsc`)}
                    title="Copy /tool fetch command for RouterOS"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Fetch</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleInspect(org, 'org')}
                    title="Inspect RouterOS script content"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => handleDownloadRsc(org, 'org')}
                    title="Download .rsc file directly"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>.rsc</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Countries */}
          {filteredCountries.map((country) => {
            const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/countries/${country.code.toLowerCase()}.rsc`;
            const isCopied = copiedId === `country-${country.code}`;

            return (
              <div
                key={country.code}
                className="group relative rounded-xl border border-slate-800/90 bg-[#0d131f] hover:border-slate-700 p-5 flex flex-col justify-between transition-all duration-150"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/80 text-xl">
                        {country.flag}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                          {country.name}
                        </h3>
                        <div className="text-xs text-slate-500 font-mono">
                          ISO: {country.code} · {country.iso3} · {country.continent}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    National IP blocks and regional delegated prefixes for {country.name}.
                  </p>

                  {/* Clean unboxed metadata */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 tabular-nums">{country.ipv4Prefixes.length}</span>
                      <span>IPv4</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-300 tabular-nums">{country.ipv6Prefixes.length}</span>
                      <span>IPv6</span>
                    </div>
                    <span className="text-slate-400">
                      ~{((country.ipv4Prefixes.length + country.ipv6Prefixes.length) * 0.08).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2">
                  <button
                    onClick={() =>
                      handleCopyTerminal(
                        `country-${country.code}`,
                        rawUrl,
                        `${country.code.toLowerCase()}.rsc`
                      )
                    }
                    title="Copy /tool fetch command for RouterOS"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Fetch</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleInspect(country, 'country')}
                    title="Inspect RouterOS script content"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => handleDownloadRsc(country, 'country')}
                    title="Download .rsc file directly"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>.rsc</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
