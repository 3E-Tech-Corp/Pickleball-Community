import React, { useState } from 'react';
import { Bell, BellOff, Smartphone, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

/**
 * Component to enable/disable push notifications
 */
export function PushNotificationToggle({ className = '' }) {
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTest
  } = usePushNotifications();

  const [testSent, setTestSent] = useState(false);

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (err) {
      // Error already handled in hook
    }
  };

  const handleSendTest = async () => {
    const success = await sendTest();
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  // Not supported
  if (!isSupported) {
    return (
      <div className={`flex items-center gap-3 p-4 bg-gray-50 rounded-lg ${className}`}>
        <BellOff className="w-5 h-5 text-gray-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">Push Notifications</p>
          <p className="text-xs text-gray-500">Not supported in this browser</p>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className={`flex items-center gap-3 p-4 bg-red-50 rounded-lg ${className}`}>
        <AlertCircle className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">Push Notifications Blocked</p>
          <p className="text-xs text-red-600">
            Please enable notifications in your browser settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isSubscribed ? 'bg-green-100' : 'bg-gray-100'}`}>
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-green-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Push Notifications</p>
            <p className="text-xs text-gray-500">
              {isSubscribed
                ? 'You will receive notifications even when the app is closed'
                : 'Enable to receive notifications on this device'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isSubscribed ? 'bg-blue-600' : 'bg-gray-200'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {loading && (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            )}
          </span>
        </button>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
          {error}
        </div>
      )}

      {isSubscribed && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Smartphone className="w-4 h-4" />
              <span>This device is receiving notifications</span>
            </div>
            <button
              onClick={handleSendTest}
              disabled={loading || testSent}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              {testSent ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Sent!
                </span>
              ) : (
                'Send Test'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PushNotificationToggle;
