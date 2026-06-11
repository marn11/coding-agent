export interface ToolCall {
  name: string
  args: Record<string, unknown>
  result?: string
  isExpanded: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolCalls?: ToolCall[]
}
