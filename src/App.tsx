/**
 * PrefixList - MikroTik RouterOS Prefix Kit
 * Author: Hossein Golshan
 * GitHub: https://github.com/hgolshan/prefixlist
 */

import React, { useState } from 'react';
import { Header } from './components/Header.tsx';
import { CatalogView } from './components/CatalogView.tsx';
import { CustomBuilder } from './components/CustomBuilder.tsx';
import { PolicyRoutingPanel } from './components/PolicyRoutingPanel.tsx';
import { DocsView } from './components/DocsView.tsx';
import { RscPreviewModal } from './components/RscPreviewModal.tsx';
import { OrgItem, CountryItem } from './data/catalogData.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'builder' | 'routing' | 'docs'>('catalog');
  const [copiedTerminal, setCopiedTerminal] = useState(false);

  // Inspector modal state
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    title: string;
    filename: string;
    rscContent: string;
    rawUrl?: string;
    prefixStats?: { ipv4: number; ipv6: number; total: number };
  }>({
    isOpen: false,
    title: '',
    filename: '',
    rscContent: '',
  });

  const handleQuickCopyTerminal = async () => {
    const cmd = `/tool fetch url="https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/org/cloudflare.rsc" dst-path="cloudflare.rsc"\n/import cloudflare.rsc\n/file remove [find name="cloudflare.rsc"]`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedTerminal(true);
      setTimeout(() => setCopiedTerminal(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleInspectList = (list: {
    title: string;
    filename: string;
    rscContent: string;
    rawUrl: string;
    prefixStats: { ipv4: number; ipv6: number; total: number };
  }) => {
    setInspectModal({
      isOpen: true,
      ...list,
    });
  };

  const handleOpenInBuilder = (item: OrgItem | CountryItem, type: 'org' | 'country') => {
    setActiveTab('builder');
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickCopyTerminal={handleQuickCopyTerminal}
        copiedTerminal={copiedTerminal}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'catalog' && (
          <CatalogView
            onInspectList={handleInspectList}
            onOpenInBuilder={handleOpenInBuilder}
          />
        )}

        {activeTab === 'builder' && <CustomBuilder />}

        {activeTab === 'routing' && <PolicyRoutingPanel />}

        {activeTab === 'docs' && <DocsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d15] py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">PrefixList</span>
            <span aria-hidden="true">·</span>
            <span>Created by Hossein Golshan</span>
            <span aria-hidden="true">·</span>
            <span>MikroTik RouterOS Address List Kit</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/hgolshan/prefixlist"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              GitHub Repository
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://raw.githubusercontent.com/hgolshan/prefixlist/main/public/lists/index.json"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors font-mono"
            >
              index.json
            </a>
            <span aria-hidden="true">·</span>
            <span className="text-slate-600">MIT License</span>
          </div>
        </div>
      </footer>

      {/* Code Inspection Modal */}
      <RscPreviewModal
        isOpen={inspectModal.isOpen}
        onClose={() => setInspectModal((prev) => ({ ...prev, isOpen: false }))}
        title={inspectModal.title}
        filename={inspectModal.filename}
        rscContent={inspectModal.rscContent}
        rawUrl={inspectModal.rawUrl}
        prefixStats={inspectModal.prefixStats}
      />
    </div>
  );
}
