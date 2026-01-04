import { useState } from 'react'
import { X, Mail, Phone, CheckCircle, ArrowLeft } from 'lucide-react'
import { authApi } from '../../services/api'

/**
 * Modal for changing email or phone via shared auth OTP verification
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {'email' | 'phone'} props.type - Type of credential to change
 * @param {string} props.currentValue - Current email or phone value
 * @param {Function} props.onSuccess - Callback with new value on successful change
 */
const ChangeCredentialModal = ({
  isOpen,
  onClose,
  type,
  currentValue,
  onSuccess
}) => {
  const [step, setStep] = useState('input') // 'input', 'verify', 'success'
  const [newValue, setNewValue] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEmail = type === 'email'
  const Icon = isEmail ? Mail : Phone
  const label = isEmail ? 'Email' : 'Phone Number'
  const placeholder = isEmail ? 'you@example.com' : '+1234567890'

  const handleSendOtp = async (e) => {
    e.preventDefault()

    if (!newValue.trim()) {
      setError(`Please enter a new ${label.toLowerCase()}`)
      return
    }

    // Basic validation
    if (isEmail && !newValue.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (!isEmail && newValue.length < 10) {
      setError('Please enter a valid phone number')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = isEmail
        ? await authApi.requestEmailChange(newValue)
        : await authApi.requestPhoneChange(newValue)

      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      setStep('verify')
    } catch (err) {
      const message = err.response?.data?.message || err.message || `Failed to send verification code`
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()

    if (!otp.trim() || otp.length < 4) {
      setError('Please enter the verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = isEmail
        ? await authApi.verifyEmailChange(newValue, otp)
        : await authApi.verifyPhoneChange(newValue, otp)

      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      // Success - the shared auth has updated the credential
      // The response may contain a new JWT token
      if (response.data?.token) {
        localStorage.setItem('jwtToken', response.data.token)
      }

      setStep('success')

      // Call success callback after a short delay to show success state
      setTimeout(() => {
        onSuccess?.(newValue)
      }, 1500)
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Invalid verification code'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    setError('')

    try {
      const response = isEmail
        ? await authApi.requestEmailChange(newValue)
        : await authApi.requestPhoneChange(newValue)

      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      setError('') // Clear any previous error
      // Could show a success message here
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to resend code'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Reset state when closing
    setStep('input')
    setNewValue('')
    setOtp('')
    setError('')
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        ></div>

        <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center text-white">
                <Icon className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">
                  {step === 'success' ? `${label} Updated` : `Change ${label}`}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="text-white/80 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Back button for verify step */}
            {step === 'verify' && (
              <button
                onClick={() => {
                  setStep('input')
                  setOtp('')
                  setError('')
                }}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-200 mb-4">
                <div className="text-sm text-red-700 font-medium">{error}</div>
              </div>
            )}

            {/* Success State */}
            {step === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Success!</h4>
                <p className="text-gray-600">
                  Your {label.toLowerCase()} has been updated to:
                </p>
                <p className="font-medium text-gray-900 mt-1">{newValue}</p>
              </div>
            )}

            {/* Input Step - Enter new email/phone */}
            {step === 'input' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {currentValue ? (
                      <>
                        Your current {label.toLowerCase()} is: <strong>{currentValue}</strong>
                      </>
                    ) : (
                      <>You don't have a {label.toLowerCase()} set.</>
                    )}
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New {label}
                  </label>
                  <input
                    type={isEmail ? 'email' : 'tel'}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={placeholder}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  We'll send a verification code to verify you own this {label.toLowerCase()}.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {/* Verify Step - Enter OTP */}
            {step === 'verify' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    We sent a verification code to:
                  </p>
                  <p className="font-medium text-gray-900">{newValue}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-widest"
                    placeholder="123456"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-sm text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Verifying...' : 'Verify & Update'}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          {step !== 'success' && (
            <div className="bg-gray-50 px-6 py-3">
              <button
                onClick={handleClose}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChangeCredentialModal
