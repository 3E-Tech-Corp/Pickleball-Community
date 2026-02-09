import { useState, useMemo } from 'react';
import { 
  RefreshCcw, GitBranch, Layers, Trophy, Medal,
  ChevronRight, Grid3X3, List, ZoomIn, ZoomOut
} from 'lucide-react';

/**
 * PhaseFlowVisualization - Visual canvas showing tournament phase flow
 * Similar to the Structure editor but read-only for template preview
 */
export default function PhaseFlowVisualization({ phases = [], showListToggle = true }) {
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' | 'list'
  const [zoom, setZoom] = useState(1);

  if (!phases || phases.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <div className="text-center">
          <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No phases to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Toolbar */}
      {showListToggle && (
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'canvas' 
                  ? 'bg-white shadow text-purple-700 border' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Canvas
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white shadow text-purple-700 border' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
          
          {viewMode === 'canvas' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {viewMode === 'canvas' ? (
        <CanvasView phases={phases} zoom={zoom} />
      ) : (
        <ListView phases={phases} />
      )}
    </div>
  );
}

/**
 * Canvas view - Visual flow diagram
 */
function CanvasView({ phases, zoom }) {
  // Calculate layout
  const layout = useMemo(() => {
    return calculateLayout(phases);
  }, [phases]);

  return (
    <div 
      className="relative overflow-auto bg-gradient-to-b from-gray-50 to-white"
      style={{ minHeight: '300px', maxHeight: '500px' }}
    >
      <div 
        className="relative p-6"
        style={{ 
          transform: `scale(${zoom})`, 
          transformOrigin: 'top center',
          minWidth: layout.width,
          minHeight: layout.height
        }}
      >
        {/* Connection lines (SVG) */}
        <svg 
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: layout.width, height: layout.height }}
        >
          {layout.connections.map((conn, i) => (
            <g key={i}>
              <path
                d={conn.path}
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2"
                strokeDasharray="6 4"
                markerEnd="url(#arrowhead)"
              />
              {conn.label && (
                <text
                  x={conn.labelX}
                  y={conn.labelY}
                  className="text-xs fill-purple-600 font-medium"
                  textAnchor="middle"
                >
                  {conn.label}
                </text>
              )}
            </g>
          ))}
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#a78bfa" />
            </marker>
          </defs>
        </svg>

        {/* Phase nodes */}
        {layout.nodes.map((node, i) => (
          <PhaseNode 
            key={node.phase.order || i} 
            phase={node.phase} 
            x={node.x} 
            y={node.y}
            isFirst={i === 0}
            isLast={!node.hasChildren}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual phase node in canvas view
 */
function PhaseNode({ phase, x, y, isFirst, isLast }) {
  const getPhaseColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'roundrobin':
      case 'pools':
        return 'bg-emerald-500';
      case 'singleelimination':
      case 'bracket':
      case 'bracketround':
        return 'bg-amber-500';
      case 'doubleelimination':
        return 'bg-purple-500';
      case 'award':
        return 'bg-yellow-400';
      default:
        return 'bg-blue-500';
    }
  };

  const getPhaseIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'roundrobin':
        return <RefreshCcw className="w-4 h-4" />;
      case 'pools':
        return <Layers className="w-4 h-4" />;
      case 'singleelimination':
      case 'bracket':
      case 'bracketround':
        return <GitBranch className="w-4 h-4" />;
      case 'award':
        return <Trophy className="w-4 h-4" />;
      default:
        return <GitBranch className="w-4 h-4" />;
    }
  };

  // Award nodes have different styling
  const isAward = phase.type?.toLowerCase() === 'award';

  return (
    <div 
      className="absolute"
      style={{ left: x, top: y, transform: 'translate(-50%, 0)' }}
    >
      <div 
        className={`
          rounded-lg shadow-md border-2 min-w-[140px]
          ${isAward 
            ? 'border-yellow-400 bg-gradient-to-b from-yellow-50 to-yellow-100' 
            : 'border-gray-200 bg-white'
          }
        `}
      >
        {/* Header */}
        <div className={`${getPhaseColor(phase.type)} text-white px-3 py-2 rounded-t-md flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {getPhaseIcon(phase.type)}
            <span className="font-medium text-sm truncate max-w-[100px]">
              {phase.name || phase.type}
            </span>
          </div>
          <span className="text-xs opacity-80">#{phase.order}</span>
        </div>
        
        {/* Body */}
        <div className="px-3 py-2 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>{phase.type}</span>
            <span className="text-gray-400">
              {phase.incomingSlots || phase.inSlots} in → {phase.exitingSlots || phase.outSlots} out
            </span>
          </div>
          {phase.poolCount > 1 && (
            <div className="mt-1 text-purple-600">
              {phase.poolCount} pools
            </div>
          )}
        </div>
      </div>
      
      {/* Connection dot */}
      <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-purple-400 rounded-full border-2 border-white" />
    </div>
  );
}

/**
 * List view - Traditional list display
 */
function ListView({ phases }) {
  return (
    <div className="divide-y">
      {phases.map((phase, index) => (
        <div key={phase.order || index} className="p-4 flex items-center">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center mr-4">
            {phase.order || index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{phase.name}</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {phase.type}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
              <span>{phase.incomingSlots || phase.inSlots} teams in</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
              <span>{phase.exitingSlots || phase.outSlots} advance</span>
              {phase.poolCount > 1 && <span>• {phase.poolCount} pools</span>}
              {phase.encounterCount && <span>• ~{phase.encounterCount} matches</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Calculate node positions and connection paths for the flow diagram
 */
function calculateLayout(phases) {
  const nodeWidth = 160;
  const nodeHeight = 80;
  const horizontalGap = 80;
  const verticalGap = 100;
  const padding = 40;

  // Simple top-down layout
  // Group phases by "level" based on their order and advancement
  const levels = [];
  let currentLevel = [];
  let lastOrder = 0;

  phases.forEach((phase, i) => {
    if (phase.order > lastOrder + 1 || i === 0) {
      if (currentLevel.length > 0) levels.push(currentLevel);
      currentLevel = [phase];
    } else {
      currentLevel.push(phase);
    }
    lastOrder = phase.order || i + 1;
  });
  if (currentLevel.length > 0) levels.push(currentLevel);

  // For simplicity, just do a linear top-down layout
  const nodes = [];
  const connections = [];
  
  let y = padding;
  const centerX = Math.max(...phases.map((_, i) => i + 1)) * (nodeWidth + horizontalGap) / 2 + padding;

  phases.forEach((phase, i) => {
    const x = centerX;
    nodes.push({
      phase,
      x,
      y,
      hasChildren: i < phases.length - 1
    });

    // Add connection to next phase
    if (i < phases.length - 1) {
      const nextY = y + nodeHeight + verticalGap;
      const advancingCount = phase.exitingSlots || phase.outSlots || '?';
      
      connections.push({
        path: `M ${x} ${y + nodeHeight} Q ${x} ${y + nodeHeight + verticalGap/2} ${x} ${nextY}`,
        label: advancingCount,
        labelX: x + 20,
        labelY: y + nodeHeight + verticalGap/2
      });
    }

    y += nodeHeight + verticalGap;
  });

  return {
    nodes,
    connections,
    width: centerX * 2,
    height: y + padding
  };
}
