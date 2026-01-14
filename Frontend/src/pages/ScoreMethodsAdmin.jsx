import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Check, X, Loader2, Search,
  Settings, AlertCircle, Star, ToggleLeft, ToggleRight, ArrowUp, ArrowDown
} from 'lucide-react';
import { scoreMethodsApi } from '../services/api';

/**
 * Admin page for managing Scoring Methods
 */
export default function ScoreMethodsAdmin({ embedded = false }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    shortCode: '',
    description: '',
    baseType: 'Rally',
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
      const response = await scoreMethodsApi.getAll(showInactive);
      if (response.data?.success !== false) {
        setMethods(response.data?.data || response.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load scoring methods');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingMethod(null);
    setFormData({
      name: '',
      shortCode: '',
      description: '',
      baseType: 'Rally',
      sortOrder: methods.length * 10,
      isActive: true,
      isDefault: false
    });
    setIsModalOpen(true);
  };

  const handleEdit = (method) => {
    setEditingMethod(method);
    setFormData({
      name: method.name || '',
      shortCode: method.shortCode || '',
      description: method.description || '',
      baseType: method.baseType || 'Rally',
      sortOrder: method.sortOrder,
      isActive: method.isActive,
      isDefault: method.isDefault
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
      if (editingMethod) {
        await scoreMethodsApi.update(editingMethod.id, formData);
      } else {
        await scoreMethodsApi.create(formData);
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving method:', err);
      alert('Failed to save scoring method');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (method) => {
    if (!confirm(`Delete "${method.name}"? If it's in use, it will be deactivated instead.`)) {
      return;
    }

    setDeleting(method.id);
    try {
      await scoreMethodsApi.delete(method.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting method:', err);
      alert('Failed to delete scoring method');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (method) => {
    try {
      await scoreMethodsApi.update(method.id, { isActive: !method.isActive });
      await loadData();
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  const handleSetDefault = async (method) => {
    try {
      await scoreMethodsApi.update(method.id, { isDefault: true });
      await loadData();
    } catch (err) {
      console.error('Error setting default:', err);
    }
  };

  const handleReorder = async (method, direction) => {
    const currentIndex = methods.findIndex(m => m.id === method.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= methods.length) return;

    const otherMethod = methods[newIndex];

    try {
      // Swap sort orders
      await Promise.all([
        scoreMethodsApi.update(method.id, { sortOrder: otherMethod.sortOrder }),
        scoreMethodsApi.update(otherMethod.id, { sortOrder: method.sortOrder })
      ]);
      await loadData();
    } catch (err) {
      console.error('Error reordering:', err);
    }
  };

  // Filter methods
  const filteredMethods = methods.filter(m => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        m.name?.toLowerCase().includes(query) ||
        m.shortCode?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const containerClass = embedded ? '' : 'min-h-screen bg-gray-50 p-6';

  return (
    <div className={containerClass}>
      <div className={embedded ? '' : 'max-w-4xl mx-auto'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scoring Methods</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure scoring types (Rally, Classic, etc.)
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Method
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
              placeholder="Search methods..."
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
          /* Methods Table */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Short Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Base Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMethods.map((method, index) => (
                  <tr
                    key={method.id}
                    className={`hover:bg-gray-50 ${!method.isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReorder(method, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReorder(method, 'down')}
                          disabled={index === filteredMethods.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-400 ml-1">{method.sortOrder}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{method.name}</span>
                        {method.isDefault && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {method.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{method.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-sm font-mono bg-gray-100 text-gray-700 rounded">
                        {method.shortCode || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        method.baseType === 'Rally'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {method.baseType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(method)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
                          method.isActive
                            ? 'text-green-700 bg-green-50 hover:bg-green-100'
                            : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {method.isActive ? (
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
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!method.isDefault && method.isActive && (
                          <button
                            onClick={() => handleSetDefault(method)}
                            className="p-1.5 text-gray-400 hover:text-yellow-600 rounded"
                            title="Set as default"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(method)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(method)}
                          disabled={deleting === method.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === method.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Empty state */}
            {filteredMethods.length === 0 && (
              <div className="text-center py-12">
                <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No methods found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'Try adjusting your search' : 'Create your first scoring method'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Method
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingMethod ? 'Edit Scoring Method' : 'New Scoring Method'}
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
                  placeholder="e.g., Rally Score"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Short Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Code</label>
                <input
                  type="text"
                  value={formData.shortCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, shortCode: e.target.value }))}
                  placeholder="e.g., Rally"
                  maxLength={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Short display name (max 20 characters)</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this scoring method..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Base Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="baseType"
                      value="Rally"
                      checked={formData.baseType === 'Rally'}
                      onChange={(e) => setFormData(prev => ({ ...prev, baseType: e.target.value }))}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Rally</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="baseType"
                      value="Classic"
                      checked={formData.baseType === 'Classic'}
                      onChange={(e) => setFormData(prev => ({ ...prev, baseType: e.target.value }))}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Classic (Side-Out)</span>
                  </label>
                </div>
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

              {/* Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Default</span>
                </label>
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
                {editingMethod ? 'Save Changes' : 'Create Method'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
