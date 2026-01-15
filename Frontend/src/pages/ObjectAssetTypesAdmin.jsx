import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit2, Trash2, RotateCcw, Save, X, Search,
  // Document icons
  FileText, File, FileCheck, FilePlus, FileImage, FileSpreadsheet,
  // Media icons
  Image, Camera, Video, Music, ImageIcon,
  // Communication icons
  Phone, Mail, MessageSquare, Send,
  // Safety/Legal icons
  Shield, ShieldCheck, AlertTriangle, Lock, Key,
  // Location icons
  Map, MapPin, Navigation, Globe, Compass,
  // Info icons
  BookOpen, Info, HelpCircle, Bookmark, List,
  // Misc icons
  Star, Heart, Flag, Tag, Award, Users, Calendar, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { objectTypesApi, objectAssetTypesApi } from '../services/api';

// Icon options for asset types
const ICON_OPTIONS = [
  // Documents
  { value: 'FileText', label: 'Document', icon: FileText, category: 'Document' },
  { value: 'File', label: 'File', icon: File, category: 'Document' },
  { value: 'FileCheck', label: 'File Check', icon: FileCheck, category: 'Document' },
  { value: 'FilePlus', label: 'File Plus', icon: FilePlus, category: 'Document' },
  { value: 'FileImage', label: 'File Image', icon: FileImage, category: 'Document' },
  { value: 'FileSpreadsheet', label: 'Spreadsheet', icon: FileSpreadsheet, category: 'Document' },

  // Media
  { value: 'Image', label: 'Image', icon: Image, category: 'Media' },
  { value: 'Camera', label: 'Camera', icon: Camera, category: 'Media' },
  { value: 'ImageIcon', label: 'Image Icon', icon: ImageIcon, category: 'Media' },
  { value: 'Video', label: 'Video', icon: Video, category: 'Media' },
  { value: 'Music', label: 'Audio', icon: Music, category: 'Media' },

  // Communication
  { value: 'Phone', label: 'Phone', icon: Phone, category: 'Communication' },
  { value: 'Mail', label: 'Email', icon: Mail, category: 'Communication' },
  { value: 'MessageSquare', label: 'Message', icon: MessageSquare, category: 'Communication' },
  { value: 'Send', label: 'Send', icon: Send, category: 'Communication' },

  // Safety/Legal
  { value: 'Shield', label: 'Shield', icon: Shield, category: 'Safety' },
  { value: 'ShieldCheck', label: 'Shield Check', icon: ShieldCheck, category: 'Safety' },
  { value: 'AlertTriangle', label: 'Warning', icon: AlertTriangle, category: 'Safety' },
  { value: 'Lock', label: 'Lock', icon: Lock, category: 'Safety' },
  { value: 'Key', label: 'Key', icon: Key, category: 'Safety' },

  // Location
  { value: 'Map', label: 'Map', icon: Map, category: 'Location' },
  { value: 'MapPin', label: 'Map Pin', icon: MapPin, category: 'Location' },
  { value: 'Navigation', label: 'Navigation', icon: Navigation, category: 'Location' },
  { value: 'Globe', label: 'Globe', icon: Globe, category: 'Location' },
  { value: 'Compass', label: 'Compass', icon: Compass, category: 'Location' },

  // Info
  { value: 'BookOpen', label: 'Book', icon: BookOpen, category: 'Info' },
  { value: 'Info', label: 'Info', icon: Info, category: 'Info' },
  { value: 'HelpCircle', label: 'Help', icon: HelpCircle, category: 'Info' },
  { value: 'Bookmark', label: 'Bookmark', icon: Bookmark, category: 'Info' },
  { value: 'List', label: 'List', icon: List, category: 'Info' },

  // Misc
  { value: 'Star', label: 'Star', icon: Star, category: 'Misc' },
  { value: 'Heart', label: 'Heart', icon: Heart, category: 'Misc' },
  { value: 'Flag', label: 'Flag', icon: Flag, category: 'Misc' },
  { value: 'Tag', label: 'Tag', icon: Tag, category: 'Misc' },
  { value: 'Award', label: 'Award', icon: Award, category: 'Misc' },
  { value: 'Users', label: 'Users', icon: Users, category: 'Misc' },
  { value: 'Calendar', label: 'Calendar', icon: Calendar, category: 'Misc' },
  { value: 'Clock', label: 'Clock', icon: Clock, category: 'Misc' },
];

