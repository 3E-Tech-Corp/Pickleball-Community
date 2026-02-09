import { useState, useEffect } from 'react';
import {
  FileText, ChevronDown, ChevronRight, Users, Trophy, GitBranch,
  Grid3X3, Layers, Zap, Check, X, Loader2, ArrowRight
} from 'lucide-react';
import { tournamentApi } from '../../services/api';
import PhaseFlowVisualization from './PhaseFlowVisualization';

const CATEGORY_INFO = {
  SingleElimination: { icon: GitBranch, label: 'Single Elimination', color: 'text-blue-600', bg: 'bg-blue-50' },
  DoubleElimination: { icon: GitBranch, label: 'Double Elimination', color: 'text-purple-600', bg: 'bg-purple-50' },
  RoundRobin: { icon: Grid3X3, label: 'Round Robin', color: 'text-green-600', bg: 'bg-green-50' },
  Pools: { icon: Layers, label: 'Pool Play', color: 'text-orange-600', bg: 'bg-orange-50' },
  Combined: { icon: Zap, label: 'Pools + Bracket', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  Custom: { icon: FileText, label: 'Custom', color: 'text-gray-600', bg: 'bg-gray-50' },
};

/**
 * TemplateSelector - Select and apply pre-built tournament format templates
 * 
 * Design:
 * - Top tabs: "Standard Templates" | "My Templates"
 * - Left: Template list
 * - Right: Visual flow preview (Canvas/List toggle) with stats
 * - Bottom: Summary stats + Apply button
 */
export default function TemplateSelector({ divisionId, unitCount = 8, onApply, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['Combined', 'SingleElimination', 'Pools']);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [customUnitCount, setCustomUnitCount] = useState(unitCount);
  const [activeTab, setActiveTab] = useState('standard'); // 'standard' | 'my'

  useEffect(() => {
    fetchTemplates();
  }, [unitCount]);

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
      
      // Default to 'my' tab if user has templates, otherwise 'standard'
      if (myTemplates.length > 0) {
        setActiveTab('my');
      } else {
        setActiveTab('standard');
      }
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

  const handleApply = async () => {
    if (!selectedTemplate) return;

    try {
      setApplying(true);
      const response = await tournamentApi.applyTemplate(
        selectedTemplate.id,
        divisionId,
        customUnitCount,
        true
      );

      const result = response?.data || response;
      if (result?.success !== false) {
        const phaseIds = result?.createdPhaseIds || [];
        if (phaseIds.length > 0) {
          for (const phaseId of phaseIds) {
            try {
              await tournamentApi.generatePhaseSchedule(phaseId);
            } catch (scheduleErr) {
              console.warn(`Failed to generate schedule for phase ${phaseId}:`, scheduleErr);
            }
          }
        }
        onApply?.(result);
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
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  // Filter templates by active tab
  const filteredTemplates = templates.filter(t => 
    activeTab === 'my' ? !t.isSystem : t.isSystem
  );

  // Group by category
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category || 'Custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  // Calculate preview stats
  const previewStats = preview ? {
    phases: preview.phases?.length || 0,
    encounters: preview.totalEncounters || preview.phases?.reduce((sum, p) => sum + (p.encounterCount || 0), 0) || 0,
    teams: customUnitCount
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        <span className="ml-2 text-gray-600">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with Tabs */}
        <div className="border-b bg-gray-50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Phase Configuration</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Select a template for {unitCount} teams
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="px-6 flex gap-0 border-b">
            <button
              onClick={() => setActiveTab('standard')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'standard'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Standard Templates
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100">
                {templates.filter(t => t.isSystem).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'my'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Templates
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100">
                {templates.filter(t => !t.isSystem).length}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Template List (Left Panel) */}
          <div className="w-80 border-r overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">
                  {activeTab === 'my' ? 'No custom templates' : 'No templates available'}
                </p>
                {activeTab === 'my' && (
                  <p className="text-sm mt-1">Create templates in "My Templates"</p>
                )}
              </div>
            ) : (
              <div className="p-3">
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
                  const categoryInfo = CATEGORY_INFO[category] || CATEGORY_INFO.Custom;
                  const isExpanded = expandedCategories.includes(category);
                  const CategoryIcon = categoryInfo.icon;

                  return (
                    <div key={category} className="mb-2">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                          )}
                          <div className={`p-1.5 rounded-md mr-2 ${categoryInfo.bg}`}>
                            <CategoryIcon className={`w-4 h-4 ${categoryInfo.color}`} />
                          </div>
                          <span className="font-medium text-gray-700">{categoryInfo.label}</span>
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {categoryTemplates.length}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="ml-2 mt-1 space-y-1">
                          {categoryTemplates.map(template => (
                            <button
                              key={template.id}
                              onClick={() => handleSelectTemplate(template)}
                              className={`w-full text-left p-3 rounded-lg transition-all ${
                                selectedTemplate?.id === template.id
                                  ? 'bg-purple-100 border-2 border-purple-400'
                                  : 'bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800 text-sm">
                                  {template.name}
                                </span>
                                {selectedTemplate?.id === template.id && (
                                  <Check className="w-4 h-4 text-purple-600" />
                                )}
                              </div>
                              {template.diagramText && (
                                <div className="text-xs text-gray-500 mt-1 font-mono">
                                  {template.diagramText}
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">
                                {template.minUnits}-{template.maxUnits} teams
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview Panel (Right) */}
          <div className="flex-1 flex flex-col bg-gray-50">
            {!selectedTemplate ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Select a template to preview</p>
                  <p className="text-sm mt-1">Choose from the list on the left</p>
                </div>
              </div>
            ) : previewLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : (
              <>
                {/* Template Info */}
                <div className="p-4 border-b bg-white">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h3>
                  {selectedTemplate.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
                  )}
                  
                  {/* Team count adjustment */}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-gray-600">Teams:</label>
                    <input
                      type="number"
                      value={customUnitCount}
                      onChange={(e) => setCustomUnitCount(parseInt(e.target.value) || selectedTemplate.defaultUnits)}
                      min={selectedTemplate.minUnits}
                      max={selectedTemplate.maxUnits}
                      className="w-20 px-2 py-1 border rounded text-center text-sm"
                    />
                    <span className="text-xs text-gray-400">
                      ({selectedTemplate.minUnits}-{selectedTemplate.maxUnits})
                    </span>
                  </div>
                </div>

                {/* Visual Preview */}
                <div className="flex-1 overflow-auto p-4">
                  <PhaseFlowVisualization 
                    phases={preview?.phases || []} 
                    showListToggle={true}
                  />
                </div>

                {/* Stats Summary */}
                {previewStats && (
                  <div className="p-4 border-t bg-white">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{previewStats.phases}</div>
                        <div className="text-xs text-purple-600">Phases</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{previewStats.encounters}</div>
                        <div className="text-xs text-green-600">Encounters</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{previewStats.teams}</div>
                        <div className="text-xs text-blue-600">Teams</div>
                      </div>
                    </div>

                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-colors"
                    >
                      {applying ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Applying Template...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5 mr-2" />
                          Apply Template
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
