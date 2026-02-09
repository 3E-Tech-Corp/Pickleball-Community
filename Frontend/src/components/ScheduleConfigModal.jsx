import { useState, useEffect } from 'react';
import {
  X, FileText, ChevronDown, ChevronRight, Users, Trophy, GitBranch,
  Grid3X3, Layers, Zap, Check, Loader2, Eye, ArrowRight, AlertTriangle,
  Table, LayoutGrid
} from 'lucide-react';
import { tournamentApi } from '../services/api';

const CATEGORY_INFO = {
  SingleElimination: { icon: GitBranch, label: 'Single Elimination', color: 'text-blue-600' },
  DoubleElimination: { icon: GitBranch, label: 'Double Elimination', color: 'text-purple-600' },
  RoundRobin: { icon: Grid3X3, label: 'Round Robin', color: 'text-green-600' },
  Pools: { icon: Layers, label: 'Pool Play', color: 'text-orange-600' },
  Combined: { icon: Zap, label: 'Pools + Bracket', color: 'text-indigo-600' },
  Custom: { icon: FileText, label: 'Custom', color: 'text-gray-600' },
};

/**
 * ScheduleConfigModal - Template-first tournament format selection
 * Shows templates with preview, applies with confirmation
 */
export default function ScheduleConfigModal({
  isOpen,
  onClose,
  division,
  onGenerate,
  isGenerating = false
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['Combined', 'SingleElimination']);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [customUnitCount, setCustomUnitCount] = useState(division?.registeredUnits || 8);
  const [activeTab, setActiveTab] = useState('system'); // 'my' | 'system'
  const [previewTab, setPreviewTab] = useState('visual'); // 'visual' | 'data'
  const [showConfirmation, setShowConfirmation] = useState(false);

  const unitCount = division?.registeredUnits || 8;
  const divisionId = division?.id;

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setCustomUnitCount(unitCount);
    }
  }, [isOpen, unitCount]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const [systemResponse, myResponse] = await Promise.all([
        tournamentApi.getPhaseTemplates(),
        tournamentApi.getMyPhaseTemplates().catch(() => [])
      ]);
      
      const systemTemplates = (Array.isArray(systemResponse) ? systemResponse : (systemResponse?.data || systemResponse || []))
        .map(t => ({ ...t, isSystem: true }));
      const myTemplates = (Array.isArray(myResponse) ? myResponse : (myResponse?.data || myResponse || []))
        .map(t => ({ ...t, isSystem: false }));
      
      setTemplates([...myTemplates, ...systemTemplates]);
      
      // Default to 'my' tab if user has templates, otherwise 'system'
      setActiveTab(myTemplates.length > 0 ? 'my' : 'system');
    } catch (err) {
      setError('Failed to load templates');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    setCustomUnitCount(unitCount || template.defaultUnits);

    try {
      setPreviewLoading(true);
      const response = await tournamentApi.previewTemplate(
        template.id,
        divisionId,
        unitCount || template.defaultUnits
      );
      setPreview(response?.data || response);
    } catch (err) {
      console.error('Error loading preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyClick = () => {
    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const handleConfirmApply = async () => {
    if (!selectedTemplate) return;
    setShowConfirmation(false);

    try {
      setApplying(true);
      const response = await tournamentApi.applyTemplate(
        selectedTemplate.id,
        divisionId,
        customUnitCount,
        true // clear existing phases
      );

      const result = response?.data || response;
      if (result?.success !== false) {
        // Auto-generate schedules for each created phase
        const phaseIds = result?.createdPhaseIds || [];
        for (const phaseId of phaseIds) {
          try {
            await tournamentApi.generatePhaseSchedule(phaseId);
          } catch (scheduleErr) {
            console.warn(`Failed to generate schedule for phase ${phaseId}:`, scheduleErr);
          }
        }
        onGenerate?.(result);
        onClose();
      } else {
        alert('Failed to apply template: ' + (result?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error applying template:', err);
      alert('Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || 'Custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  // Filter templates suitable for current unit count
  const suitableTemplates = templates.filter(t =>
    t.minUnits <= customUnitCount && t.maxUnits >= customUnitCount
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Configure Schedule
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {division?.name} • {unitCount} registered {unitCount === 1 ? 'team' : 'teams'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <span className="ml-3 text-gray-600">Loading templates...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex">
            {/* Template List - Left Side */}
            <div className="w-[400px] border-r overflow-y-auto">
              {/* Tab toggle */}
              <div className="sticky top-0 bg-white p-4 border-b z-10">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setActiveTab('my')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'my' ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    My Templates ({templates.filter(t => !t.isSystem).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('system')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'system' ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    System ({templates.filter(t => t.isSystem).length})
                  </button>
                </div>
              </div>

              <div className="p-4">
                {/* Recommended templates */}
                {suitableTemplates.filter(t => activeTab === 'my' ? !t.isSystem : t.isSystem).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                      <Zap className="w-4 h-4 mr-1.5 text-amber-500" />
                      Recommended for {customUnitCount} teams
                    </h3>
                    <div className="space-y-2">
                      {suitableTemplates
                        .filter(t => activeTab === 'my' ? !t.isSystem : t.isSystem)
                        .slice(0, 3)
                        .map(template => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            isSelected={selectedTemplate?.id === template.id}
                            onSelect={() => handleSelectTemplate(template)}
                            recommended
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* All templates by category */}
                <h3 className="text-sm font-semibold text-gray-700 mb-3">All Formats</h3>
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
                  const filteredTemplates = categoryTemplates.filter(t => 
                    activeTab === 'my' ? !t.isSystem : t.isSystem
                  );
                  if (filteredTemplates.length === 0) return null;
                  
                  const categoryInfo = CATEGORY_INFO[category] || CATEGORY_INFO.Custom;
                  const isExpanded = expandedCategories.includes(category);
                  const CategoryIcon = categoryInfo.icon;

                  return (
                    <div key={category} className="mb-2">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                          )}
                          <CategoryIcon className={`w-4 h-4 mr-2 ${categoryInfo.color}`} />
                          <span className="font-medium text-gray-700">{categoryInfo.label}</span>
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {filteredTemplates.length}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="ml-6 mt-1 space-y-1">
                          {filteredTemplates.map(template => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              isSelected={selectedTemplate?.id === template.id}
                              onSelect={() => handleSelectTemplate(template)}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Empty state */}
                {activeTab === 'my' && templates.filter(t => !t.isSystem).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No custom templates</p>
                    <p className="text-sm mt-1">Save formats from tournaments to reuse later</p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Panel - Right Side */}
            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
              {!selectedTemplate ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Eye className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a template</p>
                    <p className="text-sm mt-1">Choose from the list to see preview</p>
                  </div>
                </div>
              ) : previewLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : (
                <div className="p-6 flex flex-col h-full">
                  {/* Template header */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h3>
                    {selectedTemplate.description && (
                      <p className="text-gray-600 mt-1">{selectedTemplate.description}</p>
                    )}
                  </div>

                  {/* Team count */}
                  <div className="mb-4 p-4 bg-white rounded-xl border shadow-sm">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Number of Teams
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={customUnitCount}
                        onChange={(e) => setCustomUnitCount(parseInt(e.target.value) || selectedTemplate.defaultUnits)}
                        min={selectedTemplate.minUnits}
                        max={selectedTemplate.maxUnits}
                        className="w-24 px-3 py-2 border rounded-lg text-center text-lg font-semibold"
                      />
                      <span className="text-sm text-gray-500">
                        (Range: {selectedTemplate.minUnits}-{selectedTemplate.maxUnits})
                      </span>
                    </div>
                  </div>

                  {/* Preview tabs */}
                  <div className="flex gap-1 mb-4">
                    <button
                      onClick={() => setPreviewTab('visual')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                        previewTab === 'visual' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      Visual View
                    </button>
                    <button
                      onClick={() => setPreviewTab('data')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                        previewTab === 'data' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Table className="w-4 h-4" />
                      Data View
                    </button>
                  </div>

                  {/* Preview content */}
                  <div className="flex-1 overflow-y-auto">
                    {previewTab === 'visual' ? (
                      <VisualPreview preview={preview} />
                    ) : (
                      <DataPreview preview={preview} template={selectedTemplate} />
                    )}
                  </div>

                  {/* Summary stats */}
                  {preview && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                      <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
                        <div className="text-3xl font-bold text-blue-600">
                          {preview.phases?.length || 0}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Phases</div>
                      </div>
                      <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
                        <div className="text-3xl font-bold text-green-600">
                          {preview.totalEncounters || 0}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Total Matches</div>
                      </div>
                      <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
                        <div className="text-3xl font-bold text-purple-600">
                          {customUnitCount}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Teams</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>

          <button
            onClick={handleApplyClick}
            disabled={!selectedTemplate || applying || isGenerating}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors font-medium shadow-sm"
          >
            {applying || isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply Template
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Confirm Schedule Change</h3>
                <p className="text-gray-600 mt-2">
                  Applying this template will reset:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    All existing phases and matches
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    Game format configurations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    Court time assignments
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    Any entered scores
                  </li>
                </ul>
                <p className="text-amber-700 font-medium mt-3 text-sm">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApply}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Yes, Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Template card component
 */
function TemplateCard({ template, isSelected, onSelect, recommended = false, compact = false }) {
  const categoryInfo = CATEGORY_INFO[template.category] || CATEGORY_INFO.Custom;
  const CategoryIcon = categoryInfo.icon;
  const suitableForRange = `${template.minUnits}-${template.maxUnits} teams`;

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`w-full text-left p-2.5 rounded-lg transition-all ${
          isSelected
            ? 'bg-purple-100 border-2 border-purple-400'
            : 'hover:bg-gray-100 border border-transparent'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{template.name}</span>
          <span className="text-xs text-gray-400">{suitableForRange}</span>
        </div>
        {template.diagramText && (
          <div className="text-xs text-gray-500 mt-1 font-mono">{template.diagramText}</div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl transition-all ${
        isSelected
          ? 'bg-purple-100 border-2 border-purple-400 shadow-md'
          : 'bg-white border border-gray-200 hover:border-purple-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-purple-200' : 'bg-gray-100'}`}>
          <CategoryIcon className={`w-5 h-5 ${isSelected ? 'text-purple-600' : categoryInfo.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 truncate">{template.name}</h4>
            {recommended && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                Recommended
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
          )}
          <div className="flex items-center mt-2 text-xs text-gray-400 gap-3">
            <span className="flex items-center">
              <Users className="w-3 h-3 mr-1" />
              {suitableForRange}
            </span>
            {template.diagramText && (
              <span className="font-mono">{template.diagramText}</span>
            )}
          </div>
        </div>
        {isSelected && (
          <Check className="w-5 h-5 text-purple-600 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

/**
 * Visual preview of tournament structure
 */
function VisualPreview({ preview }) {
  if (!preview?.phases) {
    return (
      <div className="text-center text-gray-400 py-8">
        No preview available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Tournament Structure</h4>
      {preview.phases.map((phase, index) => (
        <div key={index} className="flex items-center">
          <div className="flex-1 bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm font-bold flex items-center justify-center shadow-sm">
                  {phase.order}
                </span>
                <span className="font-semibold text-gray-900">{phase.name}</span>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                {phase.type}
              </span>
            </div>
            <div className="mt-3 flex items-center text-sm text-gray-500 gap-4">
              <span className="flex items-center gap-1">
                <ArrowRight className="w-4 h-4 text-green-500" />
                {phase.incomingSlots} in
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                {phase.exitingSlots} out
              </span>
              {phase.poolCount > 1 && (
                <span className="flex items-center gap-1">
                  <Layers className="w-4 h-4 text-blue-500" />
                  {phase.poolCount} pools
                </span>
              )}
              <span className="text-gray-400">
                ~{phase.encounterCount} matches
              </span>
            </div>
          </div>
          {index < preview.phases.length - 1 && (
            <div className="w-10 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-gray-300" />
            </div>
          )}
        </div>
      ))}

      {/* Advancement rules */}
      {preview.advancementRules?.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Advancement Rules</h4>
          <div className="bg-white rounded-xl border divide-y shadow-sm">
            {preview.advancementRules.slice(0, 6).map((rule, index) => (
              <div key={index} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {rule.fromPhase} {rule.fromDescription}
                </span>
                <span className="flex items-center text-gray-400">
                  <ArrowRight className="w-4 h-4 mx-2" />
                  <span className="text-gray-700 font-medium">
                    {rule.toPhase} Slot {rule.toSlot}
                  </span>
                </span>
              </div>
            ))}
            {preview.advancementRules.length > 6 && (
              <div className="px-4 py-2 text-gray-400 text-center text-sm">
                +{preview.advancementRules.length - 6} more rules
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Data table view of template
 */
function DataPreview({ preview, template }) {
  if (!preview?.phases) {
    return (
      <div className="text-center text-gray-400 py-8">
        No preview available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase data table */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Phase Details</h4>
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Phase</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">In</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Out</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Pools</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Matches</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.phases.map((phase, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{phase.order}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{phase.name}</td>
                  <td className="px-4 py-3 text-gray-600">{phase.type}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{phase.incomingSlots}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{phase.exitingSlots}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{phase.poolCount || 1}</td>
                  <td className="px-4 py-3 text-center text-gray-600">~{phase.encounterCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template metadata */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Template Info</h4>
        <div className="bg-white rounded-xl border p-4 shadow-sm space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Category</span>
            <span className="font-medium text-gray-900">{template.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Team Range</span>
            <span className="font-medium text-gray-900">{template.minUnits}-{template.maxUnits}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Default Teams</span>
            <span className="font-medium text-gray-900">{template.defaultUnits}</span>
          </div>
          {template.diagramText && (
            <div className="flex justify-between">
              <span className="text-gray-500">Diagram</span>
              <span className="font-mono text-gray-900">{template.diagramText}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
