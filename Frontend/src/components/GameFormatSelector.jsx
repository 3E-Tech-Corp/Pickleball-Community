import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check, X, Settings, Plus, Loader2 } from 'lucide-react';
import { scoreFormatsApi, scoreMethodsApi } from '../services/api';

/**
 * GameFormatSelector - A reusable component for selecting/editing game formats
 *
 * Modes:
 * - Compact: Shows short display (e.g., "Rally 11-2") with click to expand
 * - Expanded: Shows full edit form with preset selection and custom options
 *
 * @param {Object} props
 * @param {number|null} props.value - Current score format ID
 * @param {function} props.onChange - Callback when format changes (receives formatId)
 * @param {number|null} props.eventId - Event ID for event-specific formats
 * @param {boolean} props.disabled - Whether the selector is disabled
 * @param {boolean} props.compact - Start in compact mode (default true)
 * @param {string} props.label - Label to show above selector
 * @param {string} props.placeholder - Placeholder when no format selected
 * @param {boolean} props.showCreateNew - Whether to show "Create New" option (default true)
 * @param {string} props.className - Additional CSS classes
 */
export default function GameFormatSelector({
  value,
  onChange,
  eventId = null,
  disabled = false,
  compact = true,
  label = 'Game Format',
  placeholder = 'Select format...',
  showCreateNew = true,
  className = ''
}) {
  // State
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [formats, setFormats] = useState([]);
  const [scoreMethods, setScoreMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Custom format form state
  const [customFormat, setCustomFormat] = useState({
    scoreMethodId: null,
    maxPoints: 11,
    winByMargin: 2,
    capAfter: 0,
    switchEndsAtMidpoint: false,
    midpointScore: null,
    timeLimitMinutes: null
  });

  // Load formats and score methods
  useEffect(() => {
    loadData();
  }, [eventId]);

  // Update selected format when value changes
  useEffect(() => {
    if (value && formats.length > 0) {
      const format = formats.find(f => f.id === value);
      setSelectedFormat(format || null);
    } else if (!value) {
      setSelectedFormat(null);
    }
  }, [value, formats]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [formatsRes, methodsRes] = await Promise.all([
        scoreFormatsApi.getAll({ eventId, presetsOnly: !eventId }),
        scoreMethodsApi.getAll()
      ]);

      if (formatsRes.data?.success !== false) {
        setFormats(formatsRes.data?.data || formatsRes.data || []);
      }
      if (methodsRes.data?.success !== false) {
        setScoreMethods(methodsRes.data?.data || methodsRes.data || []);
        // Set default score method for custom form
        const defaultMethod = (methodsRes.data?.data || methodsRes.data || []).find(m => m.isDefault);
        if (defaultMethod) {
          setCustomFormat(prev => ({ ...prev, scoreMethodId: defaultMethod.id }));
        }
      }
    } catch (err) {
      console.error('Error loading game formats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFormat = (format) => {
    setSelectedFormat(format);
    onChange?.(format.id);
    setShowCustomForm(false);
    if (compact) {
      setIsExpanded(false);
    }
  };

  const handleCreateCustom = async () => {
    setSaving(true);
    try {
      const response = await scoreFormatsApi.findOrCreate({
        scoreMethodId: customFormat.scoreMethodId,
        maxPoints: customFormat.maxPoints,
        winByMargin: customFormat.winByMargin,
        capAfter: customFormat.capAfter,
        switchEndsAtMidpoint: customFormat.switchEndsAtMidpoint,
        midpointScore: customFormat.switchEndsAtMidpoint ? customFormat.midpointScore : null,
        timeLimitMinutes: customFormat.timeLimitMinutes,
        eventId: eventId
      });

      if (response.data?.success !== false) {
        const newFormat = response.data?.data || response.data;
        // Refresh formats list
        await loadData();
        // Select the new/found format
        setSelectedFormat(newFormat);
        onChange?.(newFormat.id);
        setShowCustomForm(false);
        if (compact) {
          setIsExpanded(false);
        }
      }
    } catch (err) {
      console.error('Error creating format:', err);
    } finally {
      setSaving(false);
    }
  };

  const generateShortDisplay = useCallback((format) => {
    if (!format) return placeholder;
    return format.shortDisplay || format.name || `${format.scoringType} ${format.maxPoints}-${format.winByMargin}`;
  }, [placeholder]);

  // Compact view
  if (!isExpanded) {
    return (
      <div className={`${className}`}>
        {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
        <button
          type="button"
          onClick={() => !disabled && setIsExpanded(true)}
          disabled={disabled}
          className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left transition-colors ${
            disabled
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-white border-gray-300 hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          }`}
        >
          <span className={selectedFormat ? 'text-gray-900' : 'text-gray-500'}>
            {generateShortDisplay(selectedFormat)}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    );
  }

  // Expanded view
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{label}</span>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Preset Formats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preset Formats</label>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {formats.filter(f => f.isPreset).map(format => (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => handleSelectFormat(format)}
                    disabled={disabled}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                      selectedFormat?.id === format.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div>
                      <div className="font-medium text-sm">{format.name}</div>
                      <div className="text-xs text-gray-500">{format.shortDisplay}</div>
                    </div>
                    {selectedFormat?.id === format.id && (
                      <Check className="w-4 h-4 text-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Format Toggle */}
            {showCreateNew && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(!showCustomForm)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  {showCustomForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showCustomForm ? 'Cancel' : 'Custom Format'}
                </button>
              </div>
            )}

            {/* Custom Format Form */}
            {showCustomForm && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                {/* Score Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scoring Method</label>
                  <select
                    value={customFormat.scoreMethodId || ''}
                    onChange={(e) => setCustomFormat(prev => ({
                      ...prev,
                      scoreMethodId: e.target.value ? parseInt(e.target.value) : null
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {scoreMethods.map(method => (
                      <option key={method.id} value={method.id}>{method.name}</option>
                    ))}
                  </select>
                </div>

                {/* Play To / Win By / Cap */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Play To</label>
                    <select
                      value={customFormat.maxPoints}
                      onChange={(e) => setCustomFormat(prev => ({ ...prev, maxPoints: parseInt(e.target.value) }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[7, 9, 11, 15, 21].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Win By</label>
                    <select
                      value={customFormat.winByMargin}
                      onChange={(e) => setCustomFormat(prev => ({ ...prev, winByMargin: parseInt(e.target.value) }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[1, 2].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cap After</label>
                    <select
                      value={customFormat.capAfter}
                      onChange={(e) => setCustomFormat(prev => ({ ...prev, capAfter: parseInt(e.target.value) }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>No Cap</option>
                      {[2, 4, 6, 8].map(n => (
                        <option key={n} value={n}>+{n} (cap {customFormat.maxPoints + n})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Change Ends */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFormat.switchEndsAtMidpoint}
                      onChange={(e) => setCustomFormat(prev => ({
                        ...prev,
                        switchEndsAtMidpoint: e.target.checked,
                        midpointScore: e.target.checked ? Math.floor(prev.maxPoints / 2) : null
                      }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Change Ends</span>
                  </label>
                  {customFormat.switchEndsAtMidpoint && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">at</span>
                      <input
                        type="number"
                        value={customFormat.midpointScore || Math.floor(customFormat.maxPoints / 2)}
                        onChange={(e) => setCustomFormat(prev => ({ ...prev, midpointScore: parseInt(e.target.value) || null }))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        min={1}
                        max={customFormat.maxPoints - 1}
                      />
                    </div>
                  )}
                </div>

                {/* Time Limit */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFormat.timeLimitMinutes !== null}
                      onChange={(e) => setCustomFormat(prev => ({
                        ...prev,
                        timeLimitMinutes: e.target.checked ? 15 : null
                      }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Time Limit</span>
                  </label>
                  {customFormat.timeLimitMinutes !== null && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={customFormat.timeLimitMinutes}
                        onChange={(e) => setCustomFormat(prev => ({ ...prev, timeLimitMinutes: parseInt(e.target.value) || 15 }))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        min={5}
                        max={60}
                      />
                      <span className="text-sm text-gray-500">min</span>
                    </div>
                  )}
                </div>

                {/* Preview & Apply */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Preview: <span className="font-medium">
                      {scoreMethods.find(m => m.id === customFormat.scoreMethodId)?.name || 'Rally'} {customFormat.maxPoints}-{customFormat.winByMargin}
                      {customFormat.capAfter > 0 ? ` cap ${customFormat.maxPoints + customFormat.capAfter}` : ''}
                      {customFormat.switchEndsAtMidpoint ? ` switch@${customFormat.midpointScore || Math.floor(customFormat.maxPoints / 2)}` : ''}
                      {customFormat.timeLimitMinutes ? ` ${customFormat.timeLimitMinutes}min` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    disabled={saving || disabled}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Apply
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline version for use in tables/lists
 */
export function GameFormatBadge({ format, onClick, className = '' }) {
  if (!format) {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 ${className}`}
      >
        No format
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-blue-100 ${className}`}
    >
      {format.shortDisplay || format.name || `${format.maxPoints}-${format.winByMargin}`}
    </span>
  );
}
