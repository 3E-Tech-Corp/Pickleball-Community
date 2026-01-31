import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Clock, Loader2, RefreshCw, Zap, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Grid3X3, Plus,
  Trash2, Play, GripVertical, Move, Settings, Eye, Info, Layers
} from 'lucide-react'
import { tournamentApi } from '../services/api'
import { useToast } from '../contexts/ToastContext'

// Division color palette (distinct colors for visual differentiation)
const DIVISION_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', hex: '#3b82f6', light: '#dbeafe' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', hex: '#10b981', light: '#d1fae5' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', hex: '#8b5cf6', light: '#ede9fe' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', hex: '#f59e0b', light: '#fef3c7' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', hex: '#f43f5e', light: '#ffe4e6' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', hex: '#06b6d4', light: '#cffafe' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', hex: '#f97316', light: '#ffedd5' },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800', hex: '#6366f1', light: '#e0e7ff' },
]

function getDivisionColor(index) {
  return DIVISION_COLORS[index % DIVISION_COLORS.length]
}

// Format time for display
function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Format time as HH:MM for input
function formatTimeInput(date) {
  if (!date) return ''
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AutoScheduler() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [gridData, setGridData] = useState(null)
  const [generating, setGenerating] = useState(false)

  // Block allocation state
  const [blocks, setBlocks] = useState([])
  const [showBlockForm, setShowBlockForm] = useState(false)

  // Grid interaction state
  const [selectedEncounter, setSelectedEncounter] = useState(null)
  const [movingEncounter, setMovingEncounter] = useState(null)
  const [hoveredSlot, setHoveredSlot] = useState(null)

  // View state
  const [activeTab, setActiveTab] = useState('grid') // 'blocks', 'grid', 'unscheduled'
  const [timeIncrement, setTimeIncrement] = useState(15) // minutes per row
  const [showConflicts, setShowConflicts] = useState(true)
  const [filterDivision, setFilterDivision] = useState(null)

  // Division color map
  const divisionColorMap = useMemo(() => {
    const map = {}
    gridData?.divisions?.forEach((div, idx) => {
      map[div.id] = getDivisionColor(idx)
    })
    return map
  }, [gridData?.divisions])

  // Load grid data
  const loadGrid = useCallback(async () => {
    try {
      setLoading(true)
      const res = await tournamentApi.schedulingGetGrid(eventId)
      if (res.success) {
        setGridData(res.data)
        // Initialize blocks from existing court assignments
        if (res.data.blocks?.length > 0) {
          setBlocks(res.data.blocks.map(b => ({
            id: b.id,
            divisionId: b.divisionId,
            phaseId: b.phaseId,
            courtGroupId: b.courtGroupId,
            courtIds: b.courtIds || [],
            startTime: b.validFromTime || '08:00',
            endTime: b.validToTime || '18:00'
          })))
        }
      }
    } catch (err) {
      console.error('Error loading grid data:', err)
      toast.error('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    loadGrid()
  }, [eventId])

  // Generate time slots for the grid
  const timeSlots = useMemo(() => {
    if (!gridData) return []
    const slots = []
    const start = new Date(gridData.gridStartTime)
    const end = new Date(gridData.gridEndTime)
    const current = new Date(start)
    while (current < end) {
      slots.push(new Date(current))
      current.setMinutes(current.getMinutes() + timeIncrement)
    }
    return slots
  }, [gridData, timeIncrement])

  // Build encounter map by court and time
  const encounterGrid = useMemo(() => {
    if (!gridData) return {}
    const grid = {}
    gridData.encounters
      .filter(e => e.courtId && e.startTime)
      .filter(e => !filterDivision || e.divisionId === filterDivision)
      .forEach(enc => {
        if (!grid[enc.courtId]) grid[enc.courtId] = []
        grid[enc.courtId].push(enc)
      })
    return grid
  }, [gridData, filterDivision])

  // Unscheduled encounters
  const unscheduledEncounters = useMemo(() => {
    if (!gridData) return []
    return gridData.encounters
      .filter(e => !e.courtId || !e.startTime)
      .filter(e => !filterDivision || e.divisionId === filterDivision)
  }, [gridData, filterDivision])

  // Detect conflicts
  const conflicts = useMemo(() => {
    if (!gridData) return []
    const issues = []
    const courts = gridData.courts || []

    // Check each court for overlaps
    for (const court of courts) {
      const courtEncs = (encounterGrid[court.id] || [])
        .filter(e => e.startTime && e.endTime)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

      for (let i = 0; i < courtEncs.length - 1; i++) {
        const current = courtEncs[i]
        const next = courtEncs[i + 1]
        const currentEnd = new Date(current.endTime)
        const nextStart = new Date(next.startTime)
        if (currentEnd > nextStart) {
          issues.push({
            type: 'CourtOverlap',
            courtLabel: court.label,
            enc1: current,
            enc2: next,
            message: `Court ${court.label}: "${current.unit1Name || '?'} vs ${current.unit2Name || '?'}" overlaps with "${next.unit1Name || '?'} vs ${next.unit2Name || '?'}"`
          })
        }
      }
    }

    // Check player overlaps (same player in two encounters at same time)
    // This is detected server-side, but we flag encounters that have server-side conflicts
    return issues
  }, [encounterGrid, gridData])

  const conflictEncounterIds = useMemo(() => {
    const ids = new Set()
    conflicts.forEach(c => {
      if (c.enc1) ids.add(c.enc1.id)
      if (c.enc2) ids.add(c.enc2.id)
    })
    return ids
  }, [conflicts])

  // Handle auto-allocate
  const handleAutoAllocate = async () => {
    if (blocks.length === 0) {
      toast.warn('Add at least one time block allocation first')
      setActiveTab('blocks')
      return
    }

    try {
      setGenerating(true)

      // Build allocation request from blocks
      const eventDate = new Date(gridData.eventDate)
      const allocations = blocks.map(block => {
        const [startH, startM] = block.startTime.split(':').map(Number)
        const [endH, endM] = block.endTime.split(':').map(Number)

        const startDateTime = new Date(eventDate)
        startDateTime.setHours(startH, startM, 0, 0)
        const endDateTime = new Date(eventDate)
        endDateTime.setHours(endH, endM, 0, 0)

        return {
          divisionId: block.divisionId,
          phaseId: block.phaseId || null,
          courtIds: block.courtIds,
          courtGroupId: block.courtGroupId || null,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString()
        }
      })

      const res = await tournamentApi.schedulingAutoAllocate({
        eventId: parseInt(eventId),
        blocks: allocations,
        clearExisting: true,
        respectPlayerOverlap: true
      })

      if (res.success) {
        toast.success(res.message || `Auto-allocated ${res.data?.totalAssigned || 0} matches`)
        if (res.data?.totalSkipped > 0) {
          toast.warn(`${res.data.totalSkipped} matches could not be scheduled within their time blocks`)
        }
        loadGrid()
        setActiveTab('grid')
      } else {
        toast.error(res.message || 'Auto-allocation failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Auto-allocation failed')
    } finally {
      setGenerating(false)
    }
  }

  // Handle move encounter (click to select, click on grid to place)
  const handleMoveEncounter = async (encounterId, courtId, startTime) => {
    try {
      const res = await tournamentApi.schedulingMoveEncounter(encounterId, {
        courtId,
        startTime: startTime.toISOString()
      })

      if (res.success) {
        if (res.data?.hasConflicts) {
          toast.warn(res.message)
        } else {
          toast.success('Match moved')
        }
        loadGrid()
      }
    } catch (err) {
      toast.error('Failed to move match')
    } finally {
      setMovingEncounter(null)
    }
  }

  // Handle grid cell click for placing a moving encounter
  const handleGridCellClick = (courtId, slotTime) => {
    if (movingEncounter) {
      handleMoveEncounter(movingEncounter.id, courtId, slotTime)
    }
  }

  if (loading && !gridData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to={`/tournament/${eventId}/manage`}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Auto Scheduler</h1>
                <p className="text-sm text-gray-500">{gridData?.eventName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Stats badges */}
              <div className="hidden sm:flex items-center gap-3 mr-4 text-sm">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                  {gridData?.scheduledEncounters || 0} scheduled
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  {gridData?.unscheduledEncounters || 0} unscheduled
                </span>
                {conflicts.length > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full">
                    {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <button
                onClick={handleAutoAllocate}
                disabled={generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Auto-Schedule
              </button>

              <button
                onClick={loadGrid}
                disabled={loading}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-full mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto">
            {[
              { key: 'blocks', label: 'Time Blocks', icon: Layers, badge: blocks.length || null },
              { key: 'grid', label: 'Schedule Grid', icon: Grid3X3 },
              { key: 'unscheduled', label: 'Unscheduled', icon: AlertTriangle, badge: unscheduledEncounters.length || null },
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
                {tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Moving encounter indicator */}
      {movingEncounter && (
        <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4" />
            <span>
              Moving: <strong>{movingEncounter.unit1Name || 'TBD'} vs {movingEncounter.unit2Name || 'TBD'}</strong>
              — Click a time slot on the grid to place it
            </span>
          </div>
          <button
            onClick={() => setMovingEncounter(null)}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Content */}
      <div className="max-w-full mx-auto px-4 py-4">
        {activeTab === 'blocks' && (
          <BlockAllocationTab
            gridData={gridData}
            blocks={blocks}
            setBlocks={setBlocks}
            divisionColorMap={divisionColorMap}
            onAutoAllocate={handleAutoAllocate}
            generating={generating}
          />
        )}

        {activeTab === 'grid' && (
          <ScheduleGridTab
            gridData={gridData}
            timeSlots={timeSlots}
            encounterGrid={encounterGrid}
            divisionColorMap={divisionColorMap}
            conflictEncounterIds={conflictEncounterIds}
            conflicts={conflicts}
            showConflicts={showConflicts}
            setShowConflicts={setShowConflicts}
            filterDivision={filterDivision}
            setFilterDivision={setFilterDivision}
            timeIncrement={timeIncrement}
            setTimeIncrement={setTimeIncrement}
            selectedEncounter={selectedEncounter}
            setSelectedEncounter={setSelectedEncounter}
            movingEncounter={movingEncounter}
            setMovingEncounter={setMovingEncounter}
            onGridCellClick={handleGridCellClick}
            blocks={blocks}
          />
        )}

        {activeTab === 'unscheduled' && (
          <UnscheduledTab
            encounters={unscheduledEncounters}
            gridData={gridData}
            divisionColorMap={divisionColorMap}
            onMoveEncounter={(enc) => {
              setMovingEncounter(enc)
              setActiveTab('grid')
              toast.info('Click a time slot on the grid to place this match')
            }}
          />
        )}
      </div>
    </div>
  )
}

// =====================================================
// Block Allocation Tab
// =====================================================
function BlockAllocationTab({ gridData, blocks, setBlocks, divisionColorMap, onAutoAllocate, generating }) {
  const [editingBlock, setEditingBlock] = useState(null)
  const [newBlock, setNewBlock] = useState({
    divisionId: '',
    phaseId: '',
    courtGroupId: '',
    courtIds: [],
    startTime: '08:00',
    endTime: '12:00'
  })

  // Get court groups from grid data
  const courtGroups = useMemo(() => {
    const groups = {}
    gridData?.blocks?.forEach(b => {
      if (!groups[b.courtGroupId]) {
        groups[b.courtGroupId] = {
          id: b.courtGroupId,
          name: b.courtGroupName,
          courtIds: b.courtIds
        }
      }
    })
    // Also pull from existing assignments
    return Object.values(groups)
  }, [gridData])

  const addBlock = () => {
    if (!newBlock.divisionId) return

    const division = gridData?.divisions?.find(d => d.id === parseInt(newBlock.divisionId))

    // Resolve court IDs
    let courtIds = newBlock.courtIds
    if (newBlock.courtGroupId && courtIds.length === 0) {
      const group = courtGroups.find(g => g.id === parseInt(newBlock.courtGroupId))
      courtIds = group?.courtIds || []
    }
    if (courtIds.length === 0) {
      // Use all courts
      courtIds = gridData?.courts?.map(c => c.id) || []
    }

    setBlocks(prev => [...prev, {
      id: Date.now(),
      divisionId: parseInt(newBlock.divisionId),
      phaseId: newBlock.phaseId ? parseInt(newBlock.phaseId) : null,
      courtGroupId: newBlock.courtGroupId ? parseInt(newBlock.courtGroupId) : null,
      courtIds,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime
    }])

    setNewBlock({
      divisionId: '',
      phaseId: '',
      courtGroupId: '',
      courtIds: [],
      startTime: newBlock.endTime, // Chain next block
      endTime: (() => {
        const [h, m] = newBlock.endTime.split(':').map(Number)
        const endH = Math.min(h + 4, 20)
        return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      })()
    })
  }

  const removeBlock = (blockId) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId))
  }

  const selectedDivision = gridData?.divisions?.find(d => d.id === parseInt(newBlock.divisionId))

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How Auto-Scheduling Works</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Assign <strong>courts + time windows</strong> to each division (and phase)</li>
            <li>Click <strong>"Auto-Schedule"</strong> — the system places matches within those blocks</li>
            <li>It avoids player conflicts (same player can't be on two courts at once)</li>
            <li>Switch to <strong>Schedule Grid</strong> to view and manually adjust</li>
          </ol>
        </div>
      </div>

      {/* Add new block */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Time Block Allocation
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Division */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Division *</label>
            <select
              value={newBlock.divisionId}
              onChange={(e) => setNewBlock(prev => ({ ...prev, divisionId: e.target.value, phaseId: '' }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select division...</option>
              {gridData?.divisions?.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Phase (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase (optional)</label>
            <select
              value={newBlock.phaseId}
              onChange={(e) => setNewBlock(prev => ({ ...prev, phaseId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!selectedDivision?.phases?.length}
            >
              <option value="">All phases</option>
              {selectedDivision?.phases?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Courts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Courts</label>
            {courtGroups.length > 0 ? (
              <select
                value={newBlock.courtGroupId}
                onChange={(e) => {
                  const gid = e.target.value
                  const group = courtGroups.find(g => g.id === parseInt(gid))
                  setNewBlock(prev => ({
                    ...prev,
                    courtGroupId: gid,
                    courtIds: group?.courtIds || []
                  }))
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All courts</option>
                {courtGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.courtIds?.length || 0} courts)</option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {gridData?.courts?.map(c => (
                  <label key={c.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={newBlock.courtIds.includes(c.id)}
                      onChange={(e) => {
                        setNewBlock(prev => ({
                          ...prev,
                          courtIds: e.target.checked
                            ? [...prev.courtIds, c.id]
                            : prev.courtIds.filter(id => id !== c.id)
                        }))
                      }}
                      className="w-4 h-4 rounded"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={newBlock.startTime}
              onChange={(e) => setNewBlock(prev => ({ ...prev, startTime: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              value={newBlock.endTime}
              onChange={(e) => setNewBlock(prev => ({ ...prev, endTime: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Add button */}
          <div className="flex items-end">
            <button
              onClick={addBlock}
              disabled={!newBlock.divisionId}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Block
            </button>
          </div>
        </div>
      </div>

      {/* Current blocks */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Time Block Allocations ({blocks.length})
          </h3>
          {blocks.length > 0 && (
            <button
              onClick={onAutoAllocate}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Auto-Schedule All
            </button>
          )}
        </div>

        {blocks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p>No time blocks configured</p>
            <p className="text-sm">Add blocks above to assign court + time windows to divisions</p>
          </div>
        ) : (
          <div className="divide-y">
            {blocks.map((block, idx) => {
              const division = gridData?.divisions?.find(d => d.id === block.divisionId)
              const phase = division?.phases?.find(p => p.id === block.phaseId)
              const color = divisionColorMap[block.divisionId] || DIVISION_COLORS[0]
              const courts = (block.courtIds || []).map(cid =>
                gridData?.courts?.find(c => c.id === cid)
              ).filter(Boolean)

              // Count encounters for this block
              const blockEncounterCount = gridData?.encounters?.filter(e =>
                e.divisionId === block.divisionId &&
                (!block.phaseId || e.phaseId === block.phaseId)
              ).length || 0

              return (
                <div key={block.id || idx} className="p-4 flex items-center gap-4">
                  <div className={`w-3 h-12 rounded-full ${color.bg} ${color.border} border-2`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {division?.name || 'Unknown Division'}
                      {phase && <span className="text-gray-500 font-normal ml-1">→ {phase.name}</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {block.startTime} – {block.endTime}
                      </span>
                      <span className="mx-2">•</span>
                      <span>{courts.length > 0 ? courts.map(c => c.label).join(', ') : 'All courts'}</span>
                      <span className="mx-2">•</span>
                      <span>{blockEncounterCount} matches</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeBlock(block.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Remove block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Visual Block Preview */}
      {blocks.length > 0 && gridData?.courts?.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-900">Block Preview</h3>
          </div>
          <div className="p-4">
            <BlockPreview blocks={blocks} gridData={gridData} divisionColorMap={divisionColorMap} />
          </div>
        </div>
      )}
    </div>
  )
}

// Visual preview of block allocations on a mini timeline
function BlockPreview({ blocks, gridData, divisionColorMap }) {
  // Find overall time range from blocks
  const allTimes = blocks.flatMap(b => [b.startTime, b.endTime])
  const minHour = Math.min(...allTimes.map(t => parseInt(t.split(':')[0])))
  const maxHour = Math.max(...allTimes.map(t => parseInt(t.split(':')[0]))) + 1
  const totalMinutes = (maxHour - minHour) * 60

  // Generate hour labels
  const hours = []
  for (let h = minHour; h <= maxHour; h++) {
    hours.push(h)
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Time header */}
        <div className="flex mb-2">
          <div className="w-28 flex-shrink-0" />
          <div className="flex-1 flex relative">
            {hours.map(h => (
              <div
                key={h}
                className="text-xs text-gray-400"
                style={{ width: `${(60 / totalMinutes) * 100}%` }}
              >
                {h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}
              </div>
            ))}
          </div>
        </div>

        {/* Court rows */}
        {gridData.courts.map(court => {
          const courtBlocks = blocks.filter(b =>
            b.courtIds.length === 0 || b.courtIds.includes(court.id)
          )

          return (
            <div key={court.id} className="flex items-center mb-1">
              <div className="w-28 flex-shrink-0 text-sm font-medium text-gray-600 pr-2 text-right truncate">
                {court.label}
              </div>
              <div className="flex-1 h-8 bg-gray-50 rounded relative border">
                {courtBlocks.map((block, idx) => {
                  const [startH, startM] = block.startTime.split(':').map(Number)
                  const [endH, endM] = block.endTime.split(':').map(Number)
                  const startOffset = ((startH - minHour) * 60 + startM) / totalMinutes * 100
                  const width = ((endH - startH) * 60 + (endM - startM)) / totalMinutes * 100
                  const color = divisionColorMap[block.divisionId] || DIVISION_COLORS[0]
                  const division = gridData.divisions?.find(d => d.id === block.divisionId)

                  return (
                    <div
                      key={idx}
                      className={`absolute top-0.5 bottom-0.5 rounded ${color.bg} ${color.border} border overflow-hidden`}
                      style={{ left: `${startOffset}%`, width: `${width}%` }}
                      title={`${division?.name}: ${block.startTime} - ${block.endTime}`}
                    >
                      <div className={`text-[10px] px-1 truncate ${color.text} font-medium leading-7`}>
                        {division?.name?.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// Schedule Grid Tab
// =====================================================
function ScheduleGridTab({
  gridData, timeSlots, encounterGrid, divisionColorMap,
  conflictEncounterIds, conflicts, showConflicts, setShowConflicts,
  filterDivision, setFilterDivision, timeIncrement, setTimeIncrement,
  selectedEncounter, setSelectedEncounter,
  movingEncounter, setMovingEncounter, onGridCellClick, blocks
}) {
  const gridRef = useRef(null)

  if (!gridData?.courts?.length || timeSlots.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <Grid3X3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No courts or schedule data available</p>
        <p className="text-sm text-gray-400">Set up courts and generate a schedule first</p>
      </div>
    )
  }

  const COURT_COL_WIDTH = 160 // px per court
  const ROW_HEIGHT = 40 // px per time slot

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Division filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Division:</label>
            <select
              value={filterDivision || ''}
              onChange={(e) => setFilterDivision(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Divisions</option>
              {gridData.divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Time increment */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Grid:</label>
            <select
              value={timeIncrement}
              onChange={(e) => setTimeIncrement(parseInt(e.target.value))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
            </select>
          </div>

          {/* Show conflicts */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showConflicts}
              onChange={(e) => setShowConflicts(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Show conflicts
          </label>

          {/* Legend */}
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-xs">
            {gridData.divisions
              .filter(d => !filterDivision || d.id === filterDivision)
              .map(d => {
                const color = divisionColorMap[d.id]
                return (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${color?.bg} ${color?.border} border`} />
                    <span className="text-gray-600">{d.name}</span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Conflicts banner */}
      {showConflicts && conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <XCircle className="w-5 h-5" />
            {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {conflicts.map((c, idx) => (
              <div key={idx} className="text-sm text-red-700">{c.message}</div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]" ref={gridRef}>
          <div style={{ minWidth: `${120 + gridData.courts.length * COURT_COL_WIDTH}px` }}>
            {/* Header row - court labels */}
            <div className="flex sticky top-0 z-10 bg-white border-b">
              <div className="w-[120px] flex-shrink-0 px-3 py-3 bg-gray-50 border-r font-medium text-sm text-gray-600 sticky left-0 z-20">
                Time
              </div>
              {gridData.courts.map(court => (
                <div
                  key={court.id}
                  className="px-3 py-3 bg-gray-50 border-r font-medium text-sm text-gray-700 text-center"
                  style={{ width: `${COURT_COL_WIDTH}px`, minWidth: `${COURT_COL_WIDTH}px` }}
                >
                  {court.label}
                </div>
              ))}
            </div>

            {/* Time rows */}
            {timeSlots.map((slot, slotIdx) => {
              const isHour = slot.getMinutes() === 0
              return (
                <div
                  key={slotIdx}
                  className={`flex ${isHour ? 'border-t border-gray-300' : 'border-t border-gray-100'}`}
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  {/* Time label */}
                  <div className={`w-[120px] flex-shrink-0 px-3 flex items-center text-xs border-r sticky left-0 bg-white z-10 ${
                    isHour ? 'font-medium text-gray-700' : 'text-gray-400'
                  }`}>
                    {formatTime(slot)}
                  </div>

                  {/* Court cells */}
                  {gridData.courts.map(court => {
                    // Find encounter that occupies this cell
                    const courtEncounters = encounterGrid[court.id] || []
                    const cellTime = slot.getTime()
                    const cellEndTime = cellTime + timeIncrement * 60 * 1000

                    // Find encounter that starts in this slot
                    const startingEnc = courtEncounters.find(enc => {
                      const encStart = new Date(enc.startTime).getTime()
                      return encStart >= cellTime && encStart < cellEndTime
                    })

                    // Find encounter that spans this slot (started earlier)
                    const spanningEnc = !startingEnc && courtEncounters.find(enc => {
                      const encStart = new Date(enc.startTime).getTime()
                      const encEnd = new Date(enc.endTime).getTime()
                      return encStart < cellTime && encEnd > cellTime
                    })

                    // Check if this slot is within a block allocation
                    const slotInBlock = blocks.some(b => {
                      if (b.courtIds.length > 0 && !b.courtIds.includes(court.id)) return false
                      const [bStartH, bStartM] = b.startTime.split(':').map(Number)
                      const [bEndH, bEndM] = b.endTime.split(':').map(Number)
                      const bStartMin = bStartH * 60 + bStartM
                      const bEndMin = bEndH * 60 + bEndM
                      const slotMin = slot.getHours() * 60 + slot.getMinutes()
                      return slotMin >= bStartMin && slotMin < bEndMin
                    })

                    if (startingEnc) {
                      const color = divisionColorMap[startingEnc.divisionId] || DIVISION_COLORS[0]
                      const duration = startingEnc.durationMinutes || 20
                      const spans = Math.max(1, Math.ceil(duration / timeIncrement))
                      const hasConflict = conflictEncounterIds.has(startingEnc.id)
                      const isSelected = selectedEncounter?.id === startingEnc.id
                      const isMoving = movingEncounter?.id === startingEnc.id

                      return (
                        <div
                          key={court.id}
                          className="border-r relative"
                          style={{ width: `${COURT_COL_WIDTH}px`, minWidth: `${COURT_COL_WIDTH}px` }}
                        >
                          <div
                            className={`absolute inset-x-1 top-0.5 rounded-md px-2 py-1 cursor-pointer transition-all
                              ${color.bg} ${color.border} border
                              ${hasConflict && showConflicts ? 'ring-2 ring-red-500 ring-offset-1' : ''}
                              ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg' : ''}
                              ${isMoving ? 'opacity-50' : 'hover:shadow-md'}
                            `}
                            style={{ height: `${spans * ROW_HEIGHT - 4}px`, zIndex: isSelected ? 5 : 2 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (movingEncounter) return // Don't select while moving
                              setSelectedEncounter(selectedEncounter?.id === startingEnc.id ? null : startingEnc)
                            }}
                          >
                            <div className={`text-xs font-semibold truncate ${color.text}`}>
                              {startingEnc.unit1Name?.split('/')[0]?.trim() || 'TBD'} vs {startingEnc.unit2Name?.split('/')[0]?.trim() || 'TBD'}
                            </div>
                            {spans > 1 && (
                              <div className={`text-[10px] ${color.text} opacity-75 truncate`}>
                                {startingEnc.encounterLabel || startingEnc.roundName || `R${startingEnc.roundNumber}`}
                                {startingEnc.phaseName && ` · ${startingEnc.phaseName}`}
                              </div>
                            )}
                            {hasConflict && showConflicts && (
                              <AlertTriangle className="absolute top-1 right-1 w-3 h-3 text-red-600" />
                            )}
                          </div>
                        </div>
                      )
                    }

                    if (spanningEnc) {
                      // Cell is spanned by an encounter starting earlier - render empty
                      return (
                        <div
                          key={court.id}
                          className="border-r"
                          style={{ width: `${COURT_COL_WIDTH}px`, minWidth: `${COURT_COL_WIDTH}px` }}
                        />
                      )
                    }

                    // Empty cell - clickable for placing
                    return (
                      <div
                        key={court.id}
                        className={`border-r transition-colors cursor-pointer
                          ${movingEncounter ? 'hover:bg-blue-50' : 'hover:bg-gray-50'}
                          ${slotInBlock ? 'bg-gray-50/50' : ''}
                        `}
                        style={{ width: `${COURT_COL_WIDTH}px`, minWidth: `${COURT_COL_WIDTH}px` }}
                        onClick={() => onGridCellClick(court.id, slot)}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected encounter details */}
      {selectedEncounter && (
        <EncounterDetailPanel
          encounter={selectedEncounter}
          gridData={gridData}
          divisionColorMap={divisionColorMap}
          onMove={() => {
            setMovingEncounter(selectedEncounter)
            setSelectedEncounter(null)
          }}
          onClose={() => setSelectedEncounter(null)}
        />
      )}
    </div>
  )
}

// =====================================================
// Encounter Detail Panel (shown when selecting an encounter on grid)
// =====================================================
function EncounterDetailPanel({ encounter, gridData, divisionColorMap, onMove, onClose }) {
  const division = gridData?.divisions?.find(d => d.id === encounter.divisionId)
  const color = divisionColorMap[encounter.divisionId] || DIVISION_COLORS[0]

  return (
    <div className="bg-white rounded-xl border shadow-lg p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${color.bg} ${color.border} border`} />
            <span className="text-sm font-medium text-gray-500">{division?.name}</span>
            {encounter.phaseName && (
              <span className="text-sm text-gray-400">→ {encounter.phaseName}</span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {encounter.unit1Name || 'TBD'} vs {encounter.unit2Name || 'TBD'}
          </h3>
          <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
            {encounter.encounterLabel && <span>{encounter.encounterLabel}</span>}
            {encounter.roundName && <span>{encounter.roundName}</span>}
            {encounter.courtLabel && (
              <span className="flex items-center gap-1">
                <Grid3X3 className="w-3.5 h-3.5" />
                {encounter.courtLabel}
              </span>
            )}
            {encounter.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(encounter.startTime)} – {formatTime(encounter.endTime)}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              encounter.status === 'Completed' ? 'bg-green-100 text-green-800' :
              encounter.status === 'InProgress' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-700'
            }`}>
              {encounter.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMove}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Move className="w-3.5 h-3.5" />
            Move
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// Unscheduled Tab
// =====================================================
function UnscheduledTab({ encounters, gridData, divisionColorMap, onMoveEncounter }) {
  // Group by division
  const byDivision = {}
  encounters.forEach(enc => {
    if (!byDivision[enc.divisionId]) {
      const div = gridData?.divisions?.find(d => d.id === enc.divisionId)
      byDivision[enc.divisionId] = {
        division: div,
        encounters: []
      }
    }
    byDivision[enc.divisionId].encounters.push(enc)
  })

  if (encounters.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
        <p className="text-gray-700 font-medium">All matches are scheduled!</p>
        <p className="text-sm text-gray-500">Every encounter has a court and time assigned</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">{encounters.length} match{encounters.length !== 1 ? 'es' : ''} need scheduling</p>
          <p>Click "Move to Grid" to manually place a match, or set up time blocks and auto-schedule.</p>
        </div>
      </div>

      {Object.entries(byDivision).map(([divId, { division, encounters: divEncs }]) => {
        const color = divisionColorMap[parseInt(divId)] || DIVISION_COLORS[0]

        return (
          <div key={divId} className="bg-white rounded-xl border overflow-hidden">
            <div className={`px-4 py-3 border-b flex items-center gap-2 ${color.bg}`}>
              <div className={`w-3 h-3 rounded-full ${color.border} border-2`} />
              <h3 className={`font-medium ${color.text}`}>
                {division?.name || 'Unknown Division'} ({divEncs.length})
              </h3>
            </div>
            <div className="divide-y">
              {divEncs.map(enc => (
                <div key={enc.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {enc.unit1Name || 'TBD'} vs {enc.unit2Name || 'TBD'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {enc.encounterLabel || enc.roundName || `Round ${enc.roundNumber}`}
                      {enc.phaseName && ` · ${enc.phaseName}`}
                    </div>
                  </div>
                  <button
                    onClick={() => onMoveEncounter(enc)}
                    className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1.5"
                  >
                    <Move className="w-3.5 h-3.5" />
                    Place on Grid
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
