import { useState, useEffect } from 'react'
import { X, Mic, Video, Speaker } from 'lucide-react'

export default function DeviceSelector({ onClose, onSelectDevice }) {
  const [audioInputs, setAudioInputs] = useState([])
  const [audioOutputs, setAudioOutputs] = useState([])
  const [videoInputs, setVideoInputs] = useState([])
  const [selectedAudioInput, setSelectedAudioInput] = useState('')
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('')
  const [selectedVideoInput, setSelectedVideoInput] = useState('')

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(devices.filter(d => d.kind === 'audioinput'))
      setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'))
      setVideoInputs(devices.filter(d => d.kind === 'videoinput'))
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Device Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Microphone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
              <Mic className="w-4 h-4" /> Microphone
            </label>
            <select
              value={selectedAudioInput}
              onChange={e => setSelectedAudioInput(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              {audioInputs.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Microphone'}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker */}
          {audioOutputs.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                <Speaker className="w-4 h-4" /> Speaker
              </label>
              <select
                value={selectedAudioOutput}
                onChange={e => setSelectedAudioOutput(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                {audioOutputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Speaker'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Camera */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
              <Video className="w-4 h-4" /> Camera
            </label>
            <select
              value={selectedVideoInput}
              onChange={e => setSelectedVideoInput(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              {videoInputs.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Camera'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