const COLOR_OPTIONS = [
  { value: 'gray', label: 'Gray', class: 'bg-gray-500', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
  { value: 'red', label: 'Red', class: 'bg-red-500', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500', bgClass: 'bg-amber-100', textClass: 'text-amber-700' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
  { value: 'green', label: 'Green', class: 'bg-green-500', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-500', bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500', bgClass: 'bg-teal-100', textClass: 'text-teal-700' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500', bgClass: 'bg-cyan-100', textClass: 'text-cyan-700' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500', bgClass: 'bg-indigo-100', textClass: 'text-indigo-700' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500', bgClass: 'bg-pink-100', textClass: 'text-pink-700' },
  { value: 'rose', label: 'Rose', class: 'bg-rose-500', bgClass: 'bg-rose-100', textClass: 'text-rose-700' },
];

// Get unique categories
const ICON_CATEGORIES = [...new Set(ICON_OPTIONS.map(o => o.category))];

export default function ObjectAssetTypesAdmin() {
  const { user } = useAuth();
  const [objectTypes, setObjectTypes] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedObjectType, setSelectedObjectType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    objectTypeId: '',
    typeName: '',
    displayName: '',
    description: '',
    iconName: 'FileText',
    colorClass: 'gray',
    sortOrder: 0,
    isActive: true
  });
  const [iconSearch, setIconSearch] = useState('');
  const [iconCategory, setIconCategory] = useState('All');
  const [error, setError] = useState('');

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    return ICON_OPTIONS.filter(option => {
      const matchesSearch = iconSearch === '' ||
        option.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
        option.value.toLowerCase().includes(iconSearch.toLowerCase());
      const matchesCategory = iconCategory === 'All' || option.category === iconCategory;
      return matchesSearch && matchesCategory;
    });
  }, [iconSearch, iconCategory]);

  // Filter asset types based on selected object type
  const filteredAssetTypes = useMemo(() => {
    if (selectedObjectType === 'all') return assetTypes;
    return assetTypes.filter(at => at.objectTypeId === parseInt(selectedObjectType));
  }, [assetTypes, selectedObjectType]);

  // Group asset types by object type for display
  const groupedAssetTypes = useMemo(() => {
    const groups = {};
    filteredAssetTypes.forEach(at => {
      const objType = objectTypes.find(ot => ot.id === at.objectTypeId);
      const groupName = objType?.displayName || 'Unknown';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(at);
    });
    // Sort each group by sortOrder
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.sortOrder - b.sortOrder);
    });
    return groups;
  }, [filteredAssetTypes, objectTypes]);

  useEffect(() => {
    loadData();
  }, [showInactive]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [objectTypesRes, assetTypesRes] = await Promise.all([
        objectTypesApi.getAll(true),
        objectAssetTypesApi.getAll({ includeInactive: showInactive })
      ]);
      if (objectTypesRes.success) {
        setObjectTypes(objectTypesRes.data || []);
      }
      if (assetTypesRes.success) {
        setAssetTypes(assetTypesRes.data || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingType(null);
    const defaultObjectTypeId = selectedObjectType !== 'all' ? parseInt(selectedObjectType) : (objectTypes[0]?.id || '');
    setFormData({
      objectTypeId: defaultObjectTypeId,
      typeName: '',
      displayName: '',
      description: '',
      iconName: 'FileText',
      colorClass: 'gray',
      sortOrder: assetTypes.filter(at => at.objectTypeId === defaultObjectTypeId).length,
      isActive: true
    });
    setIconSearch('');
    setIconCategory('All');
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (assetType) => {
    setEditingType(assetType);
    setFormData({
      objectTypeId: assetType.objectTypeId,
      typeName: assetType.typeName,
      displayName: assetType.displayName,
      description: assetType.description || '',
      iconName: assetType.iconName || 'FileText',
      colorClass: assetType.colorClass || 'gray',
      sortOrder: assetType.sortOrder,
      isActive: assetType.isActive
    });
    setIconSearch('');
    setIconCategory('All');
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.typeName.trim() || !formData.displayName.trim() || !formData.objectTypeId) return;

    setSaving(true);
    setError('');
    try {
      if (editingType) {
        const response = await objectAssetTypesApi.update(editingType.id, {
          typeName: formData.typeName,
          displayName: formData.displayName,
          description: formData.description,
          iconName: formData.iconName,
          colorClass: formData.colorClass,
          sortOrder: formData.sortOrder,
          isActive: formData.isActive
        });
        if (response.success) {
          setAssetTypes(assetTypes.map(at =>
            at.id === editingType.id ? response.data : at
          ));
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to update asset type');
        }
      } else {
        const response = await objectAssetTypesApi.create({
          objectTypeId: formData.objectTypeId,
          typeName: formData.typeName,
          displayName: formData.displayName,
          description: formData.description,
          iconName: formData.iconName,
          colorClass: formData.colorClass,
          sortOrder: formData.sortOrder
        });
        if (response.success) {
          setAssetTypes([...assetTypes, response.data]);
          setIsModalOpen(false);
        } else {
          setError(response.message || 'Failed to create asset type');
        }
      }
    } catch (err) {
      console.error('Error saving asset type:', err);
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred while saving';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assetType) => {
    if (assetType.isSystem) {
      alert('System asset types cannot be deleted. You can deactivate them instead.');
      return;
    }
    if (!confirm(`Are you sure you want to deactivate "${assetType.displayName}"?`)) return;

    try {
      const response = await objectAssetTypesApi.delete(assetType.id);
      if (response.success) {
        if (showInactive) {
          setAssetTypes(assetTypes.map(at =>
            at.id === assetType.id ? { ...at, isActive: false } : at
          ));
        } else {
          setAssetTypes(assetTypes.filter(at => at.id !== assetType.id));
        }
      } else {
        alert(response.message || 'Failed to deactivate asset type');
      }
    } catch (err) {
      console.error('Error deleting asset type:', err);
      alert('An error occurred while deactivating');
    }
  };

  const handleRestore = async (assetType) => {
    try {
      const response = await objectAssetTypesApi.update(assetType.id, { isActive: true });
      if (response.success) {
        setAssetTypes(assetTypes.map(at =>
          at.id === assetType.id ? response.data : at
        ));
      }
    } catch (err) {
      console.error('Error restoring asset type:', err);
    }
  };

  const getIconComponent = (iconName) => {
    const option = ICON_OPTIONS.find(o => o.value === iconName);
    if (option) {
      const IconComponent = option.icon;
      return <IconComponent className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  const getColorClass = (colorName) => {
    const option = COLOR_OPTIONS.find(o => o.value === colorName);
    return option?.class || 'bg-gray-500';
  };

  // Check if user is admin
  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <Link to="/" className="mt-4 inline-block text-green-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/dashboard" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Object Asset Types</h1>
                <p className="text-sm text-gray-500">Manage asset types for Events, Clubs, Venues, etc.</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Asset Type
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <select
              value={selectedObjectType}
              onChange={(e) => setSelectedObjectType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Object Types</option>
              {objectTypes.filter(ot => ot.isActive).map(ot => (
                <option key={ot.id} value={ot.id}>{ot.displayName}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Show inactive
            </label>
          </div>
          <span className="text-sm text-gray-500">
            {filteredAssetTypes.length} asset type{filteredAssetTypes.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Asset Types List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : filteredAssetTypes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Asset Types</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first asset type.</p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Add Asset Type
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAssetTypes).map(([groupName, types]) => (
              <div key={groupName} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h3 className="font-semibold text-gray-900">{groupName}</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Asset Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {types.map((assetType) => (
                      <tr key={assetType.id} className={!assetType.isActive ? 'bg-gray-50 opacity-60' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${getColorClass(assetType.colorClass)} flex items-center justify-center text-white`}>
                              {getIconComponent(assetType.iconName)}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{assetType.displayName}</div>
                              <div className="text-xs text-gray-500">
                                {assetType.typeName} • Order: {assetType.sortOrder}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {assetType.description || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {assetType.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                            {assetType.isSystem && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                System
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(assetType)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {assetType.isActive ? (
                              <button
                                onClick={() => handleDelete(assetType)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Deactivate"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRestore(assetType)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Restore"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Edit Asset Type' : 'Add Asset Type'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Object Type (only for new) */}
                {!editingType && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Object Type *
                    </label>
                    <select
                      value={formData.objectTypeId}
                      onChange={(e) => setFormData({ ...formData, objectTypeId: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                      required
                    >
                      <option value="">Select object type...</option>
                      {objectTypes.filter(ot => ot.isActive).map(ot => (
                        <option key={ot.id} value={ot.id}>{ot.displayName}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Type Name (internal identifier) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type Name * <span className="text-gray-400 font-normal">(internal identifier)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.typeName}
                    onChange={(e) => setFormData({ ...formData, typeName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g., waiver, rules, photo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g., Waiver, Event Rules, Venue Photo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this asset type..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  {/* Search and Category Filter */}
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        placeholder="Search icons..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <select
                      value={iconCategory}
                      onChange={(e) => setIconCategory(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="All">All</option>
                      {ICON_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  {/* Icon Grid */}
                  <div className="h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {filteredIcons.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        No icons found
                      </div>
                    ) : (
                      <div className="grid grid-cols-8 gap-1">
                        {filteredIcons.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, iconName: option.value })}
                            className={`p-2 rounded-lg border-2 transition-all ${
                              formData.iconName === option.value
                                ? 'border-green-500 bg-green-50 text-green-600 scale-105'
                                : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                            }`}
                            title={`${option.label} (${option.category})`}
                          >
                            <option.icon className="w-5 h-5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {filteredIcons.length} icons available
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, colorClass: option.value })}
                        className={`w-8 h-8 rounded-lg ${option.class} transition-all flex items-center justify-center ${
                          formData.colorClass === option.value
                            ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                            : 'hover:scale-105'
                        }`}
                        title={option.label}
                      >
                        {formData.colorClass === option.value && (
                          <span className="text-white text-sm font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Order & Active */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                {/* Preview */}
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-12 h-12 rounded-lg ${getColorClass(formData.colorClass)} flex items-center justify-center text-white`}>
                      {getIconComponent(formData.iconName)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{formData.displayName || 'Display Name'}</div>
                      <div className="text-sm text-gray-500">{formData.description || 'Description...'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer with Actions */}
              <div className="flex gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.typeName.trim() || !formData.displayName.trim() || !formData.objectTypeId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingType ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
