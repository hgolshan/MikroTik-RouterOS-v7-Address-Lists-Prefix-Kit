import React, { useState } from 'react';
import { Network, ShieldAlert, Clock, Copy, Check, Download, AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';
import { generateAutoUpdaterScriptOnly } from '../utils/routerosGenerator.ts';

export const PolicyRoutingPanel: React.FC = () => {
  // PBR Form State
  const [pbrList, setPbrList] = useState('CLOUDFLARE');
  const [pbrTable, setPbrTable] = useState('to_vpn');
  const [pbrGateway, setPbrGateway] = useState('wireguard1');
  const [pbrLan, setPbrLan] = useState('LAN');
  const [pbrFastTrack, setPbrFastTrack] = useState(true);

  // Auto-Updater Form State
  const [updaterList, setUpdaterList] = useState('CLOUDFLARE');
  const [updaterUrl, setUpdaterUrl] = useState(
    'https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/cloudflare.rsc'
  );
  const [updaterInterval, setUpdaterInterval] = useState('7d');
  const [updaterStartTime, setUpdaterStartTime] = useState('03:30:00');

  // Copy feedback
  const [copiedPbr, setCopiedPbr] = useState(false);
  const [copiedUpdater, setCopiedUpdater] = useState(false);

  // Generated PBR Snippet
  const connMark = `conn_${pbrTable}`;
  const pbrCode = `# =====================================================================
# Policy-Based Routing (PBR) for MikroTik RouterOS v7
# Author: Hossein Golshan
# Target List: [${pbrList}] -> Gateway: [${pbrGateway}]
# =====================================================================

# Step 1: Create Routing Table with FIB enabled
/routing table
add name="${pbrTable}" fib comment="PrefixList PBR Table for ${pbrList}"

# Step 2: Add Default Gateway into the Routing Table
/ip route
add dst-address=0.0.0.0/0 gateway=${pbrGateway} routing-table="${pbrTable}" check-gateway=ping distance=1 comment="PrefixList PBR Default Route"

# Step 3: Firewall Mangle Rules
/ip firewall mangle
# 3a. Mark new connection destined to target prefix list
add chain=prerouting in-interface-list=${pbrLan} dst-address-list="${pbrList}" connection-state=new action=mark-connection new-connection-mark=${connMark} passthrough=yes comment="PrefixList PBR [${pbrList}]"

# 3b. Mark routing for marked connection
add chain=prerouting in-interface-list=${pbrLan} connection-mark=${connMark} action=mark-routing new-routing-mark="${pbrTable}" passthrough=no comment="PrefixList PBR [${pbrList}]"
${
  pbrFastTrack
    ? `
# Step 4: FastTrack Firewall Exclusion
# CRITICAL: In RouterOS, FastTrack bypasses mangle marks on established packets.
# This rule accepts established PBR connections BEFORE the FastTrack rule:
/ip firewall filter
add chain=forward action=accept connection-state=established,related connection-mark=${connMark} place-before=[find action=fasttrack-connection] comment="PrefixList FastTrack Bypass [${pbrList}]"
`
    : ''
}
`;

  // Generated Auto-Updater Snippet
  const updaterCode = generateAutoUpdaterScriptOnly(
    updaterList,
    updaterUrl,
    updaterInterval,
    updaterStartTime
  );

  const handleCopyPbr = async () => {
    try {
      await navigator.clipboard.writeText(pbrCode);
      setCopiedPbr(true);
      setTimeout(() => setCopiedPbr(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyUpdater = async () => {
    try {
      await navigator.clipboard.writeText(updaterCode);
      setCopiedUpdater(true);
      setTimeout(() => setCopiedUpdater(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-10">
      {/* Header section */}
      <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span>RouterOS v7 Architecture</span>
            <span aria-hidden="true">·</span>
            <span>Production Best Practices</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Policy-Based Routing (PBR) & Safe Auto-Updater
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Essential companion modules for network engineers. Configure selective VPN or WAN2 routing in RouterOS v7, and deploy self-healing scheduled updaters that never corrupt your firewall state.
          </p>
        </div>
      </div>

      {/* Section 1: Policy Routing Studio */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                01. Policy-Based Routing (RouterOS v7)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              RouterOS v7 replaces the legacy v6 routing marks with dedicated routing tables with the <code className="font-mono text-cyan-300">fib</code> parameter. Traffic matching your address list is steered through an alternate gateway (e.g. WireGuard, OpenVPN, or secondary WAN).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyPbr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
            >
              {copiedPbr ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Warning callout for FastTrack */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-semibold">RouterOS FastTrack Warning:</strong> FastTrack bypasses firewall mangle routing marks on established packets. If FastTrack is active on your router without an exclusion filter, only the initial handshake packet will follow the PBR mark, causing connections to drop or leak. The generated configuration automatically places an accept rule before FastTrack.
          </div>
        </div>

        {/* PBR Form inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Firewall Address-List
            </label>
            <input
              type="text"
              value={pbrList}
              onChange={(e) => setPbrList(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              FIB Routing Table Name
            </label>
            <input
              type="text"
              value={pbrTable}
              onChange={(e) => setPbrTable(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Gateway / Interface
            </label>
            <input
              type="text"
              value={pbrGateway}
              onChange={(e) => setPbrGateway(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              LAN Interface / List
            </label>
            <input
              type="text"
              value={pbrLan}
              onChange={(e) => setPbrLan(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* FastTrack Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pbrFt"
            checked={pbrFastTrack}
            onChange={(e) => setPbrFastTrack(e.target.checked)}
            className="rounded border-slate-700 text-cyan-600 focus:ring-0"
          />
          <label htmlFor="pbrFt" className="text-xs text-slate-300">
            Generate FastTrack bypass filter rule (<code className="font-mono text-cyan-300">place-before=[find action=fasttrack-connection]</code>)
          </label>
        </div>

        {/* PBR Code Viewer */}
        <div className="rounded-lg border border-slate-800 bg-[#070a10] p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed select-text">
          <pre>{pbrCode}</pre>
        </div>
      </div>

      {/* Section 2: Safe Auto-Updater Studio */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131f] p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                02. Safe Auto-Updater Script & Scheduler
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Standard scripts wipe the address list before fetching, causing internet blackouts if the URL is temporarily unreachable. PrefixList uses a 3-stage safe transaction model.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyUpdater}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
            >
              {copiedUpdater ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Updater Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mechanism-to-outcome breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-cyan-400">Phase 1</div>
            <div className="text-sm font-semibold text-white mt-1">Temporary Staging</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">
              Downloads raw script into an isolated temporary file (<code className="font-mono text-cyan-300">pl_tmp_NAME.rsc</code>) without touching active firewall entries.
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-cyan-400">Phase 2</div>
            <div className="text-sm font-semibold text-white mt-1">Integrity Validation</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">
              Checks that downloaded file size is non-zero and greater than 80 bytes. If empty or truncated, import is safely aborted and logged.
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-xs font-mono text-cyan-400">Phase 3</div>
            <div className="text-sm font-semibold text-white mt-1">Atomic Import & Cleanup</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">
              Runs <code className="font-mono text-cyan-300">/import</code> inside a protected <code className="font-mono text-cyan-300">:do ... on-error</code> block, then deletes temporary files from router storage.
            </div>
          </div>
        </div>

        {/* Form Inputs for updater */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              List Name
            </label>
            <input
              type="text"
              value={updaterList}
              onChange={(e) => setUpdaterList(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Fetch URL (Stable Raw URL)
            </label>
            <input
              type="text"
              value={updaterUrl}
              onChange={(e) => setUpdaterUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Sync Cadence / Start Time
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={updaterInterval}
                onChange={(e) => setUpdaterInterval(e.target.value)}
                placeholder="7d"
                className="w-1/2 px-2.5 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
              <input
                type="text"
                value={updaterStartTime}
                onChange={(e) => setUpdaterStartTime(e.target.value)}
                placeholder="03:30:00"
                className="w-1/2 px-2.5 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Updater Code Viewer */}
        <div className="rounded-lg border border-slate-800 bg-[#070a10] p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed select-text">
          <pre>{updaterCode}</pre>
        </div>
      </div>
    </div>
  );
};
