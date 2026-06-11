'use client'

import { useState } from 'react'
import { ToolCall } from '@/types'

const TOOL_ICONS: Record<string, string> = {
  read_file: '📄',
  list_files: '📁',
  bash: '⚡',
  edit_file: '✏️',
  search_code: '🔍',
}

interface Props {
  toolCall: ToolCall
}

export default function ToolCallItem({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false)
  const icon = TOOL_ICONS[toolCall.name] ?? '🔧'
  const hasResult = toolCall.result !== undefined

  return (
    <div className="my-1 rounded-lg border border-indigo-900/40 bg-[#12121e] text-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-indigo-950/30 transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span className="font-mono text-indigo-300 font-medium">{toolCall.name}</span>
        <span className="text-zinc-500 truncate flex-1">
          {Object.entries(toolCall.args)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(', ')}
        </span>
        {hasResult && (
          <span className="ml-auto text-xs text-emerald-500 shrink-0">✓ done</span>
        )}
        {!hasResult && (
          <span className="ml-auto text-xs text-amber-400 shrink-0 animate-pulse">running…</span>
        )}
        <span className="text-zinc-600 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && hasResult && (
        <div className="border-t border-indigo-900/40 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-400 max-h-64 overflow-y-auto">
            {toolCall.result}
          </pre>
        </div>
      )}
    </div>
  )
}
