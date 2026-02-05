/**
 * TournamentStructureEditor — Standalone, reusable tournament structure editor.
 *
 * Provides visual (list-based) and JSON editing modes for tournament phase structures.
 * Can be used standalone in any app — no dependency on pickleball-community API or routing.
 *
 * Props:
 *   value: string (JSON) — the structureJson to edit
 *   onChange: (jsonString: string) => void — called on every change
 *   mode: 'visual' | 'json' | 'both' (default: 'both') — which editor modes to show
 *   className: string — additional CSS classes for the wrapper
 *   compact: boolean — if true, reduces padding for embedding
 */
import { useState, useCallback, useEffect } from 'react'
import { Settings, Code, List } from 'lucide-react'
import ListPhaseEditor from './ListPhaseEditor'
import { parseStructureToVisual, serializeVisualToJson } from './structureEditorConstants'

export default function TournamentStructureEditor({
  value = '{"phases":[],"advancementRules":[]}',
  onChange,
  mode = 'both',
  className = '',
  compact = false
}) {
  const [editorMode, setEditorMode] = useState(mode === 'json' ? 'json' : 'visual')
  const [visualState, setVisualState] = useState(() => parseStructureToVisual(value))
  const [jsonText, setJsonText] = useState(value)
  const [jsonError, setJsonError] = useState(null)

  // Sync external value changes
  useEffect(() => {
    if (value !== jsonText) {
      setJsonText(value)
      setVisualState(parseStructureToVisual(value))
    }
  }, [value])

  const handleVisualChange = useCallback((newState) => {
    setVisualState(newState)
    const json = serializeVisualToJson(newState)
    setJsonText(json)
    onChange?.(json)
  }, [onChange])

  const handleJsonChange = useCallback((text) => {
    setJsonText(text)
    try {
      JSON.parse(text)
      setJsonError(null)
      onChange?.(text)
    } catch (e) {
      setJsonError(e.message)
    }
  }, [onChange])

  const handleToggleMode = useCallback(() => {
    if (editorMode === 'visual') {
      // Sync visual → json
      const json = serializeVisualToJson(visualState)
      setJsonText(json)
      setEditorMode('json')
    } else {
      // Sync json → visual
      try {
        const parsed = parseStructureToVisual(jsonText)
        setVisualState(parsed)
        setJsonError(null)
      } catch { /* keep current visual state */ }
      setEditorMode('visual')
    }
  }, [editorMode, visualState, jsonText])

  const showToggle = mode === 'both'
  const pad = compact ? 'p-2' : 'p-4'

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Mode toggle toolbar */}
      {showToggle && (
        <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button type="button"
              onClick={() => { if (editorMode !== 'visual') handleToggleMode() }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                editorMode === 'visual' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}>
              <Settings className="w-3.5 h-3.5" /> Visual Editor
            </button>
            <button type="button"
              onClick={() => { if (editorMode !== 'json') handleToggleMode() }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                editorMode === 'json' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}>
              <Code className="w-3.5 h-3.5" /> Raw JSON
            </button>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        {editorMode === 'visual' ? (
          <div className={pad}>
            <div className="max-w-4xl mx-auto border rounded-lg p-4 bg-white shadow-sm space-y-4">
              <ListPhaseEditor
                visualState={visualState}
                onChange={handleVisualChange}
              />
            </div>
          </div>
        ) : (
          <div className={pad}>
            <div className="max-w-4xl mx-auto">
              {jsonError && (
                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  JSON Error: {jsonError}
                </div>
              )}
              <textarea
                value={jsonText}
                onChange={e => handleJsonChange(e.target.value)}
                className="w-full h-96 px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder='{"phases": [...], "advancementRules": [...]}'
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Re-export everything for convenience
export {
  parseStructureToVisual,
  serializeVisualToJson,
  ListPhaseEditor
}
export {
  CATEGORIES, PHASE_TYPES, BRACKET_TYPES, SEEDING_STRATEGIES, AWARD_TYPES,
  DEFAULT_PHASE, DEFAULT_EXIT_POSITION, DEFAULT_ADVANCEMENT_RULE,
  PHASE_TYPE_COLORS, PHASE_TYPE_ICONS,
  autoGenerateRules
} from './structureEditorConstants'
