import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, FileText, DollarSign,
  Loader2, AlertCircle, Trophy, Clock, Send, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { checkInApi, eventsApi } from '../services/api';
import SignatureCanvas from '../components/SignatureCanvas';

export default function PlayerCheckIn() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  // Check if redo mode is enabled (allows re-signing waiver even if checked in)
  const redoMode = searchParams.get('redo') === 'waiver';

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [checkInStatus, setCheckInStatus] = useState(null);
  const [step, setStep] = useState(1); // 1: Waiver, 2: Payment, 3: Submit
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventRes, statusRes] = await Promise.all([
        eventsApi.getEvent(eventId),
        checkInApi.getStatus(eventId, redoMode ? 'waiver' : null)
      ]);

      if (eventRes.success) {
        setEvent(eventRes.data);
      }

      if (statusRes.success) {
        setCheckInStatus(statusRes.data);
        // Determine current step based on status
        // In redo mode, always show waiver step (step 1) if there are pending waivers
        if (redoMode && statusRes.data.pendingWaivers?.length > 0) {
          setStep(1);
        } else if (!statusRes.data.waiverSigned && statusRes.data.pendingWaivers?.length > 0) {
          setStep(1);
        } else if (!statusRes.data.isCheckedIn) {
          setStep(2);
        } else {
          setStep(3);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  }, [eventId, toast, redoMode]);

  useEffect(() => {
    if (isAuthenticated && eventId) {
      loadData();
    }
  }, [isAuthenticated, eventId, loadData]);

  const handleSignWaiver = async (waiverId, signatureData) => {
    try {
      await checkInApi.signWaiver(eventId, waiverId, signatureData);
      toast.success('Waiver signed successfully');
      setShowWaiverModal(false);
      await loadData();
    } catch (err) {
      console.error('Error signing waiver:', err);
      toast.error(err?.response?.data?.message || 'Failed to sign waiver');
    }
  };

  const handleRequestCheckIn = async () => {
    try {
      setSubmitting(true);
      const response = await checkInApi.requestCheckIn(eventId, confirmPayment);

      if (response.success) {
        toast.success('Check-in requested! Awaiting admin approval.');
        // Redirect to player dashboard
        navigate(`/event/${eventId}/game-day`);
      } else {
        toast.error(response.message || 'Failed to request check-in');
      }
    } catch (err) {
      console.error('Error requesting check-in:', err);
      toast.error(err?.response?.data?.message || 'Failed to request check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h2>
          <p className="text-gray-600">Please log in to check in for this event.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading check-in...</p>
        </div>
      </div>
    );
  }

  if (!checkInStatus?.isRegistered) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Not Registered</h2>
          <p className="text-gray-600 mb-4">You are not registered for this event.</p>
          <Link
            to={`/events/${eventId}`}
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            View Event Details
          </Link>
        </div>
      </div>
    );
  }

  const waiverSigned = checkInStatus?.waiverSigned;
  const pendingWaivers = checkInStatus?.pendingWaivers || [];
  const isAlreadyCheckedIn = checkInStatus?.isCheckedIn;

  // Show "already checked in" unless redo mode is enabled (admin sent link to re-sign waiver)
  if (isAlreadyCheckedIn && !redoMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Checked In</h2>
          <p className="text-gray-600 mb-6">
            You have already completed check-in for this event.
          </p>
          <Link
            to={`/event/${eventId}/game-day`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
          >
            <Trophy className="w-5 h-5" />
            Go to Player Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">Check-In</h1>
            <p className="text-sm text-gray-500">{event?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              waiverSigned ? 'bg-green-100 text-green-600' : step >= 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
            }`}>
              {waiverSigned ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <span className="text-sm font-medium">Waiver</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step > 2 ? 'bg-green-100 text-green-600' : step >= 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
            }`}>
              {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <span className="text-sm font-medium">Payment</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step >= 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100'
            }`}>
              3
            </div>
            <span className="text-sm font-medium">Submit</span>
          </div>
        </div>

        {/* Step 1: Waiver */}
        <div className={`bg-white rounded-xl border p-6 ${step === 1 && (!waiverSigned || redoMode) ? 'ring-2 ring-orange-500' : ''}`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${waiverSigned && !redoMode ? 'bg-green-100' : 'bg-orange-100'}`}>
              <FileText className={`w-6 h-6 ${waiverSigned && !redoMode ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {redoMode ? 'Re-Sign Waiver' : 'Sign Waiver'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {redoMode
                  ? 'Please re-sign the event waiver as requested by the organizer'
                  : waiverSigned
                  ? 'You have signed the event waiver'
                  : 'Please read and sign the event waiver to continue'}
              </p>

              {waiverSigned && checkInStatus?.signedWaiverPdfUrl && (
                <a
                  href={checkInStatus.signedWaiverPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-2"
                >
                  <FileText className="w-4 h-4" />
                  View Signed Waiver
                </a>
              )}

              {/* Show sign button if waiver not signed OR in redo mode */}
              {((!waiverSigned || redoMode) && pendingWaivers.length > 0) && (
                <button
                  onClick={() => setShowWaiverModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {redoMode && waiverSigned ? 'Re-Sign Waiver' : 'Sign Waiver'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {waiverSigned && !redoMode && (
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Step 2: Payment Verification */}
        <div className={`bg-white rounded-xl border p-6 ${step === 2 && waiverSigned ? 'ring-2 ring-orange-500' : ''}`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${confirmPayment ? 'bg-green-100' : 'bg-orange-100'}`}>
              <DollarSign className={`w-6 h-6 ${confirmPayment ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Verify Payment</h3>
              <p className="text-sm text-gray-500 mt-1">
                Confirm that you have submitted payment for this event
              </p>

              {event?.paymentInstructions && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  <strong>Payment Instructions:</strong>
                  <p className="mt-1 whitespace-pre-wrap">{event.paymentInstructions}</p>
                </div>
              )}

              {waiverSigned && (
                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmPayment}
                    onChange={(e) => setConfirmPayment(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    I confirm that I have submitted payment for this event registration
                  </span>
                </label>
              )}
            </div>
            {confirmPayment && (
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Step 3: Submit Check-In Request */}
        <div className={`bg-white rounded-xl border p-6 ${step === 3 || (waiverSigned && confirmPayment) ? 'ring-2 ring-orange-500' : ''}`}>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-100">
              <Send className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Request Check-In</h3>
              <p className="text-sm text-gray-500 mt-1">
                Submit your check-in request for admin approval
              </p>

              <button
                onClick={handleRequestCheckIn}
                disabled={!waiverSigned || !confirmPayment || submitting}
                className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Check-In Request
                  </>
                )}
              </button>

              {(!waiverSigned || !confirmPayment) && (
                <p className="mt-2 text-sm text-amber-600">
                  {!waiverSigned && 'Please sign the waiver first. '}
                  {!confirmPayment && 'Please confirm payment.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">What happens next?</h4>
              <p className="text-sm text-blue-700 mt-1">
                After you submit your check-in request, an admin will review and approve it.
                You will be able to see your status on the Player Dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Waiver Modal */}
      {showWaiverModal && pendingWaivers.length > 0 && (
        <WaiverModal
          waiver={pendingWaivers[0]}
          playerName={checkInStatus?.playerName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
          onSign={handleSignWaiver}
          onClose={() => setShowWaiverModal(false)}
        />
      )}
    </div>
  );
}

// Waiver Modal Component
function WaiverModal({ waiver, playerName, onSign, onClose }) {
  const [signature, setSignature] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleSubmit = async () => {
    if (!signature || !signatureImage || !agreed) {
      return;
    }

    setSigning(true);
    try {
      await onSign(waiver.id, {
        signature,
        signatureImage,
        emergencyPhone,
        signerRole: 'Participant'
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sign Waiver</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Waiver Content */}
          <div className="prose prose-sm max-w-none">
            <h4 className="font-medium text-gray-900">{waiver.title}</h4>
            {waiver.content ? (
              <div
                className="mt-4 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto text-sm"
                dangerouslySetInnerHTML={{ __html: waiver.content }}
              />
            ) : waiver.fileUrl ? (
              <a
                href={waiver.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:text-orange-700"
              >
                View Waiver Document
              </a>
            ) : null}
          </div>

          {/* Emergency Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Phone (optional)
            </label>
            <input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Typed Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type your full legal name
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={playerName || 'Your Full Name'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Drawn Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Draw your signature
            </label>
            <SignatureCanvas
              onSignatureChange={setSignatureImage}
              className="border border-gray-300 rounded-lg"
            />
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the terms of this waiver. I understand that by signing this document,
              I am waiving certain legal rights.
            </span>
          </label>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!signature || !signatureImage || !agreed || signing}
              className="flex-1 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing...
                </>
              ) : (
                'Sign Waiver'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
