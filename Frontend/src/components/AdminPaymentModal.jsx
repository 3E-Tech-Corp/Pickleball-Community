import { useState } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle, ExternalLink, FileText, Loader2, XCircle, User } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { tournamentApi, getSharedAssetUrl } from '../services/api';

export default function AdminPaymentModal({ isOpen, onClose, unit, event, onPaymentUpdated }) {
  const toast = useToast();
  const [updatingMember, setUpdatingMember] = useState(null);
  const [localMembers, setLocalMembers] = useState(null);

  if (!isOpen || !unit) return null;

  // Use local state for members if we've updated any, otherwise use props
  const members = localMembers || unit.members || [];

  const amountDue = unit.amountDue || 0;
  const memberCount = members.length || 1;
  const perMemberAmount = amountDue / memberCount;

  // Calculate payment status from member data
  const paidMembers = members.filter(m => m.hasPaid);
  const allPaid = members.length > 0 && paidMembers.length === members.length;
  const anyPaid = paidMembers.length > 0;
  const totalPaid = paidMembers.reduce((sum, m) => sum + (m.amountPaid || 0), 0);

  const paymentStatus = allPaid ? 'Paid' :
    anyPaid ? 'Partial' :
    (unit.paymentStatus === 'PendingVerification' ? 'PendingVerification' : 'Pending');

  const isPaid = paymentStatus === 'Paid';
  const hasPendingProof = paymentStatus === 'PendingVerification';

  const getProofUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : getSharedAssetUrl(url);
  };

  const isPdfUrl = (url) => {
    if (!url) return false;
    const lowercaseUrl = url.toLowerCase();
    return lowercaseUrl.endsWith('.pdf') || lowercaseUrl.includes('.pdf?');
  };

  const isImageUrl = (url) => {
    if (!url) return false;
    if (isPdfUrl(url)) return false;
    return url.includes('/asset/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const handleMarkMemberAsPaid = async (memberId) => {
    setUpdatingMember(memberId);
    try {
      const response = await tournamentApi.markMemberAsPaid(event.id, unit.unitId, memberId);
      if (response.success) {
        toast.success('Member marked as paid');
        // Update local state
        const updatedMembers = members.map(m =>
          m.userId === memberId
            ? { ...m, hasPaid: true, paidAt: response.data.paidAt, amountPaid: response.data.amountPaid, referenceId: response.data.referenceId }
            : m
        );
        setLocalMembers(updatedMembers);
        onPaymentUpdated?.(unit.unitId, { ...response.data, members: updatedMembers });
      } else {
        toast.error(response.message || 'Failed to mark member as paid');
      }
    } catch (err) {
      console.error('Error marking member as paid:', err);
      toast.error('Failed to mark member as paid');
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleUnmarkMemberPaid = async (memberId) => {
    setUpdatingMember(memberId);
    try {
      const response = await tournamentApi.unmarkMemberPaid(event.id, unit.unitId, memberId);
      if (response.success) {
        toast.success('Member payment unmarked');
        // Update local state
        const updatedMembers = members.map(m =>
          m.userId === memberId
            ? { ...m, hasPaid: false, paidAt: null, amountPaid: 0 }
            : m
        );
        setLocalMembers(updatedMembers);
        onPaymentUpdated?.(unit.unitId, { ...response.data, members: updatedMembers });
      } else {
        toast.error(response.message || 'Failed to unmark member payment');
      }
    } catch (err) {
      console.error('Error unmarking member payment:', err);
      toast.error('Failed to unmark member payment');
    } finally {
      setUpdatingMember(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Payment Verification</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Unit Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">{unit.divisionName}</div>
            <div className="text-xs text-gray-400 mt-1">
              Unit ID: {unit.unitId}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Registration Fee:</span>
              <span className="font-medium">${amountDue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Per Member:</span>
              <span>${perMemberAmount.toFixed(2)}</span>
            </div>
            {totalPaid > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Total Paid:</span>
                <span className="font-medium">${totalPaid.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Balance:</span>
              <span className={`font-bold ${(amountDue - totalPaid) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${(amountDue - totalPaid).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isPaid ? 'bg-green-50 text-green-700' :
            hasPendingProof ? 'bg-blue-50 text-blue-700' :
            paymentStatus === 'Partial' ? 'bg-yellow-50 text-yellow-700' :
            'bg-orange-50 text-orange-700'
          }`}>
            {isPaid ? (
              <CheckCircle className="w-5 h-5" />
            ) : hasPendingProof ? (
              <AlertCircle className="w-5 h-5" />
            ) : paymentStatus === 'Partial' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isPaid ? 'All Members Paid' :
               hasPendingProof ? 'Awaiting Verification' :
               paymentStatus === 'Partial' ? `${paidMembers.length}/${members.length} Members Paid` :
               'Payment Pending'}
            </span>
          </div>

          {/* Members Payment Section */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Member Payments</div>

            {members.map((member) => {
              const memberProofUrl = getProofUrl(member.paymentProofUrl);
              const isPdf = isPdfUrl(member.paymentProofUrl);
              const isImage = isImageUrl(memberProofUrl);
              const memberName = member.lastName && member.firstName
                ? `${member.lastName}, ${member.firstName}`
                : (member.lastName || member.firstName || 'Player');

              return (
                <div key={member.userId} className="border rounded-lg p-3 space-y-2">
                  {/* Member Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{memberName}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${member.hasPaid ? 'text-green-600' : 'text-gray-400'}`}>
                      {member.hasPaid ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Paid</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          <span>Unpaid</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Member Payment Details */}
                  {member.hasPaid && (
                    <div className="text-sm space-y-1 pl-6">
                      {member.amountPaid > 0 && (
                        <div className="text-green-600">Amount: ${member.amountPaid.toFixed(2)}</div>
                      )}
                      {member.paidAt && (
                        <div className="text-gray-500">
                          Paid: {new Date(member.paidAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Member Reference ID */}
                  {member.referenceId && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-2 ml-6">
                      <div className="text-xs font-medium text-orange-700">Reference ID</div>
                      <code className="text-xs font-mono text-orange-900">{member.referenceId}</code>
                    </div>
                  )}

                  {/* Member Payment Reference */}
                  {member.paymentReference && (
                    <div className="bg-gray-50 rounded p-2 ml-6">
                      <div className="text-xs font-medium text-gray-600">Payment Reference</div>
                      <div className="text-xs text-gray-800">{member.paymentReference}</div>
                    </div>
                  )}

                  {/* Member Payment Proof */}
                  {memberProofUrl && (
                    <div className="ml-6 space-y-1">
                      <div className="text-xs font-medium text-gray-600">Payment Proof</div>
                      <div className="border rounded overflow-hidden">
                        {isPdf ? (
                          <a
                            href={memberProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
                          >
                            <FileText className="w-10 h-10 text-red-500" />
                            <span className="text-orange-600 hover:text-orange-700 flex items-center gap-1 text-sm">
                              <ExternalLink className="w-3 h-3" />
                              View PDF
                            </span>
                          </a>
                        ) : isImage ? (
                          <a href={memberProofUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={memberProofUrl}
                              alt="Payment proof"
                              className="w-full max-h-32 object-contain bg-gray-100"
                            />
                          </a>
                        ) : (
                          <a
                            href={memberProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 transition-colors text-sm"
                          >
                            <FileText className="w-5 h-5 text-gray-400" />
                            <span className="text-orange-600 hover:text-orange-700">View Document</span>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Member Action Button */}
                  <div className="pt-2 ml-6">
                    {!member.hasPaid ? (
                      <button
                        onClick={() => handleMarkMemberAsPaid(member.userId)}
                        disabled={updatingMember === member.userId}
                        className="w-full py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {updatingMember === member.userId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Mark as Paid
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnmarkMemberPaid(member.userId)}
                        disabled={updatingMember === member.userId}
                        className="w-full py-2 bg-orange-600 text-white rounded font-medium text-sm hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {updatingMember === member.userId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Unmark Payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Close Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
