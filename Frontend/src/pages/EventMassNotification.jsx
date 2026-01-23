import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, Users, Mail, Loader2, AlertCircle, Check,
  UserCheck, Briefcase, Eye, Search, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { eventsApi, tournamentApi } from '../services/api';

export default function EventMassNotification() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [filters, setFilters] = useState(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [includePlayers, setIncludePlayers] = useState(true);
  const [includeStaff, setIncludeStaff] = useState(false);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [selectedStaffRoles, setSelectedStaffRoles] = useState([]);
  const [sendInAppNotification, setSendInAppNotification] = useState(true);

  // Specific user search
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [specificUsers, setSpecificUsers] = useState([]);

  // Load event and filters
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [eventRes, filtersRes] = await Promise.all([
          eventsApi.getEvent(eventId),
          eventsApi.getNotificationFilters(eventId)
        ]);

        if (eventRes.success) setEvent(eventRes.data);
        if (filtersRes.success) setFilters(filtersRes.data);
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('Failed to load event data');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) loadData();
  }, [eventId]);

  // Search users for specific selection
  const handleUserSearch = async (query) => {
    setUserSearchQuery(query);
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const res = await tournamentApi.searchUsersForRegistration(eventId, query);
      if (res.success) {
        // Filter out already selected users
        const selectedIds = new Set(specificUsers.map(u => u.id));
        setUserSearchResults(res.data.filter(u => !selectedIds.has(u.id)));
      }
    } catch (err) {
      console.error('User search failed:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Add specific user
  const addSpecificUser = (user) => {
    setSpecificUsers(prev => [...prev, user]);
    setUserSearchResults([]);
    setUserSearchQuery('');
  };

  // Remove specific user
  const removeSpecificUser = (userId) => {
    setSpecificUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Toggle division selection
  const toggleDivision = (divisionId) => {
    setSelectedDivisions(prev =>
      prev.includes(divisionId)
        ? prev.filter(id => id !== divisionId)
        : [...prev, divisionId]
    );
  };

  // Toggle staff role selection
  const toggleStaffRole = (roleId) => {
    setSelectedStaffRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  // Select all divisions
  const selectAllDivisions = () => {
    setSelectedDivisions(filters?.divisions?.map(d => d.id) || []);
  };

  // Clear all divisions
  const clearAllDivisions = () => {
    setSelectedDivisions([]);
  };

  // Build request data
  const buildRequestData = () => ({
    subject,
    message,
    includePlayers,
    includeStaff,
    divisionIds: includePlayers ? selectedDivisions : [],
    staffRoleIds: includeStaff ? selectedStaffRoles : [],
    specificUserIds: specificUsers.map(u => u.id),
    sendInAppNotification
  });

  // Preview recipients
  const handlePreview = async () => {
    try {
      setPreviewing(true);
      const res = await eventsApi.previewNotificationRecipients(eventId, buildRequestData());
      if (res.success) {
        setPreviewData(res.data);
      }
    } catch (err) {
      console.error('Preview failed:', err);
      toast.error('Failed to preview recipients');
    } finally {
      setPreviewing(false);
    }
  };

  // Send notification
  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please enter a subject and message');
      return;
    }

    const hasRecipients = includePlayers || includeStaff || specificUsers.length > 0;
    if (!hasRecipients) {
      toast.error('Please select at least one recipient group');
      return;
    }

    try {
      setSending(true);
      const res = await eventsApi.sendMassNotification(eventId, buildRequestData());
      if (res.success) {
        const { sentCount, failedCount } = res.data;
        if (failedCount > 0) {
          toast.warning(`Sent to ${sentCount} recipients, ${failedCount} failed`);
        } else {
          toast.success(`Successfully sent to ${sentCount} recipients`);
        }
        // Reset form
        setSubject('');
        setMessage('');
        setPreviewData(null);
      }
    } catch (err) {
      console.error('Send failed:', err);
      toast.error(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Event not found</p>
        </div>
      </div>
    );
  }

  const totalPlayerCount = filters?.divisions?.reduce((sum, d) => sum + d.playerCount, 0) || 0;
  const totalStaffCount = (filters?.staffRoles?.reduce((sum, r) => sum + r.staffCount, 0) || 0) +
                          (filters?.staffWithoutRoleCount || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/event/${eventId}/manage`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Send Notification</h1>
              <p className="text-sm text-gray-500">{event.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Message Composition */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-600" />
            Compose Message
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendInAppNotification}
                onChange={(e) => setSendInAppNotification(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Also send as in-app notification</span>
            </label>
          </div>
        </div>

        {/* Recipient Selection */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600" />
            Select Recipients
          </h2>

          {/* Players Section */}
          <div className="mb-6">
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={includePlayers}
                onChange={(e) => setIncludePlayers(e.target.checked)}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">Players</span>
                <span className="text-sm text-gray-500">({totalPlayerCount} total)</span>
              </div>
            </label>

            {includePlayers && filters?.divisions?.length > 0 && (
              <div className="ml-8 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={selectAllDivisions}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={clearAllDivisions}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filters.divisions.map(division => (
                    <label
                      key={division.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedDivisions.includes(division.id)
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDivisions.includes(division.id)}
                        onChange={() => toggleDivision(division.id)}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">{division.name}</span>
                      <span className="text-xs text-gray-500">{division.playerCount}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Staff Section */}
          <div className="mb-6">
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={includeStaff}
                onChange={(e) => setIncludeStaff(e.target.checked)}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">Staff</span>
                <span className="text-sm text-gray-500">({totalStaffCount} total)</span>
              </div>
            </label>

            {includeStaff && (filters?.staffRoles?.length > 0 || filters?.staffWithoutRoleCount > 0) && (
              <div className="ml-8 space-y-2">
                <p className="text-xs text-gray-500 mb-2">
                  Leave all unchecked to include all staff, or select specific roles:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filters.staffRoles?.map(role => (
                    <label
                      key={role.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedStaffRoles.includes(role.id)
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffRoles.includes(role.id)}
                        onChange={() => toggleStaffRole(role.id)}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">{role.name}</span>
                      <span className="text-xs text-gray-500">{role.staffCount}</span>
                    </label>
                  ))}
                  {filters.staffWithoutRoleCount > 0 && (
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedStaffRoles.includes(0)
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffRoles.includes(0)}
                        onChange={() => toggleStaffRole(0)}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 flex-1 italic">No assigned role</span>
                      <span className="text-xs text-gray-500">{filters.staffWithoutRoleCount}</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Specific Users Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900">Add Specific Users</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              {searchingUsers && (
                <Loader2 className="absolute right-3 top-2.5 w-5 h-5 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search Results */}
            {userSearchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {userSearchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => addSpecificUser(user)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b last:border-b-0"
                  >
                    <span className="text-sm text-gray-900">{user.name}</span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Specific Users */}
            {specificUsers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {specificUsers.map(user => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-lg"
                  >
                    {user.name}
                    <button
                      onClick={() => removeSpecificUser(user.id)}
                      className="hover:text-green-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {previewData && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-orange-600" />
              Preview Recipients ({previewData.totalRecipients})
            </h2>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left text-gray-600">Email</th>
                    <th className="px-3 py-2 text-left text-gray-600">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.recipients.map(recipient => (
                    <tr key={recipient.userId} className="border-b">
                      <td className="px-3 py-2">{recipient.name}</td>
                      <td className="px-3 py-2 text-gray-500">{recipient.email || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          recipient.type === 'Player' ? 'bg-blue-100 text-blue-700' :
                          recipient.type === 'Staff' ? 'bg-purple-100 text-purple-700' :
                          recipient.type === 'Player & Staff' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {recipient.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.hasMore && (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Showing first 50 of {previewData.totalRecipients} recipients
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handlePreview}
            disabled={previewing || (!includePlayers && !includeStaff && specificUsers.length === 0)}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {previewing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Preview Recipients
          </button>

          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim() || (!includePlayers && !includeStaff && specificUsers.length === 0)}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Notification
          </button>
        </div>
      </div>
    </div>
  );
}
