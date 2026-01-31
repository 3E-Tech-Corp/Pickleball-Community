import { useState, useEffect, useRef, useCallback } from 'react'
import { createVideoRoomConnection, rtcConfig } from '../services/videoRoomService'

/**
 * Custom hook to manage WebRTC video room connections.
 * Handles SignalR signaling, peer connections, and media streams.
 */
export function useVideoRoom({ roomCode, displayName, userId, isCreator, onRoomEnded, onRemoved }) {
  const [participants, setParticipants] = useState([]) // [{ connectionId, displayName, userId, isCreator, isMuted, isCameraOff, isScreenSharing }]
  const [chatMessages, setChatMessages] = useState([])
  const [localStream, setLocalStream] = useState(null)
  const [screenStream, setScreenStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  const connectionRef = useRef(null)
  const peerConnectionsRef = useRef({}) // { connectionId: RTCPeerConnection }
  const remoteStreamsRef = useRef({}) // { connectionId: MediaStream }
  const [remoteStreams, setRemoteStreams] = useState({}) // For re-rendering
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)

  // Get user media
  const getLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      localStreamRef.current = stream
      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error('Failed to get media devices:', err)
      // Try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        })
        localStreamRef.current = stream
        setLocalStream(stream)
        setIsCameraOff(true)
        return stream
      } catch (audioErr) {
        console.error('Failed to get audio:', audioErr)
        setError('Could not access camera or microphone. Please check permissions.')
        return null
      }
    }
  }, [])

  // Create peer connection for a remote participant
  const createPeerConnection = useCallback((remoteConnectionId) => {
    const pc = new RTCPeerConnection(rtcConfig)

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    // Handle incoming tracks from remote peer
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (remoteStream) {
        remoteStreamsRef.current[remoteConnectionId] = remoteStream
        setRemoteStreams(prev => ({ ...prev, [remoteConnectionId]: remoteStream }))
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && connectionRef.current) {
        connectionRef.current.invoke(
          'SendIceCandidate',
          remoteConnectionId,
          event.candidate.candidate,
          event.candidate.sdpMid,
          event.candidate.sdpMLineIndex
        ).catch(err => console.error('Failed to send ICE candidate:', err))
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        console.log(`Peer ${remoteConnectionId} ICE state: ${pc.iceConnectionState}`)
      }
    }

    peerConnectionsRef.current[remoteConnectionId] = pc
    return pc
  }, [])

  // Initialize SignalR and join room
  const connect = useCallback(async () => {
    try {
      const stream = await getLocalMedia()
      if (!stream) return

      const connection = createVideoRoomConnection()
      connectionRef.current = connection

      // --- SignalR event handlers ---

      // Existing participants when we join
      connection.on('ExistingParticipants', async (existingParticipants) => {
        setParticipants(existingParticipants)

        // Create peer connections and send offers to each existing participant
        for (const p of existingParticipants) {
          const pc = createPeerConnection(p.connectionId)
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            await connection.invoke('SendOffer', p.connectionId, offer.sdp)
          } catch (err) {
            console.error(`Failed to create offer for ${p.connectionId}:`, err)
          }
        }
      })

      // New participant joined
      connection.on('ParticipantJoined', (participant) => {
        setParticipants(prev => [...prev.filter(p => p.connectionId !== participant.connectionId), participant])
        // Don't create offer — the new joiner will send us an offer
      })

      // Participant left
      connection.on('ParticipantLeft', (connectionId, name) => {
        setParticipants(prev => prev.filter(p => p.connectionId !== connectionId))
        
        // Clean up peer connection
        if (peerConnectionsRef.current[connectionId]) {
          peerConnectionsRef.current[connectionId].close()
          delete peerConnectionsRef.current[connectionId]
        }
        delete remoteStreamsRef.current[connectionId]
        setRemoteStreams(prev => {
          const next = { ...prev }
          delete next[connectionId]
          return next
        })
      })

      // Receive WebRTC offer
      connection.on('ReceiveOffer', async (senderConnectionId, sdp) => {
        const pc = createPeerConnection(senderConnectionId)
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await connection.invoke('SendAnswer', senderConnectionId, answer.sdp)
        } catch (err) {
          console.error(`Failed to handle offer from ${senderConnectionId}:`, err)
        }
      })

      // Receive WebRTC answer
      connection.on('ReceiveAnswer', async (senderConnectionId, sdp) => {
        const pc = peerConnectionsRef.current[senderConnectionId]
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }))
          } catch (err) {
            console.error(`Failed to set answer from ${senderConnectionId}:`, err)
          }
        }
      })

      // Receive ICE candidate
      connection.on('ReceiveIceCandidate', async (senderConnectionId, candidate, sdpMid, sdpMLineIndex) => {
        const pc = peerConnectionsRef.current[senderConnectionId]
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate({
              candidate,
              sdpMid,
              sdpMLineIndex,
            }))
          } catch (err) {
            console.error(`Failed to add ICE candidate from ${senderConnectionId}:`, err)
          }
        }
      })

      // Participant status changes
      connection.on('ParticipantMuteChanged', (connectionId, muted) => {
        setParticipants(prev => prev.map(p =>
          p.connectionId === connectionId ? { ...p, isMuted: muted } : p
        ))
      })

      connection.on('ParticipantCameraChanged', (connectionId, cameraOff) => {
        setParticipants(prev => prev.map(p =>
          p.connectionId === connectionId ? { ...p, isCameraOff: cameraOff } : p
        ))
      })

      connection.on('ParticipantScreenShareChanged', (connectionId, sharing) => {
        setParticipants(prev => prev.map(p =>
          p.connectionId === connectionId ? { ...p, isScreenSharing: sharing } : p
        ))
      })

      // Chat messages
      connection.on('ReceiveChatMessage', (message) => {
        setChatMessages(prev => [...prev, message])
      })

      // Admin controls
      connection.on('AllMuted', () => {
        setIsMuted(true)
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false })
        }
      })

      connection.on('AllUnmuted', () => {
        setIsMuted(false)
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true })
        }
      })

      connection.on('RemovedFromRoom', () => {
        onRemoved?.()
      })

      connection.on('RoomEnded', () => {
        onRoomEnded?.()
      })

      // Start connection
      await connection.start()
      setIsConnected(true)

      // Join the room
      await connection.invoke('JoinRoom', roomCode, displayName, userId, isCreator)

    } catch (err) {
      console.error('Failed to connect:', err)
      setError('Failed to connect to video room. Please try again.')
    }
  }, [roomCode, displayName, userId, isCreator, getLocalMedia, createPeerConnection, onRoomEnded, onRemoved])

  // Disconnect and clean up
  const disconnect = useCallback(async () => {
    // Stop screen sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close())
    peerConnectionsRef.current = {}
    remoteStreamsRef.current = {}
    setRemoteStreams({})

    // Disconnect SignalR
    if (connectionRef.current) {
      try {
        await connectionRef.current.invoke('LeaveRoom')
      } catch (e) { /* ignore */ }
      await connectionRef.current.stop()
      connectionRef.current = null
    }

    setLocalStream(null)
    setScreenStream(null)
    setIsConnected(false)
    setParticipants([])
    setChatMessages([])
  }, [])

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (localStreamRef.current) {
      const newMuted = !isMuted
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted })
      setIsMuted(newMuted)
      if (connectionRef.current) {
        await connectionRef.current.invoke('ToggleMute', newMuted)
      }
    }
  }, [isMuted])

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (localStreamRef.current) {
      const newCameraOff = !isCameraOff
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !newCameraOff })
      setIsCameraOff(newCameraOff)
      if (connectionRef.current) {
        await connectionRef.current.invoke('ToggleCamera', newCameraOff)
      }
    }
  }, [isCameraOff])

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop())
        screenStreamRef.current = null
        setScreenStream(null)
      }

      // Replace screen track with camera track in all peer connections
      const videoTrack = localStreamRef.current?.getVideoTracks()[0]
      if (videoTrack) {
        for (const pc of Object.values(peerConnectionsRef.current)) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(videoTrack)
          }
        }
      }

      setIsScreenSharing(false)
      if (connectionRef.current) {
        await connectionRef.current.invoke('ToggleScreenShare', false)
      }
    } else {
      // Start screen sharing
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screen
        setScreenStream(screen)

        const screenTrack = screen.getVideoTracks()[0]

        // Replace camera track with screen track in all peer connections
        for (const pc of Object.values(peerConnectionsRef.current)) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(screenTrack)
          }
        }

        // Handle user stopping screen share via browser UI
        screenTrack.onended = () => {
          toggleScreenShare() // recursion-safe since isScreenSharing will be true
        }

        setIsScreenSharing(true)
        if (connectionRef.current) {
          await connectionRef.current.invoke('ToggleScreenShare', true)
        }
      } catch (err) {
        console.error('Failed to start screen share:', err)
      }
    }
  }, [isScreenSharing])

  // Send chat message
  const sendChatMessage = useCallback(async (message) => {
    if (connectionRef.current && message.trim()) {
      await connectionRef.current.invoke('SendChatMessage', message)
    }
  }, [])

  // Admin: Mute all
  const muteAll = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.invoke('MuteAll')
    }
  }, [])

  // Admin: Unmute all
  const unmuteAll = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.invoke('UnmuteAll')
    }
  }, [])

  // Admin: Remove participant
  const removeParticipant = useCallback(async (connectionId) => {
    if (connectionRef.current) {
      await connectionRef.current.invoke('RemoveParticipant', connectionId)
    }
  }, [])

  // Admin: End room
  const endRoom = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.invoke('EndRoom')
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    // State
    participants,
    chatMessages,
    localStream,
    screenStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isConnected,
    error,
    // Actions
    connect,
    disconnect,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    sendChatMessage,
    // Admin actions
    muteAll,
    unmuteAll,
    removeParticipant,
    endRoom,
  }
}
