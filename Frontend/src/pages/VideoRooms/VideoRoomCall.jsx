import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useVideoRoom } from '../../hooks/useVideoRoom'
import VideoGrid from './components/VideoGrid'
import ChatSidebar from './components/ChatSidebar'
import RoomControls from './components/RoomControls'
import DeviceSelector from './components/DeviceSelector'
import {
  Video, VideoOff, Mic, MicOff, Monitor, MessageSquare,
  PhoneOff, Settings, Users, Lock, Unlock, UserMinus, X
} from 'lucide-react'

export default function VideoRoomCall() {
  const { roomCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { room, displayName: stateDisplayName, isCreator: stateIsCreator } = location.state || {}

  const displayName = stateDisplayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Guest'
  const isCreator = stateIsCreator || false

  const [showChat, setShowChat] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [hasLeft, setHasLeft] = useState(false)

  const handleRoomEnded = useCallback(() => {
    setHasLeft(true)
  }, [])

  const handleRemoved = useCallback(() => {
    setHasLeft(true)
  }, [])

  const {
    participants,
    chatMessages,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isConnected,
    error,
    connect,
    disconnect,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    sendChatMessage,
    muteAll,
    unmuteAll,
    removeParticipant,
    endRoom,
  } = useVideoRoom({
    roomCode,
    displayName,
    userId: user?.id || null,
    isCreator,
    onRoomEnded: handleRoomEnded,
    onRemoved: handleRemoved,
  })

  // Connect on mount
  useEffect(() => {
    if (!location.state) {
      // No state = user navigated directly, redirect to join page
      navigate(`/rooms/${roomCode}`, { replace: true })
      return
    }
    connect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!showChat && chatMessages.length > 0) {
      setUnreadMessages(prev => prev + 1)
    }
  }, [chatMessages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleChat = () => {
    setShowChat(prev => !prev)
    if (!showChat) setUnreadMessages(0)
    if (showParticipants) setShowParticipants(false)
  }

  const handleToggleParticipants = () => {
    setShowParticipants(prev => !prev)
    if (showChat) setShowChat(false)
  }

  const handleLeave = async () => {
    await disconnect()
    navigate('/rooms')
  }

  const handleEndRoom = async () => {
    if (window.confirm('End this room for everyone?')) {
      await endRoom()
      await disconnect()
      navigate('/rooms')
    }
  }

  // Room ended / removed overlay
  if (hasLeft) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Call Ended</h2>
          <p className="text-gray-400 mb-6">The video call has ended.</p>
          <button
            onClick={() => navigate('/rooms')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/rooms')}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2.5 rounded-lg transition-colors"
            >
              Back to Rooms
            </button>
            <button
              onClick={connect}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-gray-800/80 backdrop-blur border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-blue-400" />
          <span className="text-white font-medium">{room?.name || 'Video Room'}</span>
          <span className="text-gray-500 text-sm font-mono">#{roomCode}</span>
          {!isConnected && (
            <span className="text-yellow-400 text-sm animate-pulse">Connecting...</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users className="w-4 h-4" />
          <span>{participants.length + 1}</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-2 sm:p-4 overflow-hidden">
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={participants}
            displayName={displayName}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
          />
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <ChatSidebar
            messages={chatMessages}
            onSend={sendChatMessage}
            onClose={() => setShowChat(false)}
          />
        )}

        {/* Participants sidebar */}
        {showParticipants && (
          <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white font-medium">Participants ({participants.length + 1})</h3>
              <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Self */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/10">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{displayName} (You)</p>
                  {isCreator && <p className="text-blue-400 text-xs">Host</p>}
                </div>
                <div className="flex gap-1">
                  {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  {isCameraOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                </div>
              </div>

              {/* Others */}
              {participants.map(p => (
                <div key={p.connectionId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700/50 group">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{p.displayName}</p>
                    {p.isCreator && <p className="text-blue-400 text-xs">Host</p>}
                  </div>
                  <div className="flex gap-1 items-center">
                    {p.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                    {p.isCameraOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                    {isCreator && !p.isCreator && (
                      <button
                        onClick={() => removeParticipant(p.connectionId)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400"
                        title="Remove participant"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Admin controls at bottom */}
            {isCreator && (
              <div className="border-t border-gray-700 p-3 space-y-2">
                <button
                  onClick={muteAll}
                  className="w-full flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <MicOff className="w-4 h-4" />
                  Mute All
                </button>
                <button
                  onClick={unmuteAll}
                  className="w-full flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  Unmute All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="bg-gray-800/80 backdrop-blur border-t border-gray-700 px-4 py-3 flex items-center justify-center gap-3 flex-shrink-0">
        {/* Mic toggle */}
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full transition-colors ${
            isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera toggle */}
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full transition-colors ${
            isCameraOff ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen share */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full transition-colors ${
            isScreenSharing ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Chat */}
        <button
          onClick={handleToggleChat}
          className={`p-3 rounded-full transition-colors relative ${
            showChat ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Chat"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadMessages > 0 && !showChat && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </button>

        {/* Participants */}
        <button
          onClick={handleToggleParticipants}
          className={`p-3 rounded-full transition-colors ${
            showParticipants ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Participants"
        >
          <Users className="w-5 h-5" />
        </button>

        {/* Separator */}
        <div className="w-px h-8 bg-gray-600 mx-1"></div>

        {/* Leave */}
        <button
          onClick={handleLeave}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
          title="Leave room"
        >
          <PhoneOff className="w-5 h-5" />
        </button>

        {/* End room (creator only) */}
        {isCreator && (
          <button
            onClick={handleEndRoom}
            className="px-4 py-2 rounded-full bg-red-900/50 hover:bg-red-800 text-red-300 text-sm font-medium transition-colors border border-red-700"
            title="End room for everyone"
          >
            End Room
          </button>
        )}
      </div>

      {/* Device selector modal */}
      {showDevices && (
        <DeviceSelector onClose={() => setShowDevices(false)} />
      )}
    </div>
  )
}
