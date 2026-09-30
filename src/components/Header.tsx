import React from 'react';
import { Network, Terminal, Github, ExternalLink } from 'lucide-react';

interface HeaderProps {
  activeTab: 'catalog' | 'builder' | 'routing' | 'docs';
  setActiveTab: (tab: 'catalog' | 'builder' | 'routing' | 'docs') => void;
  onQuickCopyTerminal: () => void;
  copiedTerminal: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onQuickCopyTerminal,
  copiedTerminal,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b0f17]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 shadow-sm">
            <Network className="h-5 w-5" />
          </div>
          <a
            href="#catalog"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('catalog');
            }}
            className="text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors"
          >
            PrefixList
          </a>
        </div>

        {/* Zone 2: 4 Clean Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'catalog'
                ? 'bg-slate-800/90 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            Ready-Made Catalog
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'builder'
                ? 'bg-slate-800/90 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            Custom Builder
          </button>
          <button
            onClick={() => setActiveTab('routing')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'routing'
                ? 'bg-slate-800/90 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            Policy Routing & Extras
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'docs'
                ? 'bg-slate-800/90 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            RouterOS Guide
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onQuickCopyTerminal}
            title="Copy one-line RouterOS fetch snippet"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 rounded-md hover:bg-cyan-900/40 transition-colors whitespace-nowrap"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{copiedTerminal ? 'Copied Command!' : 'Quick Fetch'}</span>
          </button>

          <a
            href="https://github.com/hgolshan/prefixlist"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-700/80 rounded-md hover:text-white hover:border-slate-600 transition-colors whitespace-nowrap"
          >
            <Github className="h-4 w-4" />
            <span className="hidden lg:inline">hgolshan/prefixlist</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </a>
        </div>
      </div>

      {/* Mobile Nav strip */}
      <div className="flex md:hidden items-center justify-around border-t border-slate-800/60 bg-[#080c14] py-2 px-2 text-xs">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-2 py-1 rounded ${activeTab === 'catalog' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Catalog
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-2 py-1 rounded ${activeTab === 'builder' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Builder
        </button>
        <button
          onClick={() => setActiveTab('routing')}
          className={`px-2 py-1 rounded ${activeTab === 'routing' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          PBR & Extras
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-2 py-1 rounded ${activeTab === 'docs' ? 'text-cyan-400 font-semibold' : 'text-slate-400'}`}
        >
          Guide
        </button>
      </div>
    </header>
  );
};
