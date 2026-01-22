import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users, LayoutGrid, ClipboardCheck, Calendar, Settings,
  Clock, CheckCircle, XCircle, Play, AlertCircle, ArrowLeft,
  UserCheck, MapPin, RefreshCw, ChevronRight
} from 'lucide-react';
import { eventStaffApi, checkInApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const STATUS_COLORS = {
  Scheduled: 'bg-gray-100 text-gray-700',
  Ready: 'bg-yellow-100 text-yellow-700',
  InProgress: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700'
};

const COURT_STATUS_COLORS = {
  Available: 'bg-green-100 text-green-700 border-green-200',
  InUse: 'bg-blue-100 text-blue-700 border-blue-200',
  Unavailable: 'bg-red-100 text-red-700 border-red-200',
  Maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200'
};

const StaffDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await eventStaffApi.getDashboard(eventId);
      if (response.data?.success) {
        setDashboard(response.data.data);
        // Auto-select first available section based on permissions
        const perms = response.data.data.permissions;
        if (!activeSection) {
          if (perms.canRecordScores) setActiveSection('scoring');
          else if (perms.canCheckInPlayers) setActiveSection('checkin');
          else if (perms.canManageCourts) setActiveSection('courts');
          else if (perms.canManageSchedule) setActiveSection('schedule');
        }
      }
    } catch (err) {
      console.error('Error loading staff dashboard:', err);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
    showToast('Dashboard refreshed', 'success');
  };

  useEffect(() => {
    if (eventId && isAuthenticated) {
      loadDashboard();
    }
  }, [eventId, isAuthenticated]);

  // Check-in a player
  const handleCheckIn = async (registrationId, userId) => {
    try {
      await checkInApi.manualCheckIn(eventId, userId, { signWaiver: true });
      showToast('Player checked in successfully', 'success');
      loadDashboard();
    } catch (err) {
      console.error('Error checking in player:', err);
      showToast('Failed to check in player', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <p className="text-gray-600">No staff access for this event</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { permissions, roleCategory } = dashboard;
  const hasAnyPermission = permissions.canRecordScores || permissions.canCheckInPlayers ||
    permissions.canManageCourts || permissions.canManageSchedule || permissions.canViewAllData;

  // Check if this is a non-staff role (spectator, volunteer, VIP, etc.)
  const isNonStaffRole = roleCategory && roleCategory !== 'Staff';

  // For non-staff roles (spectators, etc.) show a simplified dashboard
  if (!hasAnyPermission && isNonStaffRole) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{roleCategory} Dashboard</h1>
                  <p className="text-sm text-gray-500">
                    {dashboard.eventName} - {dashboard.roleName || roleCategory}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Spectator Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Welcome Card */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white mb-6">
            <h2 className="text-2xl font-bold mb-2">Welcome, {dashboard.userName || 'Guest'}!</h2>
            <p className="text-blue-100">
              You're registered as a <strong>{dashboard.roleName || roleCategory}</strong> for this event.
            </p>
            {dashboard.eventDate && (
              <p className="text-blue-100 mt-2">
                <Calendar className="inline-block w-4 h-4 mr-1" />
                {new Date(dashboard.eventDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Event Schedule */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Event Information
              </h3>
              <div className="space-y-3 text-sm">
                <p className="text-gray-600">
                  Check the main event page for the latest schedule and match results.
                </p>
                <Link
                  to={`/event/${eventId}`}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  View Event Page
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Announcements placeholder */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Announcements
              </h3>
              <p className="text-gray-500 text-sm">
                Event announcements will appear here. Check back for updates from the organizers.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/event/${eventId}`}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Event Page
              </Link>
              <Link
                to={`/event/${eventId}/schedule`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Full Schedule
              </Link>
              <Link
                to={`/event/${eventId}/results`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Results
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For staff without permissions (shouldn't happen normally)
  if (!hasAnyPermission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <p className="text-gray-600">You don't have any staff permissions for this event</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Build navigation sections based on permissions
  const sections = [];
  if (permissions.canRecordScores || permissions.canViewAllData) {
    sections.push({ id: 'scoring', label: 'Score Matches', icon: ClipboardCheck });
  }
  if (permissions.canCheckInPlayers || permissions.canViewAllData) {
    sections.push({ id: 'checkin', label: 'Check-In', icon: UserCheck });
  }
  if (permissions.canManageCourts || permissions.canViewAllData) {
    sections.push({ id: 'courts', label: 'Court Status', icon: MapPin });
  }
  if (permissions.canManageSchedule || permissions.canViewAllData) {
    sections.push({ id: 'schedule', label: 'Schedule', icon: Calendar });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Staff Dashboard</h1>
                <p className="text-sm text-gray-500">
                  {dashboard.eventName} - {dashboard.roleName || 'Staff'}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {sections.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Scoring Section */}
        {activeSection === 'scoring' && (
          <ScoringSection
            encounters={dashboard.scoringEncounters || []}
            eventId={eventId}
            onRefresh={loadDashboard}
          />
        )}

        {/* Check-In Section */}
        {activeSection === 'checkin' && (
          <CheckInSection
            pendingCheckIns={dashboard.pendingCheckIns || []}
            stats={dashboard.checkInStats}
            eventId={eventId}
            onCheckIn={handleCheckIn}
            onRefresh={loadDashboard}
          />
        )}

        {/* Courts Section */}
        {activeSection === 'courts' && (
          <CourtsSection
            courts={dashboard.courtStatuses || []}
            eventId={eventId}
          />
        )}

        {/* Schedule Section */}
        {activeSection === 'schedule' && (
          <ScheduleSection
            encounters={dashboard.upcomingEncounters || []}
            divisionStats={dashboard.divisionStats || []}
            eventId={eventId}
          />
        )}
      </div>
    </div>
  );
};

// Scoring Section Component
const ScoringSection = ({ encounters, eventId, onRefresh }) => {
  const navigate = useNavigate();

  const inProgress = encounters.filter(e => e.status === 'InProgress');
  const ready = encounters.filter(e => e.status === 'Ready' || e.status === 'Scheduled');

  return (
    <div className="space-y-6">
      {/* In Progress Matches */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Play className="h-5 w-5 text-blue-600" />
          In Progress ({inProgress.length})
        </h2>
        {inProgress.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches currently in progress</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.map(encounter => (
              <EncounterCard
                key={encounter.id}
                encounter={encounter}
                eventId={eventId}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ready/Scheduled Matches */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-600" />
          Ready to Score ({ready.length})
        </h2>
        {ready.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches ready for scoring</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map(encounter => (
              <EncounterCard
                key={encounter.id}
                encounter={encounter}
                eventId={eventId}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Link to full game day */}
      <div className="text-center pt-4">
        <Link
          to={`/event/${eventId}/game-day`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          View Full Game Day Management
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

// Encounter Card for scoring
const EncounterCard = ({ encounter, eventId, onRefresh }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-start mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[encounter.status] || 'bg-gray-100'}`}>
          {encounter.status}
        </span>
        {encounter.courtLabel && (
          <span className="text-xs text-gray-500">
            Court {encounter.courtLabel}
          </span>
        )}
      </div>

      <div className="space-y-1 mb-3">
        <p className="font-medium text-gray-900">{encounter.unit1Name}</p>
        <p className="text-sm text-gray-500">vs</p>
        <p className="font-medium text-gray-900">{encounter.unit2Name}</p>
      </div>

      {encounter.divisionName && (
        <p className="text-xs text-gray-500 mb-2">{encounter.divisionName}</p>
      )}

      {encounter.scheduledTime && (
        <p className="text-xs text-gray-400 mb-3">
          <Clock className="inline h-3 w-3 mr-1" />
          {new Date(encounter.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <button
        onClick={() => navigate(`/event/${eventId}/game-day?encounterId=${encounter.id}`)}
        className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        Score Match
      </button>
    </div>
  );
};

// Check-In Section Component
const CheckInSection = ({ pendingCheckIns, stats, eventId, onCheckIn, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingIn, setCheckingIn] = useState(null);

  const filteredCheckIns = pendingCheckIns.filter(item =>
    item.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.divisionName && item.divisionName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCheckIn = async (item) => {
    setCheckingIn(item.registrationId);
    await onCheckIn(item.registrationId, item.userId);
    setCheckingIn(null);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalApproved}</p>
            <p className="text-sm text-gray-500">Total Registered</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
            <p className="text-sm text-gray-500">Checked In</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.remaining}</p>
            <p className="text-sm text-gray-500">Remaining</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by name or division..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Pending Check-ins List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Awaiting Check-In ({filteredCheckIns.length})
        </h2>

        {filteredCheckIns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
            <p className="text-gray-600">
              {searchTerm ? 'No matching players found' : 'All players checked in!'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border divide-y">
            {filteredCheckIns.map(item => (
              <div key={item.registrationId} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.userName}</p>
                  {item.divisionName && (
                    <p className="text-sm text-gray-500">{item.divisionName}</p>
                  )}
                </div>
                <button
                  onClick={() => handleCheckIn(item)}
                  disabled={checkingIn === item.registrationId}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {checkingIn === item.registrationId ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Check In
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Courts Section Component
const CourtsSection = ({ courts, eventId }) => {
  const navigate = useNavigate();

  const activeCourts = courts.filter(c => c.currentEncounterId);
  const availableCourts = courts.filter(c => !c.currentEncounterId && c.status !== 'Unavailable' && c.status !== 'Maintenance');
  const unavailableCourts = courts.filter(c => c.status === 'Unavailable' || c.status === 'Maintenance');

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{activeCourts.length}</p>
          <p className="text-sm text-gray-500">In Use</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{availableCourts.length}</p>
          <p className="text-sm text-gray-500">Available</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{unavailableCourts.length}</p>
          <p className="text-sm text-gray-500">Unavailable</p>
        </div>
      </div>

      {/* Active Courts */}
      {activeCourts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-600" />
            Active Matches
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeCourts.map(court => (
              <div key={court.courtId} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg text-gray-900">
                    Court {court.courtLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    In Use
                  </span>
                </div>
                {court.currentMatchDescription && (
                  <p className="text-sm text-gray-600 mb-3">{court.currentMatchDescription}</p>
                )}
                {court.locationDescription && (
                  <p className="text-xs text-gray-400">{court.locationDescription}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Courts */}
      {availableCourts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Available Courts
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {availableCourts.map(court => (
              <div key={court.courtId} className="bg-white rounded-lg shadow-sm border p-4">
                <span className="font-bold text-gray-900">Court {court.courtLabel}</span>
                {court.locationDescription && (
                  <p className="text-xs text-gray-400 mt-1">{court.locationDescription}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unavailable Courts */}
      {unavailableCourts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Unavailable
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {unavailableCourts.map(court => (
              <div key={court.courtId} className="bg-gray-100 rounded-lg border p-4 opacity-60">
                <span className="font-bold text-gray-700">Court {court.courtLabel}</span>
                <p className="text-xs text-gray-500 mt-1">{court.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to court planning */}
      <div className="text-center pt-4">
        <Link
          to={`/event/${eventId}/court-planning`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          Open Court Planning
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

// Schedule Section Component
const ScheduleSection = ({ encounters, divisionStats, eventId }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Division Progress */}
      {divisionStats.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Division Progress</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisionStats.map(div => {
              const progressPercent = div.totalEncounters > 0
                ? Math.round((div.completedEncounters / div.totalEncounters) * 100)
                : 0;

              return (
                <div key={div.divisionId} className="bg-white rounded-lg shadow-sm border p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{div.divisionName}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{div.completedEncounters}/{div.totalEncounters}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    {div.inProgressEncounters > 0 && (
                      <p className="text-xs text-blue-600">
                        {div.inProgressEncounters} match{div.inProgressEncounters !== 1 ? 'es' : ''} in progress
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Upcoming Matches ({encounters.length})
        </h2>

        {encounters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600">No upcoming matches scheduled</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border divide-y">
            {encounters.map(encounter => (
              <div key={encounter.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {encounter.unit1Name} vs {encounter.unit2Name}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      {encounter.divisionName && (
                        <span>{encounter.divisionName}</span>
                      )}
                      {encounter.roundNumber && (
                        <span>Round {encounter.roundNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {encounter.courtLabel && (
                      <p className="text-sm font-medium text-gray-700">Court {encounter.courtLabel}</p>
                    )}
                    {encounter.scheduledTime && (
                      <p className="text-xs text-gray-400">
                        {new Date(encounter.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link to tournament manage */}
      <div className="text-center pt-4">
        <Link
          to={`/event/${eventId}/tournament-manage`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          Open Tournament Management
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

export default StaffDashboard;
