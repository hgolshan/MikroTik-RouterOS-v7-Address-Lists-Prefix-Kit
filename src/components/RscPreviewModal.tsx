import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, FileCode2 } from 'lucide-react';

interface RscPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  rscContent: string;
  rawUrl?: string;
  prefixStats?: {
    ipv4: number;
    ipv6: number;
    total: number;
  };
}

export const RscPreviewModal: React.FC<RscPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  filename,
  rscContent,
  rawUrl,
  prefixStats,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedFetch, setCopiedFetch] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(rscContent);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const terminalCommand = rawUrl
    ? `/tool fetch url="${rawUrl}" dst-path="${filename}"\n/import ${filename}\n/file remove [find name="${filename}"]`
    : `# Import script directly via terminal\n/import ${filename}`;

  const handleCopyTerminal = async () => {
    try {
      await navigator.clipboard.writeText(terminalCommand);
      setCopiedFetch(true);
      setTimeout(() => setCopiedFetch(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([rscContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = rscContent.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl rounded-xl border border-slate-700/80 bg-[#0d131f] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-[#0a0e17]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-slate-300">{filename}</span>
                {prefixStats && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{prefixStats.ipv4} IPv4</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{prefixStats.ipv6} IPv6</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{prefixStats.total} Total</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Fetch Bar */}
        {rawUrl && (
          <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-950/60 px-6 py-2.5 text-xs">
            <div className="flex items-center gap-2 overflow-hidden text-slate-400">
              <Terminal className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="text-slate-400 shrink-0">Terminal Fetch:</span>
              <code className="truncate font-mono text-cyan-300">
                /tool fetch url=&quot;{rawUrl}&quot; dst-path=&quot;{filename}&quot;
              </code>
            </div>
            <button
              onClick={handleCopyTerminal}
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copiedFetch ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Terminal Cmd</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Code Viewport with Line Numbers */}
        <div className="flex-1 overflow-auto bg-[#070a10] p-4 font-mono text-xs text-slate-300 select-text">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 min-w-full">
            <div className="select-none text-right text-slate-600 pr-2 border-r border-slate-800/80 leading-relaxed font-mono tabular-nums">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="overflow-x-auto leading-relaxed">
              {lines.map((line, i) => {
                const isComment = line.trim().startsWith('#');
                const isSectionHeader = line.includes('Firewall Address List') || line.includes('PrefixList - MikroTik');
                const isCommand = line.trim().startsWith('/') || line.trim().startsWith('add') || line.trim().startsWith('remove');

                return (
                  <div
                    key={i}
                    className={`whitespace-pre ${
                      isSectionHeader
                        ? 'text-cyan-400 font-semibold'
                        : isComment
                        ? 'text-slate-500 italic'
                        : isCommand
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5 bg-[#0a0e17]">
          <div className="text-xs text-slate-400">
            <span>{lines.length} lines</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>~{(new Blob([rscContent]).size / 1024).toFixed(1)} KB</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Script Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Full Script</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download .rsc</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
