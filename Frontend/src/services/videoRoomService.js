import axios from 'axios'
import * as signalR from '@microsoft/signalr'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Determine the SignalR hub URL
function getHubUrl() {
  const apiUrl = API_BASE_URL
  // In production, API_BASE_URL is '/api', so hub is at '/hubs/videoroom'
  // In dev, API_BASE_URL is full URL like 'https://localhost:7009'
  if (apiUrl.startsWith('http')) {
    // Dev mode: use full URL
    return `${apiUrl.replace(/\/api\/?$/, '')}/hubs/videoroom`
  }
  // Production: relative path (hubs are at root, not under /api)
  return '/hubs/videoroom'
}

// REST API calls
export const videoRoomApi = {
  createRoom: (data) => axios.post(`${API_BASE_URL}/VideoRoom`, data),
  getRoom: (roomCode) => axios.get(`${API_BASE_URL}/VideoRoom/${roomCode}`),
  getActiveRooms: () => axios.get(`${API_BASE_URL}/VideoRoom`),
  joinRoom: (roomCode, data) => axios.post(`${API_BASE_URL}/VideoRoom/${roomCode}/join`, data),
  getParticipants: (roomCode) => axios.get(`${API_BASE_URL}/VideoRoom/${roomCode}/participants`),
  endRoom: (roomCode) => axios.post(`${API_BASE_URL}/VideoRoom/${roomCode}/end`),
  lockRoom: (roomCode, locked) => axios.post(`${API_BASE_URL}/VideoRoom/${roomCode}/lock?locked=${locked}`),
}

// SignalR connection for video room
export function createVideoRoomConnection() {
  const token = localStorage.getItem('jwtToken')
  
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(getHubUrl(), {
      accessTokenFactory: () => token || '',
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  return connection
}

// WebRTC configuration with public STUN servers
export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}
