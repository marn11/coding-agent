import { ChatMessage } from '@/types'
import ToolCallItem from './ToolCallItem'

interface Props {
  message: ChatMessage
}

export default function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-lg shadow-indigo-900/20">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-4 gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-700 flex items-center justify-center text-sm mt-1">
        ◈
      </div>
      <div className="max-w-[80%] min-w-0">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls.map((tc, i) => (
              <ToolCallItem key={i} toolCall={tc} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 px-4 py-3 shadow">
            <p className="whitespace-pre-wrap break-words text-sm text-zinc-100 leading-relaxed">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          </div>
        )}
        {message.isStreaming && !message.content && (
          <div className="rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 px-4 py-3">
            <div className="flex gap-1 items-center h-5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
