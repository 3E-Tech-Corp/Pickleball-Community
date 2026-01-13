import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Shuffle, Users, Check, Play, AlertCircle, Loader2, Eye, EyeOff, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';

// Spinning wheel component
function SpinningWheel({
  items,
  isSpinning,
  selectedIndex,
  size = 300,
  onSpinEnd
}) {
  const canvasRef = useRef(null);
  const rotationRef = useRef(0);
  const animationRef = useRef(null);
  const [currentRotation, setCurrentRotation] = useState(0);

  const colors = [
    '#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
    '#EC4899', '#6366F1', '#14B8A6', '#F472B6', '#84CC16', '#06B6D4'
  ];

  const drawWheel = useCallback((rotation = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / items.length;

    // Draw wheel slices
    items.forEach((item, index) => {
      const startAngle = rotation + index * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;

      const text = (item.displayName || item.name || `Unit ${index + 1}`).substring(0, 18);
      ctx.fillText(text, radius - 20, 4);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#1F2937';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 5, centerY);
    ctx.lineTo(centerX + radius - 15, centerY - 12);
    ctx.lineTo(centerX + radius - 15, centerY + 12);
    ctx.closePath();
    ctx.fillStyle = '#1F2937';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [items, colors]);

  useEffect(() => {
    drawWheel(currentRotation);
  }, [currentRotation, drawWheel]);

  useEffect(() => {
    if (isSpinning && items.length > 0) {
      const sliceAngle = (2 * Math.PI) / items.length;
      // Calculate target rotation to land on selected index
      const targetSlice = items.length - 1 - selectedIndex; // Reverse because we're going clockwise
      const baseRotation = targetSlice * sliceAngle + sliceAngle / 2;
      const extraSpins = 5 * 2 * Math.PI; // 5 full rotations
      const targetRotation = rotationRef.current + extraSpins + baseRotation;

      const startTime = performance.now();
      const duration = 4000; // 4 seconds
      const startRotation = rotationRef.current;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease out cubic)
        const eased = 1 - Math.pow(1 - progress, 3);

        const newRotation = startRotation + (targetRotation - startRotation) * eased;
        rotationRef.current = newRotation;
        setCurrentRotation(newRotation);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          rotationRef.current = targetRotation;
          setCurrentRotation(targetRotation);
          onSpinEnd?.();
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isSpinning, selectedIndex, items.length, onSpinEnd]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="drop-shadow-xl"
      />
      {isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-orange-400/20 via-transparent to-orange-400/20 rounded-full" />
        </div>
      )}
    </div>
  );
}

// Confetti effect component
function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: ['#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'][Math.floor(Math.random() * 6)]
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-full animate-confetti"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`
          }}
        />
      ))}
    </div>
  );
}

// Slot machine style number display
function SlotNumber({ number, isAnimating, isFinal }) {
  const [displayNumber, setDisplayNumber] = useState(number || '?');

  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        setDisplayNumber(Math.floor(Math.random() * 32) + 1);
      }, 50);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setDisplayNumber(number);
      }, 1000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (isFinal) {
      setDisplayNumber(number);
    }
  }, [isAnimating, number, isFinal]);

  return (
    <div className={`
      w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold
      transition-all duration-300 transform
      ${isAnimating ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white scale-110 animate-pulse' :
        isFinal ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
        'bg-gray-200 text-gray-600'}
    `}>
      {displayNumber}
    </div>
  );
}

// Helper function to get display name for a unit
function getUnitDisplayName(unit, unitSize) {
  // For doubles (unit size 2), use player names
  if (unitSize === 2 && unit.members && unit.members.length > 0) {
    const playerNames = unit.members.map(m => {
      if (m.firstName && m.lastName) {
        return `${m.firstName} ${m.lastName.charAt(0)}.`;
      }
      return m.firstName || m.lastName || 'Player';
    });
    if (playerNames.length >= 2) {
      return `${playerNames[0]} / ${playerNames[1]}`;
    }
    return playerNames[0] || unit.name || `Unit ${unit.id}`;
  }
  // For singles or teams, use unit name
  return unit.name || `Unit ${unit.id}`;
}

