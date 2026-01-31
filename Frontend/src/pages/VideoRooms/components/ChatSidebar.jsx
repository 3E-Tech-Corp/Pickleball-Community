import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'

export default function ChatSidebar({ messages, onSend, onClose }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSend(input.trim())
      setInput('')
    }
  }

  const formatTime = (timestamp) => {
    const d = new Date(timestamp)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="w-72 sm:w-80 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-white font-medium">Chat</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center text-sm py-8">No messages yet</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="group">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-medium text-blue-400 truncate max-w-[150px]">
                {msg.senderName}
              </span>
              <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <p className="text-gray-200 text-sm break-words">{msg.message}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type a message..."
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
