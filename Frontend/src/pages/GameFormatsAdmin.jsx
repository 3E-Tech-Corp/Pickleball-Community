import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Check, X, Loader2, Search, ChevronDown, ChevronUp,
  Settings, AlertCircle, Star, ToggleLeft, ToggleRight
} from 'lucide-react';
import { scoreFormatsApi, scoreMethodsApi } from '../services/api';

/**
 * Admin page for managing Game Format presets
 */
export default function GameFormatsAdmin({ embedded = false }) {
  const [formats, setFormats] = useState([]);
  const [scoreMethods, setScoreMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFormat, setEditingFormat] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scoreMethodId: null,
    maxPoints: 11,
    winByMargin: 2,
    capAfter: 0,
    switchEndsAtMidpoint: false,
    midpointScore: null,
    timeLimitMinutes: null,
    isTiebreaker: false,
    sortOrder: 0,
    isActive: true,
    isDefault: false
  });

  useEffect(() => {
    loadData();
  }, [showInactive]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [formatsRes, methodsRes] = await Promise.all([
        scoreFormatsApi.getAll({ includeInactive: showInactive }),
        scoreMethodsApi.getAll()
      ]);

      if (formatsRes.data?.success !== false) {
        setFormats(formatsRes.data?.data || formatsRes.data || []);
      }
      if (methodsRes.data?.success !== false) {
        setScoreMethods(methodsRes.data?.data || methodsRes.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load game formats');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    const defaultMethod = scoreMethods.find(m => m.isDefault);
    setEditingFormat(null);
    setFormData({
      name: '',
      description: '',
      scoreMethodId: defaultMethod?.id || null,
      maxPoints: 11,
      winByMargin: 2,
      capAfter: 0,
      switchEndsAtMidpoint: false,
      midpointScore: null,
      timeLimitMinutes: null,
      isTiebreaker: false,
      sortOrder: formats.length * 10,
      isActive: true,
      isDefault: false
    });
    setIsModalOpen(true);
  };

  const handleEdit = (format) => {
    setEditingFormat(format);
    setFormData({
      name: format.name || '',
      description: format.description || '',
      scoreMethodId: format.scoreMethodId,
      maxPoints: format.maxPoints,
      winByMargin: format.winByMargin,
      capAfter: format.capAfter,
      switchEndsAtMidpoint: format.switchEndsAtMidpoint,
      midpointScore: format.midpointScore,
      timeLimitMinutes: format.timeLimitMinutes,
      isTiebreaker: format.isTiebreaker,
      sortOrder: format.sortOrder,
      isActive: format.isActive,
      isDefault: format.isDefault
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a name');
      return;
    }

    setSaving(true);
    try {
      if (editingFormat) {
        await scoreFormatsApi.update(editingFormat.id, formData);
      } else {
        await scoreFormatsApi.create({
          ...formData,
          isPreset: true
        });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving format:', err);
      alert('Failed to save format');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (format) => {
    if (!confirm(`Delete "${format.name}"? If it's in use, it will be deactivated instead.`)) {
      return;
    }

    setDeleting(format.id);
    try {
      await scoreFormatsApi.delete(format.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting format:', err);
      alert('Failed to delete format');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (format) => {
    try {
      await scoreFormatsApi.update(format.id, { isActive: !format.isActive });
      await loadData();
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  const handleSetDefault = async (format) => {
    try {
      await scoreFormatsApi.update(format.id, { isDefault: true });
      await loadData();
    } catch (err) {
      console.error('Error setting default:', err);
    }
  };

  // Filter formats
  const filteredFormats = formats.filter(f => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.name?.toLowerCase().includes(query) ||
        f.shortDisplay?.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const containerClass = embedded
    ? ''
    : 'min-h-screen bg-gray-50 p-6';

  return (
    <div className={containerClass}>
      <div className={embedded ? '' : 'max-w-6xl mx-auto'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Game Formats</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage preset scoring formats for games
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Format
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search formats..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            Show inactive
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 mb-6 bg-red-50 text-red-700 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          /* Formats Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFormats.map(format => (
              <div
                key={format.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  !format.isActive ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{format.name}</h3>
                      {format.isDefault && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{format.shortDisplay}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(format)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(format)}
                      disabled={deleting === format.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === format.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Method:</span>
                    <span className="font-medium">{format.scoreMethodName || format.scoringType}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Play To:</span>
                    <span className="font-medium">{format.maxPoints}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Win By:</span>
                    <span className="font-medium">{format.winByMargin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Cap:</span>
                    <span className="font-medium">
                      {format.capAfter > 0 ? format.maxPoints + format.capAfter : 'None'}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {format.switchEndsAtMidpoint && (
                    <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                      Switch Ends
                    </span>
                  )}
                  {format.timeLimitMinutes && (
                    <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded">
                      {format.timeLimitMinutes} min
                    </span>
                  )}
                  {format.isTiebreaker && (
                    <span className="px-2 py-0.5 text-xs bg-orange-50 text-orange-700 rounded">
                      Tiebreaker
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleActive(format)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
                      format.isActive
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {format.isActive ? (
                      <>
                        <ToggleRight className="w-4 h-4" />
                        Active
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4" />
                        Inactive
                      </>
                    )}
                  </button>
                  {!format.isDefault && format.isActive && (
                    <button
                      onClick={() => handleSetDefault(format)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-yellow-600 px-2 py-1 rounded hover:bg-yellow-50 transition-colors"
                    >
                      <Star className="w-4 h-4" />
                      Set Default
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredFormats.length === 0 && (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No formats found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Create your first game format preset'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Format
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingFormat ? 'Edit Format' : 'New Format'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Standard Rally"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Score Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scoring Method</label>
                <select
                  value={formData.scoreMethodId || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    scoreMethodId: e.target.value ? parseInt(e.target.value) : null
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select method...</option>
                  {scoreMethods.map(method => (
                    <option key={method.id} value={method.id}>{method.name}</option>
                  ))}
                </select>
              </div>

              {/* Play To / Win By / Cap */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Play To</label>
                  <select
                    value={formData.maxPoints}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPoints: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[7, 9, 11, 15, 21, 25].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Win By</label>
                  <select
                    value={formData.winByMargin}
                    onChange={(e) => setFormData(prev => ({ ...prev, winByMargin: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[1, 2].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cap After</label>
                  <select
                    value={formData.capAfter}
                    onChange={(e) => setFormData(prev => ({ ...prev, capAfter: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={0}>No Cap</option>
                    {[2, 4, 6, 8].map(n => (
                      <option key={n} value={n}>+{n} (cap {formData.maxPoints + n})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Switch Ends */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.switchEndsAtMidpoint}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      switchEndsAtMidpoint: e.target.checked,
                      midpointScore: e.target.checked ? Math.floor(prev.maxPoints / 2) : null
                    }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Switch Ends</span>
                </label>
                {formData.switchEndsAtMidpoint && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">at</span>
                    <input
                      type="number"
                      value={formData.midpointScore || Math.floor(formData.maxPoints / 2)}
                      onChange={(e) => setFormData(prev => ({ ...prev, midpointScore: parseInt(e.target.value) || null }))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                      min={1}
                      max={formData.maxPoints - 1}
                    />
                  </div>
                )}
              </div>

              {/* Time Limit */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.timeLimitMinutes !== null}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      timeLimitMinutes: e.target.checked ? 15 : null
                    }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Time Limit</span>
                </label>
                {formData.timeLimitMinutes !== null && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.timeLimitMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, timeLimitMinutes: parseInt(e.target.value) || 15 }))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                      min={5}
                      max={60}
                    />
                    <span className="text-sm text-gray-500">min</span>
                  </div>
                )}
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isTiebreaker}
                    onChange={(e) => setFormData(prev => ({ ...prev, isTiebreaker: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Tiebreaker Format</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Default Format</span>
                </label>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingFormat ? 'Save Changes' : 'Create Format'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
