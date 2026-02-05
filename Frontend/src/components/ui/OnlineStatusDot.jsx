import { useState } from 'react'

/**
 * Online status indicator dot component.
 * Shows green pulsing dot when online, gray dot with "last active" tooltip when offline.
 * 
 * @param {boolean} isOnline - Whether the user is currently online
 * @param {string|Date|null} lastActiveAt - ISO date string or Date of last activity
 * @param {string} size - 'sm' | 'md' | 'lg' (default: 'md')
 * @param {boolean} showLabel - Whether to show text label next to the dot
 */
export default function OnlineStatusDot({ isOnline, lastActiveAt, size = 'md', showLabel = false }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  }

  const pulseSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  }

  const formatLastActive = (dateStr) => {
    if (!dateStr) return 'Unknown'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHrs < 24) return `${diffHrs}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const lastActiveText = lastActiveAt ? formatLastActive(lastActiveAt) : null

  return (
    <div
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="relative inline-flex">
        {isOnline ? (
          <>
            {/* Green pulsing dot */}
            <span className={`${pulseSizeClasses[size]} animate-ping absolute inline-flex rounded-full bg-green-400 opacity-75`}></span>
            <span className={`${sizeClasses[size]} relative inline-flex rounded-full bg-green-500`}></span>
          </>
        ) : (
          /* Gray dot */
          <span className={`${sizeClasses[size]} relative inline-flex rounded-full bg-gray-400`}></span>
        )}
      </span>

      {showLabel && (
        <span className={`text-xs ${isOnline ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
          {isOnline ? 'Online' : (lastActiveText ? `Active ${lastActiveText}` : 'Offline')}
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && !showLabel && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md whitespace-nowrap z-50 shadow-lg">
          {isOnline ? 'Online now' : (lastActiveText ? `Last active ${lastActiveText}` : 'Offline')}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  )
}
