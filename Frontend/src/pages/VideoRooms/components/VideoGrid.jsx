import { useRef, useEffect, useMemo } from 'react'
import { Mic, MicOff, VideoOff, Monitor } from 'lucide-react'

/**
 * Adaptive video grid layout for all participants
 */
export default function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  displayName,
  isMuted,
  isCameraOff,
  isScreenSharing,
}) {
  const totalCount = 1 + participants.length // self + remote

  // Calculate grid layout
  const gridClass = useMemo(() => {
    if (totalCount === 1) return 'grid-cols-1'
    if (totalCount === 2) return 'grid-cols-2'
    if (totalCount <= 4) return 'grid-cols-2 grid-rows-2'
    if (totalCount <= 6) return 'grid-cols-3 grid-rows-2'
    return 'grid-cols-3 grid-rows-3'
  }, [totalCount])

  return (
    <div className={`grid gap-2 h-full ${gridClass}`}>
      {/* Local (self) video */}
      <VideoTile
        stream={localStream}
        displayName={displayName}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        isSelf={true}
        mirrored={!isScreenSharing}
      />

      {/* Remote participants */}
      {participants.map(p => (
        <VideoTile
          key={p.connectionId}
          stream={remoteStreams[p.connectionId]}
          displayName={p.displayName}
          isMuted={p.isMuted}
          isCameraOff={p.isCameraOff}
          isScreenSharing={p.isScreenSharing}
          isCreator={p.isCreator}
          isSelf={false}
        />
      ))}
    </div>
  )
}

function VideoTile({ stream, displayName, isMuted, isCameraOff, isScreenSharing, isCreator, isSelf, mirrored }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const hasVideo = stream && stream.getVideoTracks().length > 0 && !isCameraOff

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center border border-gray-700/50 min-h-0">
      {/* Video element */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`w-full h-full object-cover ${!hasVideo ? 'hidden' : ''} ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
      )}

      {/* No video placeholder */}
      {(!stream || !hasVideo) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-600 flex items-center justify-center mb-2">
            <span className="text-2xl sm:text-3xl font-bold text-white">
              {displayName?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          {isCameraOff && (
            <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
              <VideoOff className="w-3.5 h-3.5" />
              Camera off
            </div>
          )}
        </div>
      )}

      {/* Screen sharing indicator */}
      {isScreenSharing && (
        <div className="absolute top-2 left-2 bg-blue-500/80 backdrop-blur text-white px-2 py-0.5 rounded text-xs flex items-center gap-1">
          <Monitor className="w-3 h-3" />
          Screen
        </div>
      )}

      {/* Name badge + status */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {displayName}{isSelf ? ' (You)' : ''}{isCreator ? ' ⭐' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            {isMuted ? (
              <MicOff className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-green-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
