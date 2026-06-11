'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessage, ToolCall } from '@/types'
import MessageBubble from './MessageBubble'

const API_URL = 'http://localhost:8000'

function makeId() {
  return Math.random().toString(36).slice(2)
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const updateLastMessage = useCallback((updater: (msg: ChatMessage) => ChatMessage) => {
    setMessages(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = updater(updated[updated.length - 1])
      return updated
    })
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)

    const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text }
    const assistantMsg: ChatMessage = {
      id: makeId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue

          let event: { type: string; content?: string; name?: string; args?: Record<string, unknown>; result?: string }
          try {
            event = JSON.parse(raw)
          } catch {
            continue
          }

          if (event.type === 'text') {
            updateLastMessage(msg => ({ ...msg, content: msg.content + (event.content ?? '') }))
          } else if (event.type === 'tool_call') {
            const newTool: ToolCall = {
              name: event.name!,
              args: event.args ?? {},
              isExpanded: false,
            }
            updateLastMessage(msg => ({
              ...msg,
              toolCalls: [...(msg.toolCalls ?? []), newTool],
            }))
          } else if (event.type === 'tool_result') {
            updateLastMessage(msg => {
              const toolCalls = [...(msg.toolCalls ?? [])]
              const last = toolCalls.findLastIndex(tc => tc.name === event.name && tc.result === undefined)
              if (last !== -1) toolCalls[last] = { ...toolCalls[last], result: event.result ?? '' }
              return { ...msg, toolCalls }
            })
          } else if (event.type === 'done') {
            updateLastMessage(msg => ({ ...msg, isStreaming: false }))
          }
        }
      }
    } catch (err) {
      updateLastMessage(msg => ({
        ...msg,
        content: `Error: ${err instanceof Error ? err.message : 'Request failed'}`,
        isStreaming: false,
      }))
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }, [input, isStreaming, updateLastMessage])

  const clearConversation = useCallback(async () => {
    if (isStreaming) return
    await fetch(`${API_URL}/conversation`, { method: 'DELETE' })
    setMessages([])
    inputRef.current?.focus()
  }, [isStreaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#09090b]">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
            ◈
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-none">Coding Agent</h1>
            <p className="text-zinc-500 text-xs mt-0.5">gpt-4o · read · write · bash · search</p>
          </div>
        </div>
        <button
          onClick={clearConversation}
          disabled={isStreaming || messages.length === 0}
          className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800"
        >
          Clear
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center text-3xl mb-4">
                ◈
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Coding Agent</h2>
              <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
                Ask me to read files, run commands, search code, or make edits. I can see your filesystem.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  'What files are in this directory?',
                  'Read agent.py and explain it',
                  'What does the git log look like?',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs text-zinc-400 border border-zinc-800 rounded-full px-3 py-1.5 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#09090b]/80 backdrop-blur px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-colors shadow-lg">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent anything…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 text-sm resize-none outline-none max-h-40 leading-relaxed disabled:opacity-50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={send}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {isStreaming ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-center text-zinc-700 text-xs mt-2">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
