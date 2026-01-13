import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { userApi, materialApi, themeApi, notificationTemplateApi, getAssetUrl } from '../services/api'
import {
  Users, BookOpen, Calendar, DollarSign, Search, Edit2, Trash2,
  ChevronLeft, ChevronRight, Filter, MoreVertical, Eye, X,
  Shield, GraduationCap, User, CheckCircle, XCircle, Save,
  Palette, Upload, RefreshCw, Image, Layers, Check, Award, Bell,
  Mail, Plus, RotateCcw, ToggleLeft, ToggleRight, Copy, AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'

const AdminDashboard = () => {
  const { user } = useAuth()
  const { theme: currentTheme, refreshTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('users')
  const [loading, setLoading] = useState(false)

  // Users state
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  // Materials state
  const [materials, setMaterials] = useState([])
  const [materialSearch, setMaterialSearch] = useState('')

  // Theme state
  const [themeSettings, setThemeSettings] = useState(null)
  const [themePresets, setThemePresets] = useState([])
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const logoInputRef = useRef(null)
  const faviconInputRef = useRef(null)

  // Notification Templates state
  const [templates, setTemplates] = useState([])
  const [templateCategories, setTemplateCategories] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState({ subject: '', body: '' })
  const [isNewTemplate, setIsNewTemplate] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'materials') {
      fetchMaterials()
    } else if (activeTab === 'theme') {
      fetchTheme()
    } else if (activeTab === 'notifications') {
      fetchTemplates()
    }
  }, [activeTab])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await userApi.getAllUsers()
      if (response.success && response.data) {
        setUsers(response.data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMaterials = async () => {
    setLoading(true)
    try {
      const response = await materialApi.getMaterials()
      if (response.success && response.data) {
        setMaterials(response.data)
      } else if (Array.isArray(response)) {
        setMaterials(response)
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch theme settings
  const fetchTheme = async () => {
    setLoading(true)
    try {
      const response = await themeApi.getCurrent()
      if (response.success && response.data) {
        setThemeSettings(response.data)
      } else if (response && !response.success) {
        // If no theme exists, use defaults
        setThemeSettings(getDefaultTheme())
      }
    } catch (error) {
      console.error('Error fetching theme:', error)
      setThemeSettings(getDefaultTheme())
    } finally {
      setLoading(false)
    }

    // Also fetch presets
    fetchThemePresets()
  }

  // Fetch theme presets
  const fetchThemePresets = async () => {
    setLoadingPresets(true)
    try {
      const response = await themeApi.getPresets()
      if (response.success && response.data) {
        setThemePresets(response.data)
      } else if (Array.isArray(response)) {
        setThemePresets(response)
      }
    } catch (error) {
      console.error('Error fetching theme presets:', error)
      setThemePresets([])
    } finally {
      setLoadingPresets(false)
    }
  }

  // Apply preset to theme settings
  const handleApplyPreset = (preset) => {
    setThemeSettings(prev => ({
      ...prev,
      primaryColor: preset.primaryColor,
      primaryDarkColor: preset.primaryDarkColor,
      primaryLightColor: preset.primaryLightColor,
      accentColor: preset.accentColor,
      accentDarkColor: preset.accentDarkColor,
      accentLightColor: preset.accentLightColor
    }))
  }

  // Default theme values
  const getDefaultTheme = () => ({
    organizationName: 'Pickleball College',
    primaryColor: '#047857',
    primaryDarkColor: '#065f46',
    primaryLightColor: '#d1fae5',
    accentColor: '#f59e0b',
    accentDarkColor: '#d97706',
    accentLightColor: '#fef3c7',
    successColor: '#10b981',
    errorColor: '#ef4444',
    warningColor: '#f59e0b',
    infoColor: '#3b82f6',
    textPrimaryColor: '#111827',
    textSecondaryColor: '#6b7280',
    backgroundColor: '#ffffff',
    backgroundSecondaryColor: '#f3f4f6',
    fontFamily: 'Inter, system-ui, sans-serif',
    logoUrl: '',
    faviconUrl: ''
  })

  // Handle theme field change
  const handleThemeChange = (field, value) => {
    setThemeSettings(prev => ({ ...prev, [field]: value }))
  }

  // Save theme settings
  const handleSaveTheme = async () => {
    setSavingTheme(true)
    try {
      const response = await themeApi.update(themeSettings)
      if (response.success) {
        await refreshTheme()
        alert('Theme saved successfully!')
      } else {
        throw new Error(response.message || 'Failed to save theme')
      }
    } catch (error) {
      console.error('Error saving theme:', error)
      alert('Failed to save theme: ' + (error.message || 'Unknown error'))
    } finally {
      setSavingTheme(false)
    }
  }

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const response = await themeApi.uploadLogo(file)
      if (response.success && response.data) {
        setThemeSettings(prev => ({ ...prev, logoUrl: response.data.url }))
        await refreshTheme()
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  // Handle favicon upload
  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFavicon(true)
    try {
      const response = await themeApi.uploadFavicon(file)
      if (response.success && response.data) {
        setThemeSettings(prev => ({ ...prev, faviconUrl: response.data.url }))
        await refreshTheme()
      }
    } catch (error) {
      console.error('Error uploading favicon:', error)
      alert('Failed to upload favicon')
    } finally {
      setUploadingFavicon(false)
    }
  }

  // Fetch notification templates
  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const [templatesResponse, categoriesResponse] = await Promise.all([
        notificationTemplateApi.getTemplates(),
        notificationTemplateApi.getCategories()
      ])

      if (templatesResponse.success && templatesResponse.data) {
        setTemplates(templatesResponse.data)
      }
      if (categoriesResponse.success && categoriesResponse.data) {
        setTemplateCategories(categoriesResponse.data)
      }
    } catch (error) {
      console.error('Error fetching notification templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle edit template
  const handleEditTemplate = (template) => {
    setSelectedTemplate({ ...template })
    setIsNewTemplate(false)
    setIsTemplateModalOpen(true)
  }

  // Handle new template
  const handleNewTemplate = () => {
    setSelectedTemplate({
      templateKey: '',
      name: '',
      description: '',
      category: 'General',
      subject: '',
      body: '',
      placeholders: [],
      isActive: true
    })
    setIsNewTemplate(true)
    setIsTemplateModalOpen(true)
  }

  // Handle save template
  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return
    setSavingTemplate(true)
    try {
      let response
      if (isNewTemplate) {
        response = await notificationTemplateApi.createTemplate(selectedTemplate)
      } else {
        response = await notificationTemplateApi.updateTemplate(selectedTemplate.id, selectedTemplate)
      }

      if (response.success) {
        await fetchTemplates()
        setIsTemplateModalOpen(false)
        setSelectedTemplate(null)
        alert(isNewTemplate ? 'Template created successfully!' : 'Template updated successfully!')
      } else {
        throw new Error(response.message || 'Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template: ' + (error.message || 'Unknown error'))
    } finally {
      setSavingTemplate(false)
    }
  }

  // Handle toggle template active
  const handleToggleTemplateActive = async (template) => {
    try {
      const response = await notificationTemplateApi.toggleActive(template.id)
      if (response.success) {
        await fetchTemplates()
      }
    } catch (error) {
      console.error('Error toggling template:', error)
      alert('Failed to toggle template status')
    }
  }

  // Handle reset template
  const handleResetTemplate = async (template) => {
    if (!template.isSystem) {
      alert('Only system templates can be reset to defaults')
      return
    }
    if (!confirm('Are you sure you want to reset this template to its default content?')) {
      return
    }
    try {
      const response = await notificationTemplateApi.resetTemplate(template.id)
      if (response.success) {
        await fetchTemplates()
        alert('Template reset to default!')
      }
    } catch (error) {
      console.error('Error resetting template:', error)
      alert('Failed to reset template')
    }
  }

  // Handle delete template
  const handleDeleteTemplate = async (template) => {
    if (template.isSystem) {
      alert('System templates cannot be deleted')
      return
    }
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }
    try {
      const response = await notificationTemplateApi.deleteTemplate(template.id)
      if (response.success) {
        await fetchTemplates()
        alert('Template deleted!')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  // Handle preview template
  const handlePreviewTemplate = async () => {
    if (!selectedTemplate) return
    try {
      // Create sample data from placeholders
      const sampleData = {}
      selectedTemplate.placeholders?.forEach(p => {
        sampleData[p] = `[${p}]`
      })
      // Add common sample values
      sampleData['OrganizationName'] = 'Pickleball College'
      sampleData['FirstName'] = 'John'
      sampleData['LastName'] = 'Doe'
      sampleData['Email'] = 'john.doe@example.com'

      const response = await notificationTemplateApi.previewTemplate(
        selectedTemplate.subject,
        selectedTemplate.body,
        sampleData
      )

      if (response.success && response.data) {
        setPreviewContent({
          subject: response.data.renderedSubject,
          body: response.data.renderedBody
        })
        setIsPreviewModalOpen(true)
      }
    } catch (error) {
      console.error('Error previewing template:', error)
      alert('Failed to preview template')
    }
  }

  // Handle placeholder input
  const handlePlaceholderChange = (value) => {
    const placeholders = value.split(',').map(p => p.trim()).filter(p => p)
    setSelectedTemplate(prev => ({ ...prev, placeholders }))
  }

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      (u.firstName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
      (u.lastName?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(userSearch.toLowerCase())
    const matchesRole = userRoleFilter === 'all' || u.role?.toLowerCase() === userRoleFilter.toLowerCase()
    return matchesSearch && matchesRole
  })

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    return (m.title?.toLowerCase() || '').includes(materialSearch.toLowerCase()) ||
           (m.description?.toLowerCase() || '').includes(materialSearch.toLowerCase())
  })

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch =
      (t.name?.toLowerCase() || '').includes(templateSearch.toLowerCase()) ||
      (t.templateKey?.toLowerCase() || '').includes(templateSearch.toLowerCase()) ||
      (t.subject?.toLowerCase() || '').includes(templateSearch.toLowerCase())
    const matchesCategory = templateCategoryFilter === 'all' || t.category === templateCategoryFilter
    return matchesSearch && matchesCategory
  })

  // Pagination logic
  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return data.slice(startIndex, startIndex + itemsPerPage)
  }

  const totalPages = (data) => Math.ceil(data.length / itemsPerPage)

  // Handle user edit
  const handleEditUser = (userData) => {
    setSelectedUser({ ...userData })
    setIsUserModalOpen(true)
  }

  // Handle save user
  const handleSaveUser = async () => {
    if (!selectedUser) return
    setSavingUser(true)
    try {
      await userApi.updateUser(selectedUser.id, {
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        role: selectedUser.role,
        isActive: selectedUser.isActive
      })
      // Update local state
      setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u))
      setIsUserModalOpen(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    } finally {
      setSavingUser(false)
    }
  }

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return <Shield className="w-4 h-4 text-purple-500" />
      case 'coach': return <GraduationCap className="w-4 h-4 text-blue-500" />
      default: return <User className="w-4 h-4 text-gray-500" />
    }
  }

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'coach': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Sidebar navigation items
  const navItems = [
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'materials', label: 'Materials', icon: BookOpen, count: materials.length },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: templates.length },
    { id: 'certification', label: 'Certification', icon: Award, link: '/admin/certification' },
    { id: 'events', label: 'Events', icon: Calendar, count: 0, disabled: true },
    { id: 'transactions', label: 'Transactions', icon: DollarSign, count: 0, disabled: true }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-1">System Management</p>
          </div>
          <nav className="p-4 space-y-2">
            {navItems.map(item => (
              item.link ? (
                <Link
                  key={item.id}
                  to={item.link}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition text-gray-600 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              ) : (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : item.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      activeTab === item.id ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {item.count}
                    </span>
                  )}
                  {item.disabled && (
                    <span className="text-xs text-gray-400">Soon</span>
                  )}
                </button>
              )
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              </div>

              {/* Search and Filters */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="coach">Coach</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading users...</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredUsers).map(u => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                  {u.profileImageUrl ? (
                                    <img
                                      src={getAssetUrl(u.profileImageUrl)}
                                      alt={`${u.firstName} ${u.lastName}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                                      {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-gray-900">
                                    {u.firstName} {u.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role)}`}>
                                {getRoleIcon(u.role)}
                                <span className="ml-1 capitalize">{u.role}</span>
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {u.isActive ? (
                                <span className="inline-flex items-center text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-red-600">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleEditUser(u)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredUsers.length > itemsPerPage && (
                      <div className="px-6 py-4 border-t flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-sm">
                            Page {currentPage} of {totalPages(filteredUsers)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages(filteredUsers), p + 1))}
                            disabled={currentPage === totalPages(filteredUsers)}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {filteredUsers.length === 0 && (
                      <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No users found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Materials Tab */}
          {activeTab === 'materials' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Materials Management</h2>
              </div>

              {/* Search */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search materials..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Materials Grid */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading materials...</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coach</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredMaterials).map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-16 h-12 rounded bg-gray-200 overflow-hidden flex-shrink-0">
                                  {m.thumbnailUrl ? (
                                    <img
                                      src={getAssetUrl(m.thumbnailUrl)}
                                      alt={m.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                      <BookOpen className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-gray-900">{m.title}</div>
                                  <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {m.description?.substring(0, 50)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {m.contentType}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {m.coachName || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              ${m.price?.toFixed(2) || '0.00'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 ml-2">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredMaterials.length === 0 && (
                      <div className="p-12 text-center">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No materials found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Theme Tab */}
          {activeTab === 'theme' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Theme Management</h2>
                <button
                  onClick={handleSaveTheme}
                  disabled={savingTheme || !themeSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {savingTheme ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Theme
                    </>
                  )}
                </button>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500">Loading theme settings...</p>
                </div>
              ) : themeSettings ? (
                <div className="space-y-6">
                  {/* Branding Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Image className="w-5 h-5 mr-2 text-blue-500" />
                      Branding
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Organization Name
                        </label>
                        <input
                          type="text"
                          value={themeSettings.organizationName || ''}
                          onChange={(e) => handleThemeChange('organizationName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Your Organization Name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Font Family
                        </label>
                        <select
                          value={themeSettings.fontFamily || 'Inter, system-ui, sans-serif'}
                          onChange={(e) => handleThemeChange('fontFamily', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
                          <option value="Roboto, system-ui, sans-serif">Roboto</option>
                          <option value="Open Sans, system-ui, sans-serif">Open Sans</option>
                          <option value="Poppins, system-ui, sans-serif">Poppins</option>
                          <option value="Montserrat, system-ui, sans-serif">Montserrat</option>
                        </select>
                      </div>
                    </div>

                    {/* Logo and Favicon */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                        <div className="flex items-center space-x-4">
                          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                            {themeSettings.logoUrl ? (
                              <img
                                src={getAssetUrl(themeSettings.logoUrl)}
                                alt="Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <Image className="w-8 h-8 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <input
                              type="file"
                              ref={logoInputRef}
                              onChange={handleLogoUpload}
                              accept="image/*"
                              className="hidden"
                            />
                            <button
                              onClick={() => logoInputRef.current?.click()}
                              disabled={uploadingLogo}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center disabled:opacity-50"
                            >
                              {uploadingLogo ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </button>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Favicon</label>
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                            {themeSettings.faviconUrl ? (
                              <img
                                src={getAssetUrl(themeSettings.faviconUrl)}
                                alt="Favicon"
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <Image className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <input
                              type="file"
                              ref={faviconInputRef}
                              onChange={handleFaviconUpload}
                              accept="image/*,.ico"
                              className="hidden"
                            />
                            <button
                              onClick={() => faviconInputRef.current?.click()}
                              disabled={uploadingFavicon}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center disabled:opacity-50"
                            >
                              {uploadingFavicon ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4 mr-2" />
                              )}
                              {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                            </button>
                            <p className="text-xs text-gray-500 mt-1">ICO, PNG 32x32 or 64x64</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Theme Presets Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Layers className="w-5 h-5 mr-2 text-indigo-500" />
                      Theme Presets
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Choose a preset to quickly apply a color scheme, then customize as needed.
                    </p>

                    {loadingPresets ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <span className="ml-2 text-gray-500">Loading presets...</span>
                      </div>
                    ) : themePresets.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {themePresets.map(preset => {
                          const isActive =
                            themeSettings?.primaryColor?.toLowerCase() === preset.primaryColor?.toLowerCase() &&
                            themeSettings?.accentColor?.toLowerCase() === preset.accentColor?.toLowerCase()

                          return (
                            <button
                              key={preset.presetId}
                              onClick={() => handleApplyPreset(preset)}
                              className={`relative p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                                isActive
                                  ? 'border-indigo-500 ring-2 ring-indigo-200'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {isActive && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}

                              {/* Color Preview */}
                              <div className="flex space-x-1 mb-3">
                                <div
                                  className="w-8 h-8 rounded-lg shadow-sm"
                                  style={{ backgroundColor: preset.primaryColor }}
                                  title="Primary"
                                />
                                <div
                                  className="w-8 h-8 rounded-lg shadow-sm"
                                  style={{ backgroundColor: preset.primaryDarkColor }}
                                  title="Primary Dark"
                                />
                                <div
                                  className="w-8 h-8 rounded-lg shadow-sm"
                                  style={{ backgroundColor: preset.accentColor }}
                                  title="Accent"
                                />
                              </div>

                              <div className="text-left">
                                <p className="font-medium text-gray-900 text-sm">{preset.presetName}</p>
                                {preset.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preset.description}</p>
                                )}
                              </div>

                              {preset.isDefault && (
                                <span className="absolute bottom-2 right-2 text-xs text-indigo-600 font-medium">
                                  Default
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Layers className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p>No theme presets available</p>
                      </div>
                    )}
                  </div>

                  {/* Colors Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Palette className="w-5 h-5 mr-2 text-purple-500" />
                      Color Scheme
                    </h3>

                    {/* Primary Colors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Primary Colors</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Primary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.primaryColor || '#047857'}
                              onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.primaryColor || '#047857'}
                              onChange={(e) => handleThemeChange('primaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Primary Dark</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.primaryDarkColor || '#065f46'}
                              onChange={(e) => handleThemeChange('primaryDarkColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.primaryDarkColor || '#065f46'}
                              onChange={(e) => handleThemeChange('primaryDarkColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Primary Light</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.primaryLightColor || '#d1fae5'}
                              onChange={(e) => handleThemeChange('primaryLightColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.primaryLightColor || '#d1fae5'}
                              onChange={(e) => handleThemeChange('primaryLightColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Accent Colors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Accent Colors</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Accent</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.accentColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.accentColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('accentColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Accent Dark</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.accentDarkColor || '#d97706'}
                              onChange={(e) => handleThemeChange('accentDarkColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.accentDarkColor || '#d97706'}
                              onChange={(e) => handleThemeChange('accentDarkColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Accent Light</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.accentLightColor || '#fef3c7'}
                              onChange={(e) => handleThemeChange('accentLightColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.accentLightColor || '#fef3c7'}
                              onChange={(e) => handleThemeChange('accentLightColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Colors */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Status Colors</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Success</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.successColor || '#10b981'}
                              onChange={(e) => handleThemeChange('successColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.successColor || '#10b981'}
                              onChange={(e) => handleThemeChange('successColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Error</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.errorColor || '#ef4444'}
                              onChange={(e) => handleThemeChange('errorColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.errorColor || '#ef4444'}
                              onChange={(e) => handleThemeChange('errorColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Warning</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.warningColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('warningColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.warningColor || '#f59e0b'}
                              onChange={(e) => handleThemeChange('warningColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Info</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.infoColor || '#3b82f6'}
                              onChange={(e) => handleThemeChange('infoColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.infoColor || '#3b82f6'}
                              onChange={(e) => handleThemeChange('infoColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Background & Text Colors */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Background & Text</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Background</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.backgroundColor || '#ffffff'}
                              onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.backgroundColor || '#ffffff'}
                              onChange={(e) => handleThemeChange('backgroundColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Background Secondary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.backgroundSecondaryColor || '#f3f4f6'}
                              onChange={(e) => handleThemeChange('backgroundSecondaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.backgroundSecondaryColor || '#f3f4f6'}
                              onChange={(e) => handleThemeChange('backgroundSecondaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Text Primary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.textPrimaryColor || '#111827'}
                              onChange={(e) => handleThemeChange('textPrimaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.textPrimaryColor || '#111827'}
                              onChange={(e) => handleThemeChange('textPrimaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Text Secondary</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={themeSettings.textSecondaryColor || '#6b7280'}
                              onChange={(e) => handleThemeChange('textSecondaryColor', e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={themeSettings.textSecondaryColor || '#6b7280'}
                              onChange={(e) => handleThemeChange('textSecondaryColor', e.target.value)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                    <div
                      className="p-6 rounded-lg border"
                      style={{ backgroundColor: themeSettings.backgroundColor }}
                    >
                      <div className="flex items-center mb-4">
                        {themeSettings.logoUrl && (
                          <img
                            src={getAssetUrl(themeSettings.logoUrl)}
                            alt="Logo Preview"
                            className="h-10 mr-4"
                          />
                        )}
                        <h4
                          className="text-xl font-bold"
                          style={{ color: themeSettings.textPrimaryColor }}
                        >
                          {themeSettings.organizationName || 'Organization Name'}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.primaryColor }}
                        >
                          Primary Button
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.accentColor }}
                        >
                          Accent Button
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.successColor }}
                        >
                          Success
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg text-white"
                          style={{ backgroundColor: themeSettings.errorColor }}
                        >
                          Error
                        </button>
                      </div>
                      <p style={{ color: themeSettings.textSecondaryColor }}>
                        This is how your theme colors will appear throughout the application.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Failed to load theme settings</p>
                </div>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Notification Templates</h2>
                <button
                  onClick={handleNewTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </button>
              </div>

              {/* Search and Filters */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                      value={templateCategoryFilter}
                      onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Categories</option>
                      {templateCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Templates Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading templates...</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {getPaginatedData(filteredTemplates).map(template => (
                          <tr key={template.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <Mail className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-gray-900">{template.name}</div>
                                  <div className="text-sm text-gray-500">{template.templateKey}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {template.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {template.isActive ? (
                                <span className="inline-flex items-center text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-gray-500">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {template.isSystem ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  <Shield className="w-3 h-3 mr-1" />
                                  System
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  Custom
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  onClick={() => handleEditTemplate(template)}
                                  className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleTemplateActive(template)}
                                  className={`p-2 rounded-lg ${template.isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                  title={template.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {template.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                </button>
                                {template.isSystem && (
                                  <button
                                    onClick={() => handleResetTemplate(template)}
                                    className="text-purple-600 hover:text-purple-800 p-2 rounded-lg hover:bg-purple-50"
                                    title="Reset to default"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                                {!template.isSystem && (
                                  <button
                                    onClick={() => handleDeleteTemplate(template)}
                                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredTemplates.length > itemsPerPage && (
                      <div className="px-6 py-4 border-t flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTemplates.length)} of {filteredTemplates.length} templates
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-sm">
                            Page {currentPage} of {totalPages(filteredTemplates)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages(filteredTemplates), p + 1))}
                            disabled={currentPage === totalPages(filteredTemplates)}
                            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {filteredTemplates.length === 0 && (
                      <div className="p-12 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No templates found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Events Tab (Coming Soon) */}
          {activeTab === 'events' && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Events Management</h3>
              <p className="text-gray-500">Coming soon. Manage tournaments, workshops, and events.</p>
            </div>
          )}

          {/* Transactions Tab (Coming Soon) */}
          {activeTab === 'transactions' && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Transactions Management</h3>
              <p className="text-gray-500">Coming soon. View and manage all payment transactions.</p>
            </div>
          )}
        </div>
      </div>

      {/* User Edit Modal */}
      {isUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsUserModalOpen(false)}
            />

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                    {selectedUser.profileImageUrl ? (
                      <img
                        src={getAssetUrl(selectedUser.profileImageUrl)}
                        alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-medium">
                        {(selectedUser.firstName?.[0] || '') + (selectedUser.lastName?.[0] || '')}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedUser.email}</p>
                    <p className="text-sm text-gray-500">ID: {selectedUser.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={selectedUser.firstName || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={selectedUser.lastName || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={selectedUser.role || 'Student'}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Student">Student</option>
                    <option value="Coach">Coach</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Account Status</label>
                  <button
                    type="button"
                    onClick={() => setSelectedUser({ ...selectedUser, isActive: !selectedUser.isActive })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      selectedUser.isActive ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        selectedUser.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={savingUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {savingUser ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      {isTemplateModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsTemplateModalOpen(false)}
            />

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white z-10">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isNewTemplate ? 'Create New Template' : 'Edit Template'}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviewTemplate}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center text-sm"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Template Key (only for new templates) */}
                {isNewTemplate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.templateKey || ''}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, templateKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., custom_notification"
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique identifier for this template (lowercase, underscores)</p>
                  </div>
                )}

                {/* Template Key display (for existing templates) */}
                {!isNewTemplate && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="font-medium">Key:</span>
                    <code className="bg-gray-200 px-2 py-0.5 rounded">{selectedTemplate.templateKey}</code>
                    {selectedTemplate.isSystem && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 ml-2">
                        <Shield className="w-3 h-3 mr-1" />
                        System Template
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.name || ''}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Template display name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={selectedTemplate.category || 'General'}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="General">General</option>
                      <option value="Account">Account</option>
                      <option value="Sessions">Sessions</option>
                      <option value="Purchases">Purchases</option>
                      <option value="Video Reviews">Video Reviews</option>
                      <option value="Certification">Certification</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={selectedTemplate.description || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="When is this template used?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.subject || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Email subject line (supports {{placeholders}})"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Body <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={selectedTemplate.body || ''}
                    onChange={(e) => setSelectedTemplate({ ...selectedTemplate, body: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={12}
                    placeholder="Email body content (supports {{placeholders}} and {{#if Condition}}...{{/if}})"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Placeholders
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.placeholders?.join(', ') || ''}
                    onChange={(e) => handlePlaceholderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="FirstName, LastName, Email (comma-separated)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    List of placeholder names available in this template. Use {'{{PlaceholderName}}'} in subject/body.
                  </p>
                </div>

                {/* Placeholder Tags Display */}
                {selectedTemplate.placeholders?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.placeholders.map(p => (
                      <span
                        key={p}
                        className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-mono cursor-pointer hover:bg-blue-100"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${p}}}`)
                        }}
                        title="Click to copy"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between py-2">
                  <label className="text-sm font-medium text-gray-700">Active Status</label>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate({ ...selectedTemplate, isActive: !selectedTemplate.isActive })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      selectedTemplate.isActive ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        selectedTemplate.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Help Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Template Syntax Help
                  </h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li><strong>Placeholders:</strong> Use {'{{PlaceholderName}}'} to insert dynamic values</li>
                    <li><strong>Conditionals:</strong> Use {'{{#if Condition}}content{{/if}}'} to show content only when the condition has a value</li>
                    <li><strong>Common placeholders:</strong> OrganizationName, FirstName, LastName, Email</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 sticky bottom-0">
                <button
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !selectedTemplate.name || !selectedTemplate.subject || !selectedTemplate.body || (isNewTemplate && !selectedTemplate.templateKey)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {savingTemplate ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isNewTemplate ? 'Create Template' : 'Save Changes'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsPreviewModalOpen(false)}
            />

            <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4">
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                    {previewContent.subject}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Body</label>
                  <div className="p-4 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
                    {previewContent.body}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Note: Placeholders are shown as [PlaceholderName] in this preview. They will be replaced with actual values when the notification is sent.
                </p>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
