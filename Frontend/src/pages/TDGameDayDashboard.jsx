import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Users, CheckCircle, XCircle, Play, Clock, MapPin,
  Send, RefreshCw, AlertCircle, ChevronDown, ChevronRight,
  FileText, Bell, Trophy, Grid, List
} from 'lucide-react'
import { gameDayApi, checkInApi } from '../services/api'

export default function TDGameDayDashboard() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [checkIns, setCheckIns] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('courts') // courts, games, checkins

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const [dashboardRes, checkInsRes] = await Promise.all([
        gameDayApi.getTDDashboard(eventId),
        checkInApi.getEventCheckIns(eventId)
      ])
      if (dashboardRes.success) setDashboard(dashboardRes.data)
      if (checkInsRes.success) setCheckIns(checkInsRes.data)
    } catch (err) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [eventId])

  useEffect(() => {
    loadData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleQueueGame = async (gameId, courtId) => {
    try {
      await gameDayApi.queueGame(gameId, courtId)
      loadData()
    } catch (err) {
      alert('Failed to queue game: ' + (err.message || 'Unknown error'))
    }
  }

  const handleStartGame = async (gameId) => {
    try {
      await gameDayApi.startGame(gameId)
      loadData()
    } catch (err) {
      alert('Failed to start game: ' + (err.message || 'Unknown error'))
    }
  }

  const handleManualCheckIn = async (userId) => {
    try {
      await checkInApi.manualCheckIn(eventId, userId, { signWaiver: true })
      loadData()
    } catch (err) {
      alert('Failed to check in player: ' + (err.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!dashboard) return null

  const availableCourts = dashboard.courts.filter(c => c.status === 'Available')
  const gamesReadyWithCheckIn = dashboard.readyGames.filter(g => g.allPlayersCheckedIn)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{dashboard.eventName}</h1>
                <p className="text-sm text-gray-500">TD Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNotifyModal(true)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Send Notification"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={loadData}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              icon={<Users className="w-5 h-5 text-blue-600" />}
              label="Checked In"
              value={`${dashboard.checkedInPlayers}/${dashboard.totalPlayers}`}
              color="blue"
            />
            <StatCard
              icon={<FileText className="w-5 h-5 text-green-600" />}
              label="Waivers"
              value={dashboard.waiverSignedPlayers}
              color="green"
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-yellow-600" />}
              label="Ready"
              value={dashboard.gamesReady}
              color="yellow"
            />
            <StatCard
              icon={<Play className="w-5 h-5 text-purple-600" />}
              label="In Progress"
              value={dashboard.gamesInProgress}
              color="purple"
            />
            <StatCard
              icon={<Trophy className="w-5 h-5 text-green-600" />}
              label="Completed"
              value={`${dashboard.gamesCompleted}/${dashboard.totalGames}`}
              color="green"
            />
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setViewMode('courts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'courts' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid className="w-4 h-4 inline mr-1" /> Courts
          </button>
          <button
            onClick={() => setViewMode('games')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'games' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4 inline mr-1" /> Games
          </button>
          <button
            onClick={() => setViewMode('checkins')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'checkins' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-1" /> Check-ins
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {viewMode === 'courts' && (
          <CourtsView
            courts={dashboard.courts}
            inProgressGames={dashboard.inProgressGames}
            readyGames={gamesReadyWithCheckIn}
            onStartGame={handleStartGame}
            onQueueGame={handleQueueGame}
          />
        )}

        {viewMode === 'games' && (
          <GamesView
            readyGames={dashboard.readyGames}
            inProgressGames={dashboard.inProgressGames}
            courts={availableCourts}
            onQueueGame={handleQueueGame}
            onStartGame={handleStartGame}
          />
        )}

        {viewMode === 'checkins' && checkIns && (
          <CheckInsView
            checkIns={checkIns}
            onManualCheckIn={handleManualCheckIn}
          />
        )}
      </div>

      {/* Notify Modal */}
      {showNotifyModal && (
        <NotifyModal
          eventId={eventId}
          onClose={() => setShowNotifyModal(false)}
          onSend={loadData}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={`p-2 rounded-lg bg-${color}-100`}>{icon}</div>
      <div>
        <div className="text-lg font-semibold">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function CourtsView({ courts, inProgressGames, readyGames, onStartGame, onQueueGame }) {
  const [selectedCourt, setSelectedCourt] = useState(null)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Courts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map(court => {
          const currentGame = inProgressGames.find(g => g.courtId === court.courtId)
          const queuedGames = inProgressGames.filter(g => g.courtId === court.courtId && g.status === 'Queued')

          return (
            <div key={court.courtId} className="bg-white rounded-lg border overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${
                court.status === 'Available' ? 'bg-green-50' :
                court.status === 'InUse' ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <div>
                  <h3 className="font-semibold">{court.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    court.status === 'Available' ? 'bg-green-100 text-green-700' :
                    court.status === 'InUse' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {court.status}
                  </span>
                </div>
                <MapPin className="w-5 h-5 text-gray-400" />
              </div>

              <div className="p-4">
                {currentGame ? (
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-sm text-gray-500">{currentGame.roundName}</div>
                      <div className="font-medium">{currentGame.unit1Name}</div>
                      <div className="text-2xl font-bold my-1">
                        {currentGame.unit1Score} - {currentGame.unit2Score}
                      </div>
                      <div className="font-medium">{currentGame.unit2Name}</div>
                    </div>
                    {currentGame.status === 'Queued' && (
                      <button
                        onClick={() => onStartGame(currentGame.gameId)}
                        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Start Game
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-3">No game in progress</p>
                    <button
                      onClick={() => setSelectedCourt(court.courtId)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Assign Game
                    </button>
                  </div>
                )}

                {queuedGames.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-gray-500 mb-2">Queue ({queuedGames.length})</div>
                    {queuedGames.slice(0, 2).map(g => (
                      <div key={g.gameId} className="text-sm text-gray-600">
                        {g.unit1Name} vs {g.unit2Name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Assign Game Modal */}
      {selectedCourt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Assign Game to Court</h3>
              <button onClick={() => setSelectedCourt(null)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {readyGames.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No games ready with all players checked in</p>
              ) : (
                readyGames.map(game => (
                  <button
                    key={game.gameId}
                    onClick={() => {
                      onQueueGame(game.gameId, selectedCourt)
                      setSelectedCourt(null)
                    }}
                    className="w-full p-3 border rounded-lg hover:bg-blue-50 text-left"
                  >
                    <div className="font-medium">{game.unit1Name} vs {game.unit2Name}</div>
                    <div className="text-sm text-gray-500">{game.divisionName} - {game.roundName}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GamesView({ readyGames, inProgressGames, courts, onQueueGame, onStartGame }) {
  return (
    <div className="space-y-6">
      {/* In Progress */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Play className="w-5 h-5 text-green-600" /> In Progress ({inProgressGames.length})
        </h2>
        <div className="space-y-2">
          {inProgressGames.map(game => (
            <div key={game.gameId} className="bg-white p-4 rounded-lg border flex items-center justify-between">
              <div>
                <div className="font-medium">{game.unit1Name} vs {game.unit2Name}</div>
                <div className="text-sm text-gray-500">{game.roundName} - {game.courtName}</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{game.unit1Score} - {game.unit2Score}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  game.status === 'Playing' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {game.status}
                </span>
              </div>
              {game.status === 'Queued' && (
                <button
                  onClick={() => onStartGame(game.gameId)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  Start
                </button>
              )}
            </div>
          ))}
          {inProgressGames.length === 0 && (
            <p className="text-gray-500 text-center py-4">No games in progress</p>
          )}
        </div>
      </section>

      {/* Ready Games */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-600" /> Ready Games ({readyGames.length})
        </h2>
        <div className="space-y-2">
          {readyGames.map(game => (
            <div key={game.gameId} className="bg-white p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">{game.unit1Name} vs {game.unit2Name}</div>
                  <div className="text-sm text-gray-500">{game.divisionName} - {game.roundName}</div>
                </div>
                {game.allPlayersCheckedIn ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <div className="flex gap-2 text-sm">
                <div className="flex-1">
                  {game.unit1Players.map(p => (
                    <span key={p.userId} className={`inline-flex items-center mr-2 ${p.isCheckedIn ? 'text-green-600' : 'text-red-600'}`}>
                      {p.isCheckedIn ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {p.name}
                    </span>
                  ))}
                </div>
                <div className="flex-1">
                  {game.unit2Players.map(p => (
                    <span key={p.userId} className={`inline-flex items-center mr-2 ${p.isCheckedIn ? 'text-green-600' : 'text-red-600'}`}>
                      {p.isCheckedIn ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
              {game.allPlayersCheckedIn && courts.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <select
                    className="flex-1 p-2 border rounded text-sm"
                    onChange={(e) => e.target.value && onQueueGame(game.gameId, parseInt(e.target.value))}
                    defaultValue=""
                  >
                    <option value="">Select Court...</option>
                    {courts.map(c => (
                      <option key={c.courtId} value={c.courtId}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
          {readyGames.length === 0 && (
            <p className="text-gray-500 text-center py-4">No games ready</p>
          )}
        </div>
      </section>
    </div>
  )
}

function CheckInsView({ checkIns, onManualCheckIn }) {
  const [filter, setFilter] = useState('all') // all, pending, checked

  const filteredPlayers = checkIns.players.filter(p => {
    if (filter === 'pending') return !p.isCheckedIn
    if (filter === 'checked') return p.isCheckedIn
    return true
  })

  // Group by unique players
  const uniquePlayers = []
  const seen = new Set()
  filteredPlayers.forEach(p => {
    if (!seen.has(p.userId)) {
      seen.add(p.userId)
      uniquePlayers.push(p)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Check-ins</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="all">All Players</option>
            <option value="pending">Not Checked In</option>
            <option value="checked">Checked In</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Division</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Check-in</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Waiver</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {uniquePlayers.map(player => (
              <tr key={player.userId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{player.firstName} {player.lastName}</div>
                  <div className="text-sm text-gray-500">{player.email}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{player.divisionName}</td>
                <td className="px-4 py-3 text-center">
                  {player.isCheckedIn ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {player.waiverSigned ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!player.isCheckedIn && (
                    <button
                      onClick={() => onManualCheckIn(player.userId)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Check In
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {uniquePlayers.length === 0 && (
          <div className="py-8 text-center text-gray-500">No players found</div>
        )}
      </div>
    </div>
  )
}

function NotifyModal({ eventId, onClose, onSend }) {
  const [targetType, setTargetType] = useState('All')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!title || !message) {
      alert('Please enter title and message')
      return
    }

    try {
      setSending(true)
      await gameDayApi.sendNotification(eventId, { targetType, title, message })
      onSend()
      onClose()
    } catch (err) {
      alert('Failed to send notification: ' + (err.message || 'Unknown error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Send Notification</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send To</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full p-2 border rounded-lg"
            >
              <option value="All">All Players</option>
              <option value="NotCheckedIn">Not Checked In</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded-lg"
              placeholder="Notification title..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-2 border rounded-lg"
              rows={3}
              placeholder="Notification message..."
            />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