export default function DrawingModal({
  isOpen,
  onClose,
  division,
  units = [],
  schedule = null,
  onDraw,
  isDrawing = false
}) {
  const [phase, setPhase] = useState('ready'); // ready, spinning, revealing, complete
  const [drawnAssignments, setDrawnAssignments] = useState([]);
  const [currentDrawIndex, setCurrentDrawIndex] = useState(-1);
  const [showPreview, setShowPreview] = useState(false);
  const [wheelUnits, setWheelUnits] = useState([]);
  const [selectedWheelIndex, setSelectedWheelIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Get unit size from division
  const unitSize = division?.unitSize || 1;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('ready');
      setDrawnAssignments([]);
      setCurrentDrawIndex(-1);
      setShowPreview(false);
      setShowConfetti(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get registered units that need to be assigned
  const registeredUnits = units.filter(u => u.status !== 'Cancelled' && u.status !== 'Waitlisted');

  // Get total slots from schedule (target units)
  const totalSlots = schedule?.rounds?.reduce((max, round) => {
    const matchNumbers = round.matches?.flatMap(m => [m.unit1Number, m.unit2Number]).filter(Boolean) || [];
    return Math.max(max, ...matchNumbers, 0);
  }, 0) || 0;

  const emptySlots = totalSlots - registeredUnits.length;
  const alreadyAssigned = registeredUnits.some(u => u.unitNumber != null);

  const handleStartDraw = async () => {
    // Create shuffled slots
    const slots = Array.from({ length: totalSlots }, (_, i) => i + 1);
    const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);

    // Create assignments
    const assignments = registeredUnits.map((unit, idx) => ({
      unit,
      assignedNumber: shuffledSlots[idx]
    }));

    // Set up wheel with remaining units (include display names)
    const unitsWithDisplayNames = registeredUnits.map(u => ({
      ...u,
      displayName: getUnitDisplayName(u, unitSize)
    }));
    setWheelUnits(unitsWithDisplayNames);
    setPhase('spinning');
    setCurrentDrawIndex(0);

    // Animate through each unit
    for (let i = 0; i < assignments.length; i++) {
      setCurrentDrawIndex(i);

      // Set wheel for current draw
      const remainingUnits = registeredUnits.filter((_, idx) =>
        !assignments.slice(0, i).some(a => a.unit.id === registeredUnits[idx].id)
      ).map(u => ({
        ...u,
        displayName: getUnitDisplayName(u, unitSize)
      }));
      setWheelUnits(remainingUnits);

      // Find index in remaining units
      const currentUnit = assignments[i].unit;
      const wheelIndex = remainingUnits.findIndex(u => u.id === currentUnit.id);
      setSelectedWheelIndex(wheelIndex);

      // Wait for wheel spin
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 4500 : 2500));

      // Add to drawn assignments
      setDrawnAssignments(prev => [...prev, assignments[i]]);
    }

    // Sort final assignments by number
    const sortedAssignments = [...assignments].sort((a, b) => a.assignedNumber - b.assignedNumber);
    setDrawnAssignments(sortedAssignments);
    setPhase('complete');
    setShowConfetti(true);
  };

  const handleConfirmDraw = async () => {
    const assignments = drawnAssignments.map(a => ({
      unitId: a.unit.id,
      unitNumber: a.assignedNumber
    }));

    await onDraw(assignments);
  };

  const handleReDraw = () => {
    setPhase('ready');
    setDrawnAssignments([]);
    setCurrentDrawIndex(-1);
    setShowConfetti(false);
  };

  // Get matches that would be byes
  const getByeMatches = () => {
    if (!schedule?.rounds) return [];
    const assignedSlots = new Set(drawnAssignments.map(a => a.assignedNumber));
    const byes = [];

    schedule.rounds.forEach(round => {
      round.matches?.forEach(match => {
        const slot1Assigned = assignedSlots.has(match.unit1Number);
        const slot2Assigned = assignedSlots.has(match.unit2Number);

        if (slot1Assigned && !slot2Assigned) {
          const unit = drawnAssignments.find(a => a.assignedNumber === match.unit1Number)?.unit;
          if (unit) byes.push({ unit, round: round.roundName || `Round ${round.roundNumber}` });
        } else if (!slot1Assigned && slot2Assigned) {
          const unit = drawnAssignments.find(a => a.assignedNumber === match.unit2Number)?.unit;
          if (unit) byes.push({ unit, round: round.roundName || `Round ${round.roundNumber}` });
        }
      });
    });

    return byes;
  };

  const byeMatches = phase === 'complete' ? getByeMatches() : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
      `}</style>

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <Confetti active={showConfetti} />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
              <Shuffle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Unit Drawing</h2>
              <p className="text-sm text-gray-400">{division?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats bar */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{registeredUnits.length}</div>
              <div className="text-xs text-gray-400">Teams</div>
            </div>
            <div className="w-px bg-gray-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{totalSlots}</div>
              <div className="text-xs text-gray-400">Slots</div>
            </div>
            {emptySlots > 0 && (
              <>
                <div className="w-px bg-gray-700" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{emptySlots}</div>
                  <div className="text-xs text-gray-400">Byes</div>
                </div>
              </>
            )}
          </div>

          {/* Ready state */}
          {phase === 'ready' && (
            <div className="text-center py-8">
              <div className="w-32 h-32 mx-auto mb-6 relative animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-full opacity-20 animate-ping" />
                <div className="relative w-full h-full bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Ready to Draw!</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Spin the wheel to randomly assign {registeredUnits.length} {unitSize === 2 ? 'doubles teams' : unitSize === 1 ? 'players' : 'teams'} to their bracket positions.
                {emptySlots > 0 && ` ${emptySlots} slot${emptySlots !== 1 ? 's' : ''} will be byes.`}
              </p>

              {/* Instructions */}
              <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 mb-6 max-w-lg mx-auto text-left">
                <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  How It Works
                </h4>
                <ol className="text-sm text-gray-300 space-y-2">
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">1.</span>
                    <span>Click "Start Drawing" to begin the random draw process.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">2.</span>
                    <span>The wheel will spin and randomly select each {unitSize === 2 ? 'team' : unitSize === 1 ? 'player' : 'unit'}'s bracket position.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">3.</span>
                    <span>Once complete, review the assignments and click "Confirm & Save" to finalize.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-400 font-bold">4.</span>
                    <span>Not happy? Click "Re-Draw" to start over with a fresh random draw.</span>
                  </li>
                </ol>
              </div>

              {alreadyAssigned && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Some units already have positions. This will reassign all.
                  </div>
                </div>
              )}

              <button
                onClick={handleStartDraw}
                disabled={isDrawing || registeredUnits.length === 0}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 inline-flex items-center gap-3 shadow-lg shadow-orange-500/30"
              >
                <Play className="w-6 h-6" />
                Start Drawing
              </button>
            </div>
          )}

          {/* Spinning state */}
          {phase === 'spinning' && wheelUnits.length > 0 && (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <SpinningWheel
                  items={wheelUnits}
                  isSpinning={true}
                  selectedIndex={selectedWheelIndex}
                  size={280}
                />
              </div>

              <div className="bg-gray-800 rounded-xl p-4 max-w-sm mx-auto">
                <div className="text-sm text-gray-400 mb-2">Drawing team {currentDrawIndex + 1} of {registeredUnits.length}</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentDrawIndex + 1) / registeredUnits.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Live assignments */}
              {drawnAssignments.length > 0 && (
                <div className="mt-4 max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap justify-center gap-2">
                    {drawnAssignments.map((a, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2 animate-fade-in"
                      >
                        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                          {a.assignedNumber}
                        </span>
                        <span className="text-white text-sm">{getUnitDisplayName(a.unit, unitSize).substring(0, 15)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complete state */}
          {phase === 'complete' && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full text-green-400">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Drawing Complete!</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Final Assignments</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>

              <div className="bg-gray-800/50 rounded-xl border border-gray-700 divide-y divide-gray-700 max-h-64 overflow-y-auto mb-4">
                {Array.from({ length: totalSlots }, (_, i) => i + 1).map(slotNum => {
                  const assignment = drawnAssignments.find(a => a.assignedNumber === slotNum);

                  return (
                    <div
                      key={slotNum}
                      className={`flex items-center justify-between p-3 ${
                        assignment ? 'hover:bg-gray-700/50' : 'bg-gray-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                          assignment
                            ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white'
                            : 'bg-gray-700 text-gray-500'
                        }`}>
                          {slotNum}
                        </div>
                        {assignment ? (
                          <div>
                            <div className="font-medium text-white">
                              {getUnitDisplayName(assignment.unit, unitSize)}
                            </div>
                            {unitSize !== 2 && assignment.unit.members && assignment.unit.members.length > 0 && (
                              <div className="text-sm text-gray-400">
                                {assignment.unit.members.map(m =>
                                  m.lastName && m.firstName ? `${m.lastName}, ${m.firstName}` : (m.lastName || m.firstName || 'Player')
                                ).join(' & ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">Empty slot (bye)</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Byes info */}
              {byeMatches.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    First Round Byes ({byeMatches.length})
                  </h4>
                  <div className="space-y-1 text-sm text-yellow-300/80">
                    {byeMatches.slice(0, 3).map((bye, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-medium">{getUnitDisplayName(bye.unit, unitSize)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>advances in {bye.round}</span>
                      </div>
                    ))}
                    {byeMatches.length > 3 && (
                      <div className="text-yellow-500">... and {byeMatches.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Schedule preview */}
              {showPreview && schedule?.rounds && (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden mb-4">
                  <div className="bg-gray-700/50 px-4 py-2 font-medium text-gray-300 border-b border-gray-700">
                    Schedule Preview
                  </div>
                  <div className="divide-y divide-gray-700 max-h-48 overflow-y-auto">
                    {schedule.rounds.slice(0, 2).map((round, roundIdx) => (
                      <div key={roundIdx} className="p-3">
                        <div className="text-sm font-medium text-gray-400 mb-2">
                          {round.roundName || `Round ${round.roundNumber}`}
                        </div>
                        <div className="space-y-2">
                          {round.matches?.slice(0, 4).map((match, matchIdx) => {
                            const unit1 = drawnAssignments.find(a => a.assignedNumber === match.unit1Number)?.unit;
                            const unit2 = drawnAssignments.find(a => a.assignedNumber === match.unit2Number)?.unit;

                            return (
                              <div key={matchIdx} className="flex items-center justify-between text-sm bg-gray-700/50 rounded px-3 py-2">
                                <span className={unit1 ? 'text-white' : 'text-gray-500 italic'}>
                                  {unit1 ? getUnitDisplayName(unit1, unitSize) : 'BYE'}
                                </span>
                                <span className="text-gray-500 text-xs">vs</span>
                                <span className={unit2 ? 'text-white' : 'text-gray-500 italic'}>
                                  {unit2 ? getUnitDisplayName(unit2, unitSize) : 'BYE'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-700 bg-gray-800/50">
          {phase === 'complete' ? (
            <>
              <button
                onClick={handleConfirmDraw}
                disabled={isDrawing}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm & Save
                  </>
                )}
              </button>
              <button
                onClick={handleReDraw}
                disabled={isDrawing}
                className="px-5 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Re-Draw
              </button>
            </>
          ) : phase === 'ready' ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <div className="flex-1 py-3 text-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Drawing in progress...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
