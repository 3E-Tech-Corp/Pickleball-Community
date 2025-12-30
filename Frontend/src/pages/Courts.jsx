import { useState, useEffect, useCallback } from 'react';
import { MapPin, Search, Filter, Star, Clock, Plus, Phone, Globe, CheckCircle, X, Sun, DollarSign, Layers, ThumbsUp, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { courtsApi } from '../services/api';

const SURFACE_TYPES = [
  { value: 'all', label: 'All Surfaces' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'sport_court', label: 'Sport Court' },
  { value: 'wood', label: 'Wood (Indoor)' },
];

const AMENITY_OPTIONS = [
  'restrooms', 'water', 'benches', 'shade', 'parking', 'pro_shop', 'lessons', 'equipment_rental'
];

export default function Courts() {
  const { user, isAuthenticated } = useAuth();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLights, setHasLights] = useState(false);
  const [isIndoor, setIsIndoor] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [states, setStates] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setLocationError('Unable to get your location. Results will not be sorted by distance.');
        }
      );
    }
  }, []);

  // Load states list
  useEffect(() => {
    const loadStates = async () => {
      try {
        const response = await courtsApi.getStates();
        if (response.success) {
          setStates(response.data || []);
        }
      } catch (err) {
        console.error('Error loading states:', err);
      }
    };
    loadStates();
  }, []);

  // Load courts
  const loadCourts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        query: searchQuery || undefined,
        latitude: userLocation?.lat,
        longitude: userLocation?.lng,
        radiusMiles: userLocation ? radiusMiles : undefined,
        state: selectedState || undefined,
        hasLights: hasLights || undefined,
        isIndoor: isIndoor || undefined,
      };

      const response = await courtsApi.search(params);
      if (response.success && response.data) {
        setCourts(response.data.items || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Error loading courts:', err);
      setCourts([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, userLocation, radiusMiles, selectedState, hasLights, isIndoor]);

  useEffect(() => {
    loadCourts();
  }, [loadCourts]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState(null);
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setPage(1);
    }, 500));
  };

  const handleViewDetails = async (court) => {
    try {
      const response = await courtsApi.getCourt(court.courtId, userLocation?.lat, userLocation?.lng);
      if (response.success) {
        setSelectedCourt(response.data);
      }
    } catch (err) {
      console.error('Error loading court details:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <MapPin className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Find Pickleball Courts</h1>
              <p className="text-green-100 mt-1">
                Search {totalCount.toLocaleString()} courts and help keep information up to date
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location Notice */}
        {locationError && !userLocation && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {locationError}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, city, or address..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            {/* State Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={selectedState}
                onChange={(e) => { setSelectedState(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All States</option>
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            {/* Distance Filter (only if location available) */}
            {userLocation && (
              <select
                value={radiusMiles}
                onChange={(e) => { setRadiusMiles(parseInt(e.target.value)); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value={10}>Within 10 miles</option>
                <option value={25}>Within 25 miles</option>
                <option value={50}>Within 50 miles</option>
                <option value={100}>Within 100 miles</option>
                <option value={250}>Within 250 miles</option>
                <option value={500}>Within 500 miles</option>
              </select>
            )}

            {/* Toggle Filters */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasLights}
                onChange={(e) => { setHasLights(e.target.checked); setPage(1); }}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <Sun className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Has Lights</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isIndoor}
                onChange={(e) => { setIsIndoor(e.target.checked); setPage(1); }}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Indoor</span>
            </label>
          </div>
        </div>

        {/* Courts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
          </div>
        ) : courts.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {courts.map(court => (
                <CourtCard
                  key={court.courtId}
                  court={court}
                  onViewDetails={() => handleViewDetails(court)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Courts Found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || selectedState
                ? 'No courts match your search criteria. Try adjusting your filters.'
                : 'No courts have been added to this area yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Court Detail Modal */}
      {selectedCourt && (
        <CourtDetailModal
          court={selectedCourt}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedCourt(null)}
          onConfirmationSubmitted={(updatedCourt) => {
            setSelectedCourt(updatedCourt);
            loadCourts();
          }}
        />
      )}
    </div>
  );
}

function CourtCard({ court, onViewDetails }) {
  const totalCourts = (court.indoorNum || 0) + (court.outdoorNum || 0) + (court.coveredNum || 0);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-2 flex-wrap">
            {court.indoorNum > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                Indoor ({court.indoorNum})
              </span>
            )}
            {court.outdoorNum > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                Outdoor ({court.outdoorNum})
              </span>
            )}
            {court.hasLights && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                <Sun className="w-3 h-3 inline mr-1" />
                Lights
              </span>
            )}
          </div>
          {court.aggregatedInfo?.averageRating && (
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-sm font-medium">{court.aggregatedInfo.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-2">{court.name || 'Unnamed Court'}</h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {court.address && `${court.address}, `}
              {court.city}{court.state && `, ${court.state}`}
            </span>
          </div>
          {court.distance && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>{court.distance.toFixed(1)} miles away</span>
            </div>
          )}
          {totalCourts > 0 && (
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{totalCourts} court{totalCourts !== 1 ? 's' : ''}</span>
            </div>
          )}
          {court.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>{court.phone}</span>
            </div>
          )}
          {court.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <a href={court.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline truncate">
                {court.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {court.aggregatedInfo?.confirmationCount > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {court.aggregatedInfo.confirmationCount} user confirmation{court.aggregatedInfo.confirmationCount !== 1 ? 's' : ''}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={onViewDetails}
            className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            View Details & Confirm Info
          </button>
        </div>
      </div>
    </div>
  );
}

function CourtDetailModal({ court, isAuthenticated, onClose, onConfirmationSubmitted }) {
  const [activeTab, setActiveTab] = useState('details');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nameConfirmed: court.myConfirmation?.nameConfirmed ?? null,
    suggestedName: court.myConfirmation?.suggestedName || '',
    confirmedIndoorCount: court.myConfirmation?.confirmedIndoorCount ?? '',
    confirmedOutdoorCount: court.myConfirmation?.confirmedOutdoorCount ?? '',
    confirmedCoveredCount: court.myConfirmation?.confirmedCoveredCount ?? '',
    hasLights: court.myConfirmation?.hasLights ?? null,
    hasFee: court.myConfirmation?.hasFee ?? null,
    feeAmount: court.myConfirmation?.feeAmount || '',
    feeNotes: court.myConfirmation?.feeNotes || '',
    hours: court.myConfirmation?.hours || '',
    rating: court.myConfirmation?.rating ?? null,
    surfaceType: court.myConfirmation?.surfaceType || '',
    amenities: court.myConfirmation?.amenities || [],
    notes: court.myConfirmation?.notes || ''
  });

  const handleSubmitConfirmation = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return;

    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        confirmedIndoorCount: formData.confirmedIndoorCount !== '' ? parseInt(formData.confirmedIndoorCount) : null,
        confirmedOutdoorCount: formData.confirmedOutdoorCount !== '' ? parseInt(formData.confirmedOutdoorCount) : null,
        confirmedCoveredCount: formData.confirmedCoveredCount !== '' ? parseInt(formData.confirmedCoveredCount) : null,
      };

      const response = await courtsApi.submitConfirmation(court.courtId, submitData);
      if (response.success) {
        // Reload court details
        const updatedCourt = await courtsApi.getCourt(court.courtId);
        if (updatedCourt.success) {
          onConfirmationSubmitted(updatedCourt.data);
        }
        setActiveTab('details');
      }
    } catch (err) {
      console.error('Error submitting confirmation:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const totalCourts = (court.indoorNum || 0) + (court.outdoorNum || 0) + (court.coveredNum || 0);
  const agg = court.aggregatedInfo || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{court.name || 'Unnamed Court'}</h2>
            <p className="text-sm text-gray-500">
              {court.city}{court.state && `, ${court.state}`}
              {court.distance && ` - ${court.distance.toFixed(1)} miles away`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('confirm')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'confirm'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {court.myConfirmation ? 'Update My Info' : 'Confirm Info'}
            </button>
            <button
              onClick={() => setActiveTab('confirmations')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'confirmations'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              User Reports ({agg.confirmationCount || 0})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Location Info */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  Location
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  {court.address && <p>{court.address}</p>}
                  <p>{court.city}{court.state && `, ${court.state}`} {court.zip}</p>
                  {court.country && court.country !== 'USA' && <p>{court.country}</p>}
                </div>
              </div>

              {/* Court Info */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-green-600" />
                  Court Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox label="Indoor Courts" value={agg.mostConfirmedIndoorCount ?? court.indoorNum ?? 'Unknown'} />
                  <InfoBox label="Outdoor Courts" value={agg.mostConfirmedOutdoorCount ?? court.outdoorNum ?? 'Unknown'} />
                  <InfoBox label="Has Lights" value={agg.mostConfirmedHasLights !== null ? (agg.mostConfirmedHasLights ? 'Yes' : 'No') : (court.hasLights ? 'Yes' : 'Unknown')} />
                  <InfoBox label="Surface Type" value={agg.commonSurfaceType || 'Unknown'} />
                </div>
              </div>

              {/* Fee Info */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Fees & Hours
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox label="Has Fee" value={agg.mostConfirmedHasFee !== null ? (agg.mostConfirmedHasFee ? 'Yes' : 'No') : 'Unknown'} />
                  <InfoBox label="Fee Amount" value={agg.commonFeeAmount || 'Unknown'} />
                  <InfoBox label="Hours" value={agg.commonHours || 'Unknown'} className="col-span-2" />
                </div>
              </div>

              {/* Contact */}
              {(court.phone || court.website || court.email) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-600" />
                    Contact
                  </h3>
                  <div className="space-y-2 text-sm">
                    {court.phone && <p><span className="text-gray-500">Phone:</span> {court.phone}</p>}
                    {court.email && <p><span className="text-gray-500">Email:</span> {court.email}</p>}
                    {court.website && (
                      <p>
                        <span className="text-gray-500">Website:</span>{' '}
                        <a href={court.website} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                          {court.website}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Amenities */}
              {agg.commonAmenities?.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {agg.commonAmenities.map(amenity => (
                      <span key={amenity} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm capitalize">
                        {amenity.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating */}
              {agg.averageRating && (
                <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${star <= Math.round(agg.averageRating) ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <div>
                    <span className="font-semibold text-lg">{agg.averageRating.toFixed(1)}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      based on {agg.confirmationCount} rating{agg.confirmationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'confirm' && (
            <div>
              {!isAuthenticated ? (
                <div className="text-center py-8">
                  <ThumbsUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign in to Confirm Court Info</h3>
                  <p className="text-gray-500">Help keep court information accurate by confirming or updating details.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitConfirmation} className="space-y-6">
                  {/* Name Confirmation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Is the court name "{court.name || 'Unnamed'}" correct?
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.nameConfirmed === true}
                          onChange={() => setFormData({ ...formData, nameConfirmed: true, suggestedName: '' })}
                          className="text-green-600"
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.nameConfirmed === false}
                          onChange={() => setFormData({ ...formData, nameConfirmed: false })}
                          className="text-green-600"
                        />
                        <span>No</span>
                      </label>
                    </div>
                    {formData.nameConfirmed === false && (
                      <input
                        type="text"
                        placeholder="Suggest correct name..."
                        value={formData.suggestedName}
                        onChange={(e) => setFormData({ ...formData, suggestedName: e.target.value })}
                        className="mt-2 w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                      />
                    )}
                  </div>

                  {/* Court Count */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Courts</label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Indoor</label>
                        <input
                          type="number"
                          min="0"
                          placeholder={court.indoorNum?.toString() || '0'}
                          value={formData.confirmedIndoorCount}
                          onChange={(e) => setFormData({ ...formData, confirmedIndoorCount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Outdoor</label>
                        <input
                          type="number"
                          min="0"
                          placeholder={court.outdoorNum?.toString() || '0'}
                          value={formData.confirmedOutdoorCount}
                          onChange={(e) => setFormData({ ...formData, confirmedOutdoorCount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Covered</label>
                        <input
                          type="number"
                          min="0"
                          placeholder={court.coveredNum?.toString() || '0'}
                          value={formData.confirmedCoveredCount}
                          onChange={(e) => setFormData({ ...formData, confirmedCoveredCount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lights & Fee */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Has Lights?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasLights === true}
                            onChange={() => setFormData({ ...formData, hasLights: true })}
                            className="text-green-600"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasLights === false}
                            onChange={() => setFormData({ ...formData, hasLights: false })}
                            className="text-green-600"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Has Fee?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasFee === true}
                            onChange={() => setFormData({ ...formData, hasFee: true })}
                            className="text-green-600"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={formData.hasFee === false}
                            onChange={() => setFormData({ ...formData, hasFee: false })}
                            className="text-green-600"
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {formData.hasFee && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount</label>
                        <input
                          type="text"
                          placeholder="e.g., $5/hour"
                          value={formData.feeAmount}
                          onChange={(e) => setFormData({ ...formData, feeAmount: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fee Notes</label>
                        <input
                          type="text"
                          placeholder="e.g., Free for members"
                          value={formData.feeNotes}
                          onChange={(e) => setFormData({ ...formData, feeNotes: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Hours */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                    <input
                      type="text"
                      placeholder="e.g., Dawn to Dusk, 6AM-10PM"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Surface Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Surface Type</label>
                    <select
                      value={formData.surfaceType}
                      onChange={(e) => setFormData({ ...formData, surfaceType: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select surface type...</option>
                      {SURFACE_TYPES.filter(s => s.value !== 'all').map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Amenities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {AMENITY_OPTIONS.map(amenity => (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            formData.amenities.includes(amenity)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {amenity.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({ ...formData, rating: star })}
                          className="p-1"
                        >
                          <Star
                            className={`w-8 h-8 ${
                              star <= (formData.rating || 0)
                                ? 'text-yellow-500 fill-current'
                                : 'text-gray-300 hover:text-yellow-400'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      placeholder="Any other information about this court..."
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : court.myConfirmation ? 'Update My Info' : 'Submit Confirmation'}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'confirmations' && (
            <div>
              {court.recentConfirmations?.length > 0 ? (
                <div className="space-y-4">
                  {court.recentConfirmations.map(conf => (
                    <div key={conf.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {conf.userProfileImageUrl ? (
                            <img src={conf.userProfileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-green-600 font-medium text-sm">
                                {conf.userName?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{conf.userName || 'Anonymous'}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(conf.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {conf.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span>{conf.rating}/5</span>
                          </div>
                        )}
                        {conf.confirmedIndoorCount !== null && (
                          <div><span className="text-gray-500">Indoor:</span> {conf.confirmedIndoorCount}</div>
                        )}
                        {conf.confirmedOutdoorCount !== null && (
                          <div><span className="text-gray-500">Outdoor:</span> {conf.confirmedOutdoorCount}</div>
                        )}
                        {conf.hasLights !== null && (
                          <div><span className="text-gray-500">Lights:</span> {conf.hasLights ? 'Yes' : 'No'}</div>
                        )}
                        {conf.hasFee !== null && (
                          <div><span className="text-gray-500">Fee:</span> {conf.hasFee ? (conf.feeAmount || 'Yes') : 'No'}</div>
                        )}
                        {conf.surfaceType && (
                          <div><span className="text-gray-500">Surface:</span> {conf.surfaceType}</div>
                        )}
                      </div>
                      {conf.notes && (
                        <p className="mt-2 text-sm text-gray-600 italic">"{conf.notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No user confirmations yet. Be the first to confirm info about this court!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, className = '' }) {
  return (
    <div className={`bg-gray-50 rounded-lg p-3 ${className}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-medium text-gray-900 capitalize">{value?.toString().replace(/_/g, ' ') || 'Unknown'}</div>
    </div>
  );
}
