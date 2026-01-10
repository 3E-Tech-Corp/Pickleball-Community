import { useState, useEffect } from 'react';
import { X, Calendar, Users, Grid, Shuffle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const SCHEDULE_TYPES = [
  { value: 'RoundRobin', label: 'Round Robin', description: 'Every unit plays every other unit' },
  { value: 'SingleElimination', label: 'Single Elimination', description: 'Knockout format - lose once and out' },
  { value: 'DoubleElimination', label: 'Double Elimination', description: 'Must lose twice to be eliminated' },
  { value: 'RoundRobinPlayoff', label: 'Round Robin + Playoff', description: 'Pool play followed by bracket' }
];

export default function ScheduleConfigModal({
  isOpen,
  onClose,
  division,
  onGenerate,
  isGenerating = false
}) {
  const [scheduleType, setScheduleType] = useState('RoundRobin');
  const [targetUnits, setTargetUnits] = useState(division?.registeredUnits || 4);
  const [poolCount, setPoolCount] = useState(1);
  const [bestOf, setBestOf] = useState(1);
  const [playoffFromPools, setPlayoffFromPools] = useState(2);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);

  useEffect(() => {
    if (division) {
      // Default to registered units or minimum of 4
      setTargetUnits(Math.max(division.registeredUnits || 0, 4));
    }
  }, [division]);

  useEffect(() => {
    // Calculate preview stats when config changes
    calculatePreviewStats();
  }, [scheduleType, targetUnits, poolCount, playoffFromPools]);

  const calculatePreviewStats = () => {
    if (targetUnits < 2) {
      setPreviewStats(null);
      return;
    }

    let totalMatches = 0;
    let rounds = 0;
    let byes = 0;
    let matchesPerUnit = 0;

    if (scheduleType === 'RoundRobin') {
      // n*(n-1)/2 matches per pool
      const unitsPerPool = Math.ceil(targetUnits / poolCount);
      const matchesPerPool = (unitsPerPool * (unitsPerPool - 1)) / 2;
      totalMatches = matchesPerPool * poolCount;
      rounds = unitsPerPool - 1;
      matchesPerUnit = unitsPerPool - 1;
    } else if (scheduleType === 'SingleElimination') {
      // Find next power of 2
      let bracketSize = 1;
      while (bracketSize < targetUnits) bracketSize *= 2;
      byes = bracketSize - targetUnits;
      totalMatches = bracketSize - 1;
      rounds = Math.log2(bracketSize);
    } else if (scheduleType === 'DoubleElimination') {
      let bracketSize = 1;
      while (bracketSize < targetUnits) bracketSize *= 2;
      byes = bracketSize - targetUnits;
      // Winners bracket + losers bracket + potential grand final reset
      totalMatches = (bracketSize - 1) + (bracketSize - 1) + 1;
      rounds = Math.log2(bracketSize) * 2;
    } else if (scheduleType === 'RoundRobinPlayoff') {
      // Pool play
      const unitsPerPool = Math.ceil(targetUnits / poolCount);
      const matchesPerPool = (unitsPerPool * (unitsPerPool - 1)) / 2;
      const poolMatches = matchesPerPool * poolCount;

      // Playoff bracket
      const playoffUnits = playoffFromPools * poolCount;
      let bracketSize = 1;
      while (bracketSize < playoffUnits) bracketSize *= 2;
      const bracketMatches = bracketSize - 1;

      totalMatches = poolMatches + bracketMatches;
      rounds = (unitsPerPool - 1) + Math.log2(bracketSize);
      matchesPerUnit = unitsPerPool - 1; // During pool play
    }

    setPreviewStats({
      totalMatches: Math.round(totalMatches),
      rounds: Math.round(rounds),
      byes,
      matchesPerUnit: Math.round(matchesPerUnit),
      poolSize: poolCount > 1 ? Math.ceil(targetUnits / poolCount) : targetUnits
    });
  };

  const handleGenerate = () => {
    onGenerate({
      scheduleType,
      targetUnits,
      poolCount: scheduleType === 'RoundRobin' || scheduleType === 'RoundRobinPlayoff' ? poolCount : null,
      bestOf,
      playoffFromPools: scheduleType === 'RoundRobinPlayoff' ? playoffFromPools : null
    });
  };

  if (!isOpen) return null;

  const registeredUnits = division?.registeredUnits || 0;
  const hasEnoughUnits = registeredUnits >= 2;
  const placeholderCount = targetUnits - registeredUnits;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Configure Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Division Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">{division?.name}</div>
            <div className="text-sm text-gray-500 mt-1">
              {registeredUnits} registered unit{registeredUnits !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Type
            </label>
            <div className="space-y-2">
              {SCHEDULE_TYPES.map(type => (
                <label
                  key={type.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    scheduleType === type.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="scheduleType"
                    value={type.value}
                    checked={scheduleType === type.value}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="mt-1 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-sm text-gray-500">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Target Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Number of Units
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Set this higher than registered units to create placeholder slots for the drawing
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={Math.max(registeredUnits, 2)}
                max={64}
                value={targetUnits}
                onChange={(e) => setTargetUnits(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
              />
              <div className="flex gap-2">
                {[4, 8, 16, 32].map(n => (
                  <button
                    key={n}
                    onClick={() => setTargetUnits(n)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      targetUnits === n
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {placeholderCount > 0 && (
              <div className="mt-2 text-sm text-blue-600 flex items-center gap-1">
                <Users className="w-4 h-4" />
                {placeholderCount} placeholder slot{placeholderCount !== 1 ? 's' : ''}
                ({registeredUnits} registered, {placeholderCount} empty)
              </div>
            )}
          </div>

          {/* Pool Count (for Round Robin types) */}
          {(scheduleType === 'RoundRobin' || scheduleType === 'RoundRobinPlayoff') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Pools
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={poolCount}
                  onChange={(e) => setPoolCount(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                >
                  {[1, 2, 3, 4, 6, 8].map(n => (
                    <option key={n} value={n}>
                      {n} pool{n !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                {poolCount > 1 && previewStats && (
                  <span className="text-sm text-gray-500">
                    ({previewStats.poolSize} units per pool)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Playoff advancement (for RoundRobinPlayoff) */}
          {scheduleType === 'RoundRobinPlayoff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teams Advancing per Pool
              </label>
              <select
                value={playoffFromPools}
                onChange={(e) => setPlayoffFromPools(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>
                    Top {n} from each pool
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced Options
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-4 pl-4 border-l-2 border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Games per Match (Best Of)
                  </label>
                  <select
                    value={bestOf}
                    onChange={(e) => setBestOf(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value={1}>1 game</option>
                    <option value={3}>Best of 3</option>
                    <option value={5}>Best of 5</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Preview Stats */}
          {previewStats && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Grid className="w-4 h-4" />
                Schedule Preview
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-700">Total Matches:</span>
                  <span className="ml-2 font-semibold text-blue-900">{previewStats.totalMatches}</span>
                </div>
                <div>
                  <span className="text-blue-700">Rounds:</span>
                  <span className="ml-2 font-semibold text-blue-900">{previewStats.rounds}</span>
                </div>
                {previewStats.byes > 0 && (
                  <div>
                    <span className="text-blue-700">First Round Byes:</span>
                    <span className="ml-2 font-semibold text-blue-900">{previewStats.byes}</span>
                  </div>
                )}
                {previewStats.matchesPerUnit > 0 && (
                  <div>
                    <span className="text-blue-700">Matches per Unit:</span>
                    <span className="ml-2 font-semibold text-blue-900">{previewStats.matchesPerUnit}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning for placeholder units */}
          {placeholderCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Placeholder Units</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    The schedule will be created with {targetUnits} placeholder slots.
                    After generating, use the <strong>Drawing</strong> feature to randomly assign
                    the {registeredUnits} registered units to these slots.
                    {placeholderCount > 0 && ` Units facing empty slots will get a bye.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || targetUnits < 2}
            className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Generate Schedule
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
