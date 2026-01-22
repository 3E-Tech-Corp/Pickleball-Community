import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Trophy, Play, Clock, MapPin, RefreshCw, Filter,
  Download, Bell, BellOff, ChevronDown, ChevronRight, Users,
  Calendar, Eye, UserCheck, CalendarClock
} from 'lucide-react'
import { scoreboardApi, spectatorApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function EventScoreboard() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [scoreboard, setScoreboard] = useState(null)
  const [liveScores, setLiveScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Filters
  const [divisionId, setDivisionId] = useState(null)
  const [roundType, setRoundType] = useState(null)
  const [status, setStatus] = useState(null)

  // Tabs
  const [activeTab, setActiveTab] = useState('live') // live, matches, standings, bracket

  // Subscriptions (for logged in users)
  const [subscriptions, setSubscriptions] = useState([])
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const [scoreboardRes, liveRes] = await Promise.all([
        scoreboardApi.getScoreboard(eventId, { divisionId, roundType, status }),
        scoreboardApi.getLiveScores(eventId)
      ])
      if (scoreboardRes.success) setScoreboard(scoreboardRes.data)
      if (liveRes.success) setLiveScores(liveRes.data)

      // Load subscriptions if logged in
      if (user) {
        try {
          const subsRes = await spectatorApi.getSubscriptions(eventId)
          if (subsRes.success) setSubscriptions(subsRes.data)
        } catch (e) {
          // Ignore subscription errors
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load scoreboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [eventId, divisionId, roundType, status, user])

  useEffect(() => {
    loadData()
    // Auto-refresh every 10 seconds for live scores
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleDownload = () => {
    const url = scoreboardApi.getResultsDownloadUrl(eventId, divisionId)
    window.open(url, '_blank')
  }

  const handleSubscribe = async (type, targetId = null) => {
    try {
      await spectatorApi.subscribe({
        eventId: parseInt(eventId),
        subscriptionType: type,
        targetId
      })
      loadData()
    } catch (err) {
      alert('Failed to subscribe: ' + (err.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !scoreboard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{scoreboard.eventName}</h1>
                <p className="text-sm text-gray-500">Scoreboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={() => setShowSubscribeModal(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Subscribe to updates"
                >
                  <Bell className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Download results"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={loadData}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { key: 'live', label: 'Live Scores', icon: Play },
              { key: 'schedule', label: 'Schedule', icon: CalendarClock },
              { key: 'registrations', label: 'Teams', icon: Users },
              { key: 'matches', label: 'Matches', icon: Trophy },
              { key: 'standings', label: 'Standings', icon: Trophy },
              { key: 'bracket', label: 'Bracket', icon: ChevronRight }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-3">
            <select
              value={divisionId || ''}
              onChange={(e) => setDivisionId(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Divisions</option>
              {scoreboard.divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {activeTab === 'matches' && (
              <>
                <select
                  value={roundType || ''}
                  onChange={(e) => setRoundType(e.target.value || null)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">All Rounds</option>
                  <option value="Pool">Pool Play</option>
                  <option value="Bracket">Bracket</option>
                  <option value="Final">Final</option>
                </select>

                <select
                  value={status || ''}
                  onChange={(e) => setStatus(e.target.value || null)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">All Status</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === 'live' && (
          <LiveScoresTab liveScores={liveScores} />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab eventId={eventId} divisionId={divisionId} />
        )}

        {activeTab === 'registrations' && (
          <RegistrationsTab eventId={eventId} divisionId={divisionId} />
        )}

        {activeTab === 'matches' && (
          <MatchesTab matches={scoreboard.matches} />
        )}

        {activeTab === 'standings' && (
          <StandingsTab eventId={eventId} divisionId={divisionId} />
        )}

        {activeTab === 'bracket' && divisionId && (
          <BracketTab eventId={eventId} divisionId={divisionId} />
        )}

        {activeTab === 'bracket' && !divisionId && (
          <div className="text-center py-8 text-gray-500">
            Please select a division to view the bracket
          </div>
        )}
      </div>

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <SubscribeModal
          eventId={eventId}
          subscriptions={subscriptions}
          onSubscribe={handleSubscribe}
          onClose={() => setShowSubscribeModal(false)}
          onRefresh={loadData}
        />
      )}
    </div>
  )
}

function LiveScoresTab({ liveScores }) {
  if (liveScores.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-600">No Live Games</h3>
        <p className="text-gray-500">Games will appear here when they start</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {liveScores.map(game => (
        <div key={game.gameId} className="bg-white rounded-xl border overflow-hidden">
          <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-green-700 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {game.status}
            </span>
            {game.courtName && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {game.courtName}
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="text-xs text-gray-500 mb-2">{game.divisionName} - {game.roundName}</div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{game.unit1Name}</span>
              <span className="text-2xl font-bold">{game.unit1Score}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{game.unit2Name}</span>
              <span className="text-2xl font-bold">{game.unit2Score}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MatchesTab({ matches }) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No matches found with current filters
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {matches.map(match => (
        <div key={match.matchId} className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                match.status === 'InProgress' ? 'bg-green-100 text-green-700' :
                match.status === 'Completed' ? 'bg-gray-100 text-gray-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {match.status}
              </span>
              <span className="text-sm text-gray-500">{match.divisionName}</span>
            </div>
            {match.roundName && (
              <span className="text-sm text-gray-500">{match.roundName}</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className={`font-medium ${match.winnerUnitId === match.unit1Id ? 'text-green-600' : ''}`}>
                {match.unit1Seed && <span className="text-gray-400 mr-1">({match.unit1Seed})</span>}
                {match.unit1Name || 'TBD'}
              </div>
              <div className={`font-medium ${match.winnerUnitId === match.unit2Id ? 'text-green-600' : ''}`}>
                {match.unit2Seed && <span className="text-gray-400 mr-1">({match.unit2Seed})</span>}
                {match.unit2Name || 'TBD'}
              </div>
            </div>

            {match.games.length > 0 && (
              <div className="flex gap-2">
                {match.games.map((game, idx) => (
                  <div key={idx} className="text-center px-2">
                    <div className="text-xs text-gray-400">G{game.gameNumber}</div>
                    <div className="font-medium">{game.unit1Score}</div>
                    <div className="font-medium">{game.unit2Score}</div>
                  </div>
                ))}
              </div>
            )}

            {match.winnerUnitId && (
              <Trophy className="w-5 h-5 text-yellow-500 ml-2" />
            )}
          </div>

          {match.courtName && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {match.courtName}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StandingsTab({ eventId, divisionId }) {
  const [standings, setStandings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStandings = async () => {
      try {
        const res = await scoreboardApi.getResults(eventId, divisionId)
        if (res.success) setStandings(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadStandings()
  }, [eventId, divisionId])

  if (loading) {
    return <div className="text-center py-8">Loading standings...</div>
  }

  if (!standings?.standings?.length) {
    return <div className="text-center py-8 text-gray-500">No standings available</div>
  }

  // Group by division
  const byDivision = {}
  standings.standings.forEach(s => {
    if (!byDivision[s.divisionName]) byDivision[s.divisionName] = []
    byDivision[s.divisionName].push(s)
  })

  return (
    <div className="space-y-6">
      {Object.entries(byDivision).map(([divName, units]) => (
        <div key={divName} className="bg-white rounded-xl border overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 font-semibold">{divName}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Team</th>
                  <th className="px-4 py-2 text-center">W</th>
                  <th className="px-4 py-2 text-center">L</th>
                  <th className="px-4 py-2 text-center">GW</th>
                  <th className="px-4 py-2 text-center">GL</th>
                  <th className="px-4 py-2 text-center">+/-</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {units.map((unit, idx) => (
                  <tr key={unit.unitId} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {unit.finalPlacement || idx + 1}
                      {unit.finalPlacement === 1 && <Trophy className="w-4 h-4 text-yellow-500 inline ml-1" />}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{unit.unitName}</div>
                      <div className="text-xs text-gray-500">{unit.players.join(' / ')}</div>
                    </td>
                    <td className="px-4 py-2 text-center font-medium">{unit.matchesWon}</td>
                    <td className="px-4 py-2 text-center">{unit.matchesLost}</td>
                    <td className="px-4 py-2 text-center">{unit.gamesWon}</td>
                    <td className="px-4 py-2 text-center">{unit.gamesLost}</td>
                    <td className={`px-4 py-2 text-center font-medium ${
                      unit.pointDiff > 0 ? 'text-green-600' : unit.pointDiff < 0 ? 'text-red-600' : ''
                    }`}>
                      {unit.pointDiff > 0 ? '+' : ''}{unit.pointDiff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function BracketTab({ eventId, divisionId }) {
  const [bracket, setBracket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadBracket = async () => {
      try {
        const res = await scoreboardApi.getBracket(eventId, divisionId)
        if (res.success) setBracket(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadBracket()
  }, [eventId, divisionId])

  if (loading) {
    return <div className="text-center py-8">Loading bracket...</div>
  }

  if (!bracket?.rounds?.length) {
    return <div className="text-center py-8 text-gray-500">No bracket data available</div>
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max">
        {bracket.rounds.map(round => (
          <div key={round.roundNumber} className="w-64">
            <h3 className="font-semibold text-center mb-4">{round.roundName}</h3>
            <div className="space-y-4">
              {round.matches.map(match => (
                <div key={match.matchId} className="bg-white rounded-lg border overflow-hidden">
                  <div className={`px-3 py-2 border-b flex justify-between items-center ${
                    match.winnerUnitId === match.unit1Id ? 'bg-green-50' : ''
                  }`}>
                    <span className="font-medium truncate">
                      {match.unit1Seed && <span className="text-gray-400 mr-1">({match.unit1Seed})</span>}
                      {match.unit1Name || 'TBD'}
                    </span>
                    <span className="font-bold">{match.unit1GamesWon}</span>
                  </div>
                  <div className={`px-3 py-2 flex justify-between items-center ${
                    match.winnerUnitId === match.unit2Id ? 'bg-green-50' : ''
                  }`}>
                    <span className="font-medium truncate">
                      {match.unit2Seed && <span className="text-gray-400 mr-1">({match.unit2Seed})</span>}
                      {match.unit2Name || 'TBD'}
                    </span>
                    <span className="font-bold">{match.unit2GamesWon}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RegistrationsTab({ eventId, divisionId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const res = await scoreboardApi.getRegistrations(eventId, divisionId)
        if (res.success) setData(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [eventId, divisionId])

  if (loading) {
    return <div className="text-center py-8">Loading registrations...</div>
  }

  if (!data?.divisions?.length) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-600">No Registrations</h3>
        <p className="text-gray-500">No teams have registered yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {data.divisions.map(division => (
        <div key={division.divisionId} className="bg-white rounded-xl border overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold">{division.divisionName}</h3>
            <span className="text-sm text-gray-500">
              {division.unitCount} {division.unitCount === 1 ? 'team' : 'teams'}
            </span>
          </div>
          <div className="divide-y">
            {division.units.map((unit, idx) => (
              <div key={unit.unitId} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium text-sm">
                  {unit.seed || idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{unit.unitName}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {unit.players.map((p, i) => (
                      <span key={p.userId}>
                        {i > 0 && ' / '}
                        {p.name}
                        {p.isCaptain && <span className="text-xs text-blue-500 ml-1">(C)</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${
                  unit.status === 'Registered' || unit.status === 'Confirmed'
                    ? 'bg-green-100 text-green-700'
                    : unit.status === 'Waitlisted'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {unit.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ScheduleTab({ eventId, divisionId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewMode, setViewMode] = useState('time') // 'time' or 'court'

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const res = await scoreboardApi.getSchedule(eventId, { divisionId, date: selectedDate })
        if (res.success) setData(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [eventId, divisionId, selectedDate])

  if (loading) {
    return <div className="text-center py-8">Loading schedule...</div>
  }

  if (!data?.encounters?.length) {
    return (
      <div className="text-center py-12">
        <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-600">No Schedule</h3>
        <p className="text-gray-500">The schedule hasn't been created yet</p>
      </div>
    )
  }

  // Group encounters by time or court
  const groupedEncounters = viewMode === 'court'
    ? groupByCourt(data.encounters, data.courts)
    : groupByTime(data.encounters)

  return (
    <div className="space-y-4">
      {/* Date and view mode filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {data.scheduleDates.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedDate(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                !selectedDate ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Days
            </button>
            {data.scheduleDates.map(date => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  selectedDate === date ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setViewMode('time')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              viewMode === 'time' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            By Time
          </button>
          <button
            onClick={() => setViewMode('court')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              viewMode === 'court' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <MapPin className="w-4 h-4 inline mr-1" />
            By Court
          </button>
        </div>
      </div>

      {/* Courts summary */}
      {data.courts.length > 0 && (
        <div className="bg-white rounded-lg border p-3">
          <div className="text-sm font-medium text-gray-600 mb-2">Courts</div>
          <div className="flex flex-wrap gap-2">
            {data.courts.map(court => (
              <span key={court.courtId} className="px-2 py-1 bg-gray-100 rounded text-sm">
                {court.courtName}
                {court.location && <span className="text-gray-500 ml-1">({court.location})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Schedule content */}
      {viewMode === 'time' ? (
        <div className="space-y-4">
          {Object.entries(groupedEncounters).map(([timeKey, encounters]) => (
            <div key={timeKey} className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                {timeKey}
              </div>
              <div className="divide-y">
                {encounters.map(encounter => (
                  <ScheduleEncounterRow key={encounter.encounterId} encounter={encounter} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedEncounters).map(([courtName, encounters]) => (
            <div key={courtName} className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 font-medium text-sm flex items-center gap-2 text-blue-700">
                <MapPin className="w-4 h-4" />
                {courtName}
              </div>
              <div className="divide-y">
                {encounters.map(encounter => (
                  <ScheduleEncounterRow key={encounter.encounterId} encounter={encounter} showCourt={false} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleEncounterRow({ encounter, showCourt = true }) {
  const time = encounter.scheduledTime || encounter.estimatedStartTime
  const statusColors = {
    Scheduled: 'bg-gray-100 text-gray-700',
    Ready: 'bg-yellow-100 text-yellow-700',
    InProgress: 'bg-green-100 text-green-700',
    Completed: 'bg-blue-100 text-blue-700',
    Cancelled: 'bg-red-100 text-red-700'
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[encounter.status] || 'bg-gray-100'}`}>
            {encounter.status}
          </span>
          <span className="text-xs text-gray-500">{encounter.divisionName}</span>
          {encounter.roundName && (
            <span className="text-xs text-gray-400">• {encounter.roundName}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {time && (
            <span>
              {new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          {showCourt && encounter.courtName && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {encounter.courtName}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 font-medium ${encounter.winnerUnitId === encounter.unit1Id ? 'text-green-600' : ''}`}>
          {encounter.unit1Seed && <span className="text-gray-400 mr-1">({encounter.unit1Seed})</span>}
          {encounter.unit1Name || 'TBD'}
        </div>
        <span className="text-gray-400 text-sm">vs</span>
        <div className={`flex-1 text-right font-medium ${encounter.winnerUnitId === encounter.unit2Id ? 'text-green-600' : ''}`}>
          {encounter.unit2Name || 'TBD'}
          {encounter.unit2Seed && <span className="text-gray-400 ml-1">({encounter.unit2Seed})</span>}
        </div>
      </div>
      {encounter.encounterLabel && (
        <div className="text-xs text-gray-400 mt-1">{encounter.encounterLabel}</div>
      )}
    </div>
  )
}

function groupByTime(encounters) {
  const groups = {}
  encounters.forEach(encounter => {
    const time = encounter.scheduledTime || encounter.estimatedStartTime
    const key = time
      ? new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'Unscheduled'
    if (!groups[key]) groups[key] = []
    groups[key].push(encounter)
  })
  return groups
}

function groupByCourt(encounters, courts) {
  const groups = {}
  // Initialize with all courts
  courts.forEach(court => {
    groups[court.courtName] = []
  })
  groups['Unassigned'] = []

  encounters.forEach(encounter => {
    const key = encounter.courtName || 'Unassigned'
    if (!groups[key]) groups[key] = []
    groups[key].push(encounter)
  })

  // Remove empty groups except Unassigned if it has items
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0 && key !== 'Unassigned') {
      delete groups[key]
    }
  })
  if (groups['Unassigned']?.length === 0) {
    delete groups['Unassigned']
  }

  return groups
}

function SubscribeModal({ eventId, subscriptions, onSubscribe, onClose, onRefresh }) {
  const isSubscribedToEvent = subscriptions.some(s => s.subscriptionType === 'Event' && s.isActive)

  const handleUnsubscribe = async (id) => {
    try {
      await spectatorApi.unsubscribe(id)
      onRefresh()
    } catch (err) {
      alert('Failed to unsubscribe')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Notifications</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">All Event Updates</div>
              <div className="text-sm text-gray-500">Get notified for all games</div>
            </div>
            {isSubscribedToEvent ? (
              <button
                onClick={() => handleUnsubscribe(subscriptions.find(s => s.subscriptionType === 'Event')?.id)}
                className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
              >
                <BellOff className="w-4 h-4 inline mr-1" />
                Unsubscribe
              </button>
            ) : (
              <button
                onClick={() => onSubscribe('Event')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <Bell className="w-4 h-4 inline mr-1" />
                Subscribe
              </button>
            )}
          </div>

          {subscriptions.filter(s => s.subscriptionType !== 'Event').length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Your Subscriptions</h4>
              <div className="space-y-2">
                {subscriptions.filter(s => s.subscriptionType !== 'Event').map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="text-sm">
                      <span className="text-gray-500">{sub.subscriptionType}:</span> {sub.targetId}
                    </div>
                    <button
                      onClick={() => handleUnsubscribe(sub.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <BellOff className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
