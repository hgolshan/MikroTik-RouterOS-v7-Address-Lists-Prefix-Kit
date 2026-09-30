import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings2,
  Copy,
  Check,
  Download,
  Terminal,
  Plus,
  X,
  Search,
  RefreshCw,
  GitBranch,
  ShieldAlert,
  ArrowRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { POPULAR_ORGANIZATIONS, POPULAR_COUNTRIES, OrgItem, CountryItem } from '../data/catalogData.ts';
import { aggregatePrefixes } from '../utils/cidrAggregator.ts';
import { generateRouterOsScript } from '../utils/routerosGenerator.ts';

export const CustomBuilder: React.FC = () => {
  // Core Configuration
  const [listName, setListName] = useState('CUSTOM_LIST');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>(['cloudflare']);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [manualAsnInput, setManualAsnInput] = useState('');
  const [ipProtocol, setIpProtocol] = useState<'both' | 'ipv4' | 'ipv6'>('both');
  const [collapseOverlaps, setCollapseOverlaps] = useState(true);

  // Search filters for selectors
  const [orgSearch, setOrgSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  // Live ASN Lookup State
  const [isFetchingAsn, setIsFetchingAsn] = useState(false);
  const [asnFetchStatus, setAsnFetchStatus] = useState<string | null>(null);
  const [dynamicAsnPrefixes, setDynamicAsnPrefixes] = useState<string[]>([]);

  // Optional Extras (Off by default)
  const [enablePolicyRouting, setEnablePolicyRouting] = useState(false);
  const [policyTableName, setPolicyTableName] = useState('to_vpn');
  const [policyGateway, setPolicyGateway] = useState('wireguard1');
  const [policyLanInterface, setPolicyLanInterface] = useState('LAN');
  const [bypassFastTrack, setBypassFastTrack] = useState(true);

  const [enableAutoUpdater, setEnableAutoUpdater] = useState(false);
  const [updaterInterval, setUpdaterInterval] = useState('7d');
  const [updaterStartTime, setUpdaterStartTime] = useState('03:30:00');

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Combine all raw prefixes
  const rawPrefixes = useMemo(() => {
    const list: string[] = [];

    // 1. Curated Organizations
    for (const orgId of selectedOrgs) {
      const org = POPULAR_ORGANIZATIONS.find((o) => o.id === orgId);
      if (org) {
        list.push(...org.ipv4Prefixes);
        list.push(...org.ipv6Prefixes);
      }
    }

    // 2. Selected Countries
    for (const code of selectedCountries) {
      const country = POPULAR_COUNTRIES.find((c) => c.code === code);
      if (country) {
        list.push(...country.ipv4Prefixes);
        list.push(...country.ipv6Prefixes);
      }
    }

    // 3. Dynamic ASN lookup prefixes
    list.push(...dynamicAsnPrefixes);

    return list;
  }, [selectedOrgs, selectedCountries, dynamicAsnPrefixes]);

  // Aggregate or deduplicate prefixes
  const aggregation = useMemo(() => {
    if (collapseOverlaps) {
      return aggregatePrefixes(rawPrefixes);
    } else {
      // Just deduplicate
      const v4: string[] = [];
      const v6: string[] = [];
      for (const p of Array.from(new Set(rawPrefixes))) {
        if (p.includes(':')) v6.push(p);
        else v4.push(p);
      }
      return {
        ipv4: v4,
        ipv6: v6,
        originalCount: rawPrefixes.length,
        aggregatedCount: v4.length + v6.length,
        savingsCount: 0,
      };
    }
  }, [rawPrefixes, collapseOverlaps]);

  // Generate RouterOS Script Content
  const generatedScript = useMemo(() => {
    const rawUrl = `https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/custom/${listName.toLowerCase()}.rsc`;

    return generateRouterOsScript({
      listName,
      ipv4Prefixes: aggregation.ipv4,
      ipv6Prefixes: aggregation.ipv6,
      includeIPv4: ipProtocol === 'both' || ipProtocol === 'ipv4',
      includeIPv6: ipProtocol === 'both' || ipProtocol === 'ipv6',
      sourceUrl: rawUrl,
      sourceName: `Custom Builder (${selectedOrgs.length} Orgs, ${selectedCountries.length} Countries)`,
      includePolicyRouting: enablePolicyRouting,
      policyRouting: {
        tableName: policyTableName,
        gateway: policyGateway,
        lanInterfaceList: policyLanInterface,
        routingMark: policyTableName,
        bypassFastTrack,
      },
      includeAutoUpdater: enableAutoUpdater,
      autoUpdater: {
        scriptName: `update-prefixlist-${listName}`,
        scheduleInterval: updaterInterval,
        startTime: updaterStartTime,
        rawUrl,
      },
    });
  }, [
    listName,
    aggregation,
    ipProtocol,
    enablePolicyRouting,
    policyTableName,
    policyGateway,
    policyLanInterface,
    bypassFastTrack,
    enableAutoUpdater,
    updaterInterval,
    updaterStartTime,
  ]);

  // Live ASN Lookup Handler
  const handleFetchAsn = async () => {
    const cleaned = manualAsnInput
      .split(/[\s,]+/)
      .map((s) => s.replace(/[^0-9]/g, ''))
      .filter(Boolean);

    if (cleaned.length === 0) {
      setAsnFetchStatus('Please enter at least one valid ASN number (e.g. 15169).');
      return;
    }

    setIsFetchingAsn(true);
    setAsnFetchStatus(`Querying BGP announcements for AS${cleaned.join(', AS')}...`);

    const newPrefixes: string[] = [];
    let successCount = 0;

    for (const asn of cleaned) {
      // First check local catalog for instant response
      const matchedOrg = POPULAR_ORGANIZATIONS.find((o) => o.asns.includes(parseInt(asn, 10)));
      if (matchedOrg) {
        newPrefixes.push(...matchedOrg.ipv4Prefixes, ...matchedOrg.ipv6Prefixes);
        successCount++;
        continue;
      }

      // Try RIPEstat API
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(
          `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const prefixes = (data?.data?.prefixes || []).map((p: { prefix: string }) => p.prefix);
          if (prefixes.length > 0) {
            newPrefixes.push(...prefixes);
            successCount++;
          }
        }
      } catch {
        // Fallback / network error
      }
    }

    setIsFetchingAsn(false);
    if (newPrefixes.length > 0) {
      setDynamicAsnPrefixes((prev) => Array.from(new Set([...prev, ...newPrefixes])));
      setAsnFetchStatus(`Added ${newPrefixes.length} prefixes from ${successCount} ASN(s).`);
      setManualAsnInput('');
    } else {
      setAsnFetchStatus('Could not find announced prefixes for the provided ASN(s).');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const filename = `${listName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'prefixlist'}.rsc`;
    const blob = new Blob([generatedScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = generatedScript.split('\n');

  // Filtered lists for selector cards
  const selectableOrgs = useMemo(() => {
    if (!orgSearch) return POPULAR_ORGANIZATIONS;
    const q = orgSearch.toLowerCase();
    return POPULAR_ORGANIZATIONS.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.asns.some((a) => a.toString().includes(q)) ||
        o.slug.includes(q)
    );
  }, [orgSearch]);

  const selectableCountries = useMemo(() => {
    if (!countrySearch) return POPULAR_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return POPULAR_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.continent.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>Dynamic Engine</span>
              <span aria-hidden="true">·</span>
              <span>Zero-Roundtrip Client-Side Generation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Custom Address List Builder
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Combine multiple BGP ASNs, organizations, and country blocks into an optimized, collapsed RouterOS address-list script.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedOrgs([]);
                setSelectedCountries([]);
                setDynamicAsnPrefixes([]);
                setListName('CUSTOM_LIST');
              }}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700/80 rounded-md hover:bg-slate-800 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Controls & Selectors (7 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* General Parameters */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              General Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  RouterOS Address-List Name
                </label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value.toUpperCase().replace(/[^A-Z0-9_\-\.]/g, '_'))}
                  placeholder="e.g. TO_VPN_SERVICES"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Protocol Version
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs">
                  <button
                    onClick={() => setIpProtocol('both')}
                    className={`py-1 rounded text-center font-medium transition-colors ${
                      ipProtocol === 'both' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dual-Stack
                  </button>
                  <button
                    onClick={() => setIpProtocol('ipv4')}
                    className={`py-1 rounded text-center font-medium transition-colors ${
                      ipProtocol === 'ipv4' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    IPv4 Only
                  </button>
                  <button
                    onClick={() => setIpProtocol('ipv6')}
                    className={`py-1 rounded text-center font-medium transition-colors ${
                      ipProtocol === 'ipv6' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    IPv6 Only
                  </button>
                </div>
              </div>
            </div>

            {/* Overlap Collapsing Toggle */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-white flex items-center gap-1.5">
                  <span>Collapse Overlapping CIDRs</span>
                  <span className="font-mono text-cyan-400 text-xs">
                    (Recommended)
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Deduplicates subnets and merges adjacent prefixes into optimal blocks
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCollapseOverlaps(!collapseOverlaps)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  collapseOverlaps ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={collapseOverlaps}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    collapseOverlaps ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ASN Manual Discovery & Input */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              Manual ASN Discovery (RIPEstat BGP Query)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter ASNs separated by comma or space (e.g. <code className="font-mono text-cyan-300">AS15169</code>, <code className="font-mono text-cyan-300">13335</code>, <code className="font-mono text-cyan-300">16509</code>) to fetch live announced prefixes.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualAsnInput}
                onChange={(e) => setManualAsnInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchAsn()}
                placeholder="e.g. 15169, 13335, 16509"
                className="flex-1 px-3 py-1.5 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleFetchAsn}
                disabled={isFetchingAsn}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                {isFetchingAsn ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Lookup ASN</span>
              </button>
            </div>

            {asnFetchStatus && (
              <div className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 p-2 rounded">
                {asnFetchStatus}
              </div>
            )}

            {dynamicAsnPrefixes.length > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>{dynamicAsnPrefixes.length} custom ASN prefixes added</span>
                <button
                  onClick={() => setDynamicAsnPrefixes([])}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Remove custom ASN prefixes
                </button>
              </div>
            )}
          </div>

          {/* Organization Multi-Select */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Select Popular Organizations ({selectedOrgs.length} active)
              </h2>
              <div className="text-xs text-slate-500 font-mono">
                {POPULAR_ORGANIZATIONS.length} available
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="Search organizations or ASNs..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {selectableOrgs.map((org) => {
                const isSelected = selectedOrgs.includes(org.id);
                return (
                  <button
                    key={org.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedOrgs(selectedOrgs.filter((id) => id !== org.id));
                      } else {
                        setSelectedOrgs([...selectedOrgs, org.id]);
                      }
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors border ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-800/80 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="font-medium truncate text-white">{org.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] shrink-0">
                      <span>{org.asns.map((a) => `AS${a}`).join(', ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {org.ipv4Prefixes.length + org.ipv6Prefixes.length} pfx
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Country Multi-Select */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Select ISO Countries ({selectedCountries.length} active)
              </h2>
              <div className="text-xs text-slate-500 font-mono">
                {POPULAR_COUNTRIES.length} available
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search countries or ISO codes..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1.5 pr-1">
              {selectableCountries.map((country) => {
                const isSelected = selectedCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCountries(selectedCountries.filter((c) => c !== country.code));
                      } else {
                        setSelectedCountries([...selectedCountries, country.code]);
                      }
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors border ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-800/80 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-base">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {country.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Extras Accordion (Off by Default) */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-cyan-400" />
                Optional RouterOS Extras (Off by Default)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inject production-ready policy-based routing (v7) and auto-update cron scripts directly into the generated file.
              </p>
            </div>

            {/* Extra 1: Policy Routing Toggle */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Policy-Based Routing (PBR - RouterOS v7)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Creates FIB routing table, default route, and firewall mangle marks
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnablePolicyRouting(!enablePolicyRouting)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enablePolicyRouting ? 'bg-cyan-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enablePolicyRouting ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {enablePolicyRouting && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Routing Table
                      </label>
                      <input
                        type="text"
                        value={policyTableName}
                        onChange={(e) => setPolicyTableName(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Gateway / Interface
                      </label>
                      <input
                        type="text"
                        value={policyGateway}
                        onChange={(e) => setPolicyGateway(e.target.value)}
                        placeholder="wireguard1 or 192.168.1.1"
                        className="w-full px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        LAN Interface List
                      </label>
                      <input
                        type="text"
                        value={policyLanInterface}
                        onChange={(e) => setPolicyLanInterface(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="ftCheck"
                      checked={bypassFastTrack}
                      onChange={(e) => setBypassFastTrack(e.target.checked)}
                      className="rounded border-slate-700 text-cyan-600 focus:ring-0"
                    />
                    <label htmlFor="ftCheck" className="text-xs text-slate-300">
                      Include FastTrack exclusion filter rule (Essential for RouterOS v7)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Extra 2: Auto-Updater Toggle */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Safe Weekly Auto-Updater Script & Scheduler
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Downloads to temporary file, tests integrity, never wipes existing list on error
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableAutoUpdater(!enableAutoUpdater)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enableAutoUpdater ? 'bg-cyan-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enableAutoUpdater ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {enableAutoUpdater && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Interval
                      </label>
                      <input
                        type="text"
                        value={updaterInterval}
                        onChange={(e) => setUpdaterInterval(e.target.value)}
                        placeholder="7d"
                        className="w-full px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Start Time
                      </label>
                      <input
                        type="text"
                        value={updaterStartTime}
                        onChange={(e) => setUpdaterStartTime(e.target.value)}
                        placeholder="03:30:00"
                        className="w-full px-2.5 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live RouterOS .rsc Viewer (5 cols) */}
        <div className="lg:col-span-6 sticky top-20">
          <div className="rounded-xl border border-slate-800/90 bg-[#070a10] shadow-2xl flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-[#0a0e17]">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                  <span>RouterOS Script Output</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {listName}.rsc · {lines.length} lines
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .rsc</span>
                </button>
              </div>
            </div>

            {/* Metrics Bar (Zero-Pill discipline) */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-950/70 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-cyan-300 tabular-nums font-semibold">
                  {ipProtocol !== 'ipv6' ? aggregation.ipv4.length : 0} IPv4
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-300 tabular-nums font-semibold">
                  {ipProtocol !== 'ipv4' ? aggregation.ipv6.length : 0} IPv6
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300 tabular-nums font-semibold">
                  {(ipProtocol !== 'ipv6' ? aggregation.ipv4.length : 0) +
                    (ipProtocol !== 'ipv4' ? aggregation.ipv6.length : 0)}{' '}
                  Total
                </span>
              </div>

              {collapseOverlaps && aggregation.savingsCount > 0 && (
                <div className="text-emerald-400 text-[11px]">
                  Collapsed {aggregation.savingsCount} subnets
                </div>
              )}
            </div>

            {/* Code Body */}
            <div className="overflow-auto max-h-[580px] p-4 text-xs font-mono leading-relaxed select-text">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 min-w-full">
                <div className="select-none text-right text-slate-600 pr-2 border-r border-slate-800/80 font-mono tabular-nums">
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  {lines.map((line, i) => {
                    const isComment = line.trim().startsWith('#');
                    const isHeader = line.includes('PrefixList - MikroTik') || line.includes('Address List:');
                    const isCmd = line.trim().startsWith('/') || line.trim().startsWith('add') || line.trim().startsWith('remove');

                    return (
                      <div
                        key={i}
                        className={`whitespace-pre ${
                          isHeader
                            ? 'text-cyan-400 font-semibold'
                            : isComment
                            ? 'text-slate-500 italic'
                            : isCmd
                            ? 'text-sky-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {line || ' '}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Terminal Copy Footer */}
            <div className="border-t border-slate-800 px-4 py-2.5 bg-[#0a0e17] text-xs text-slate-400 flex items-center justify-between">
              <span>Ready for import in RouterOS terminal</span>
              <span className="font-mono text-slate-500">
                ~{(new Blob([generatedScript]).size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
