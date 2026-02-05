import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { tournamentApi } from '../services/api'
import {
  Layers, Plus, Edit2, Trash2, X, RefreshCw, AlertTriangle, Copy, ChevronDown,
  ChevronUp, Code, Save, GitBranch, Trophy, Users, ArrowRight, Zap, Award,
  ArrowLeft, Info, Lightbulb, Search, LayoutList, FileJson, Tag, Hash
} from 'lucide-react'
import Navigation from '../components/ui/Navigation'

// ── Constants ──
const CATEGORIES = [
  { value: 'SingleElimination', label: 'Single Elimination', icon: GitBranch },
  { value: 'DoubleElimination', label: 'Double Elimination', icon: GitBranch },
  { value: 'RoundRobin', label: 'Round Robin', icon: RefreshCw },
  { value: 'Pools', label: 'Pools', icon: Layers },
  { value: 'Combined', label: 'Combined (Pools + Bracket)', icon: Trophy },
  { value: 'Custom', label: 'Custom', icon: Code }
]
const PHASE_TYPES = ['Draw','SingleElimination','DoubleElimination','RoundRobin','Pools','BracketRound','Swiss','Award']
const BRACKET_TYPES = ['SingleElimination','DoubleElimination','BracketRound']
const SEEDING_STRATEGIES = ['CrossPool','Sequential','Manual']
const AWARD_TYPES = ['Gold','Silver','Bronze','none']
const DEFAULT_PHASE = { name:'New Phase', phaseType:'SingleElimination', sortOrder:1, incomingSlotCount:8,
  advancingSlotCount:4, poolCount:0, bestOf:1, matchDurationMinutes:30, seedingStrategy:'Sequential', includeConsolation:false }
const DEFAULT_STRUCTURE = JSON.stringify({ phases:[{ name:'Main Bracket', phaseType:'SingleElimination',
  sortOrder:1, incomingSlotCount:8, advancingSlotCount:1, poolCount:0, bestOf:1, matchDurationMinutes:30 }], advancementRules:[] }, null, 2)
const EMPTY_FORM = { name:'', description:'', category:'SingleElimination', minUnits:4, maxUnits:16, defaultUnits:8, diagramText:'', tags:'', structureJson:DEFAULT_STRUCTURE }

// ── Helpers (matching PhaseTemplatesAdmin data model) ──
function parseStructureToVisual(jsonStr) {
  try {
    const s = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    if (s.isFlexible) return { isFlexible:true, generateBracket:s.generateBracket||{type:'SingleElimination',consolation:false,calculateByes:true}, exitPositions:s.exitPositions||[], phases:[], advancementRules:[] }
    return { isFlexible:false, generateBracket:{type:'SingleElimination',consolation:false,calculateByes:true},
      phases:(s.phases||[]).map((p,i)=>({ name:p.name||`Phase ${i+1}`, phaseType:p.phaseType||p.type||'SingleElimination', sortOrder:p.sortOrder||i+1,
        incomingSlotCount:p.incomingSlotCount??p.incomingSlots??8, advancingSlotCount:p.advancingSlotCount??p.exitingSlots??4, poolCount:p.poolCount||0,
        bestOf:p.bestOf||1, matchDurationMinutes:p.matchDurationMinutes||30, seedingStrategy:p.seedingStrategy||'Sequential',
        includeConsolation:p.includeConsolation||p.hasConsolationMatch||false, awardType:p.awardType||null, drawMethod:p.drawMethod||null })),
      advancementRules:(s.advancementRules||[]).map(r=>({ sourcePhaseOrder:r.sourcePhaseOrder??r.fromPhase??1, targetPhaseOrder:r.targetPhaseOrder??r.toPhase??2,
        finishPosition:r.finishPosition??r.fromRank??1, targetSlotNumber:r.targetSlotNumber??r.toSlot??1, sourcePoolIndex:r.sourcePoolIndex??null })),
      exitPositions:s.exitPositions||[] }
  } catch { return { isFlexible:false, generateBracket:{type:'SingleElimination',consolation:false,calculateByes:true}, phases:[{...DEFAULT_PHASE}], advancementRules:[], exitPositions:[] } }
}

function serializeVisualToJson(vs) {
  if (vs.isFlexible) return JSON.stringify({isFlexible:true,generateBracket:vs.generateBracket,exitPositions:vs.exitPositions},null,2)
  return JSON.stringify({ phases:vs.phases.map((p,i)=>({ name:p.name, phaseType:p.phaseType, sortOrder:i+1,
    incomingSlotCount:parseInt(p.incomingSlotCount)||0, advancingSlotCount:parseInt(p.advancingSlotCount)||0,
    poolCount:p.phaseType==='Pools'?(parseInt(p.poolCount)||0):0, bestOf:parseInt(p.bestOf)||1, matchDurationMinutes:parseInt(p.matchDurationMinutes)||30,
    ...(p.seedingStrategy&&p.seedingStrategy!=='Sequential'?{seedingStrategy:p.seedingStrategy}:{}),
    ...(BRACKET_TYPES.includes(p.phaseType)&&p.includeConsolation?{includeConsolation:true}:{}),
    ...(p.phaseType==='Award'&&p.awardType?{awardType:p.awardType}:{}), ...(p.phaseType==='Draw'&&p.drawMethod?{drawMethod:p.drawMethod}:{}) })),
    advancementRules:vs.advancementRules, ...(vs.exitPositions.length>0?{exitPositions:vs.exitPositions}:{}) },null,2)
}

function autoGenerateRules(phases) {
  const rules = []
  for (let i=0;i<phases.length-1;i++) {
    const src=phases[i], adv=Math.min(parseInt(src.advancingSlotCount)||0,parseInt(phases[i+1].incomingSlotCount)||0)
    if (src.phaseType==='Pools'&&(parseInt(src.poolCount)||0)>1) {
      const pc=parseInt(src.poolCount), app=Math.max(1,Math.floor(adv/pc)); let slot=1
      for(let p=0;p<pc;p++) for(let pos=1;pos<=app;pos++) rules.push({sourcePhaseOrder:i+1,targetPhaseOrder:i+2,finishPosition:pos,targetSlotNumber:slot++,sourcePoolIndex:p})
    } else { for(let pos=1;pos<=adv;pos++) rules.push({sourcePhaseOrder:i+1,targetPhaseOrder:i+2,finishPosition:pos,targetSlotNumber:pos,sourcePoolIndex:null}) }
  }
  return rules
}

// ══════════════════════════════════════════
// PhaseEditor — List-based phase & rules editor
// ══════════════════════════════════════════
const PhaseEditor = ({ visualState: vs, onChange }) => {
  const [collapsed, setCollapsed] = useState(new Set())
  const update = (patch) => onChange({...vs,...patch})
  const toggle = (i) => setCollapsed(p=>{const n=new Set(p);n.has(i)?n.delete(i):n.add(i);return n})
  const updatePhase = (i,f,v) => {const p=[...vs.phases];p[i]={...p[i],[f]:v};update({phases:p})}
  const addPhase = () => {
    const o=vs.phases.length+1, prev=vs.phases[vs.phases.length-1], inc=prev?(parseInt(prev.advancingSlotCount)||4):8
    update({phases:[...vs.phases,{...DEFAULT_PHASE,name:`Phase ${o}`,sortOrder:o,incomingSlotCount:inc,advancingSlotCount:Math.max(1,Math.floor(inc/2))}]})
  }
  const removePhase = (i) => { if(vs.phases.length<=1)return; const phases=vs.phases.filter((_,j)=>j!==i).map((p,j)=>({...p,sortOrder:j+1}))
    const rules=vs.advancementRules.filter(r=>r.sourcePhaseOrder!==i+1&&r.targetPhaseOrder!==i+1).map(r=>({...r,
      sourcePhaseOrder:r.sourcePhaseOrder>i+1?r.sourcePhaseOrder-1:r.sourcePhaseOrder, targetPhaseOrder:r.targetPhaseOrder>i+1?r.targetPhaseOrder-1:r.targetPhaseOrder}))
    update({phases,advancementRules:rules}) }
  const movePhase = (i,d) => { const s=i+d; if(s<0||s>=vs.phases.length)return; const p=[...vs.phases];[p[i],p[s]]=[p[s],p[i]]; update({phases:p.map((x,j)=>({...x,sortOrder:j+1}))}) }
  const updateRule = (i,f,v) => {const r=[...vs.advancementRules];r[i]={...r[i],[f]:v};update({advancementRules:r})}
  const addRule = () => update({advancementRules:[...vs.advancementRules,{sourcePhaseOrder:1,targetPhaseOrder:Math.min(2,vs.phases.length),finishPosition:1,targetSlotNumber:1,sourcePoolIndex:null}]})
  const removeRule = (i) => update({advancementRules:vs.advancementRules.filter((_,j)=>j!==i)})
  const updateExit = (i,f,v) => {const e=[...vs.exitPositions];e[i]={...e[i],[f]:v};update({exitPositions:e})}
  const addExit = () => { const n=vs.exitPositions.length+1; const l=['Champion','Runner-up','3rd Place','4th Place'], a=['Gold','Silver','Bronze','none']
    update({exitPositions:[...vs.exitPositions,{rank:n,label:l[n-1]||`${n}th Place`,awardType:a[n-1]||'none'}]}) }

  const inp = "w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
  return (
    <div className="space-y-4">
      {/* Flexible toggle */}
      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={vs.isFlexible} onChange={()=>update({isFlexible:!vs.isFlexible})} className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"/>
          <span className="text-sm font-medium text-purple-800">Flexible Template</span>
        </label>
        <span className="text-xs text-purple-600">Auto-generates bracket based on team count</span>
      </div>

      {vs.isFlexible ? (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Zap className="w-4 h-4 text-purple-600"/>Bracket Generation Config</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Bracket Type</label>
              <select value={vs.generateBracket.type||'SingleElimination'} onChange={e=>update({generateBracket:{...vs.generateBracket,type:e.target.value}})} className={inp}>
                {PHASE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <label className="flex items-center gap-2 cursor-pointer pt-5"><input type="checkbox" checked={vs.generateBracket.consolation||false}
              onChange={e=>update({generateBracket:{...vs.generateBracket,consolation:e.target.checked}})} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
              <span className="text-sm text-gray-700">Consolation</span></label>
            <label className="flex items-center gap-2 cursor-pointer pt-5"><input type="checkbox" checked={vs.generateBracket.calculateByes||false}
              onChange={e=>update({generateBracket:{...vs.generateBracket,calculateByes:e.target.checked}})} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"/>
              <span className="text-sm text-gray-700">Calculate Byes</span></label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Layers className="w-4 h-4 text-purple-600"/>Phases ({vs.phases.length})</h4>
            <button type="button" onClick={addPhase} className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Plus className="w-3 h-3"/>Add Phase</button>
          </div>
          {vs.phases.map((phase,idx)=>(
            <div key={idx} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b cursor-pointer" onClick={()=>toggle(idx)}>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">{idx+1}</span>
                  <span className="font-medium text-sm text-gray-800">{phase.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{phase.phaseType}</span>
                  <span className="text-xs text-gray-400 hidden sm:inline">{phase.incomingSlotCount} in → {phase.advancingSlotCount} out</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={e=>{e.stopPropagation();movePhase(idx,-1)}} disabled={idx===0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                  <button type="button" onClick={e=>{e.stopPropagation();movePhase(idx,1)}} disabled={idx===vs.phases.length-1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                  <button type="button" onClick={e=>{e.stopPropagation();removePhase(idx)}} disabled={vs.phases.length<=1} className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"><Trash2 className="w-4 h-4"/></button>
                  {collapsed.has(idx)?<ChevronDown className="w-4 h-4 text-gray-400"/>:<ChevronUp className="w-4 h-4 text-gray-400"/>}
                </div>
              </div>
              {!collapsed.has(idx)&&(
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                      <input type="text" value={phase.name} onChange={e=>updatePhase(idx,'name',e.target.value)} className={inp}/></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select value={phase.phaseType} onChange={e=>updatePhase(idx,'phaseType',e.target.value)} className={inp}>
                        {PHASE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Incoming</label>
                      <input type="number" min={1} value={phase.incomingSlotCount} onChange={e=>updatePhase(idx,'incomingSlotCount',parseInt(e.target.value)||0)} className={inp}/></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Advancing</label>
                      <input type="number" min={0} value={phase.advancingSlotCount} onChange={e=>updatePhase(idx,'advancingSlotCount',parseInt(e.target.value)||0)} className={inp}/></div>
                    {phase.phaseType==='Pools'&&<div><label className="block text-xs font-medium text-gray-600 mb-1">Pools</label>
                      <input type="number" min={1} value={phase.poolCount} onChange={e=>updatePhase(idx,'poolCount',parseInt(e.target.value)||0)} className={inp}/></div>}
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Best Of</label>
                      <select value={phase.bestOf} onChange={e=>updatePhase(idx,'bestOf',parseInt(e.target.value))} className={inp}>
                        <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                      <input type="number" min={1} value={phase.matchDurationMinutes} onChange={e=>updatePhase(idx,'matchDurationMinutes',parseInt(e.target.value)||0)} className={inp}/></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Seeding</label>
                      <select value={phase.seedingStrategy||'Sequential'} onChange={e=>updatePhase(idx,'seedingStrategy',e.target.value)} className={inp}>
                        {SEEDING_STRATEGIES.map(s=><option key={s}>{s}</option>)}</select></div>
                  </div>
                  {BRACKET_TYPES.includes(phase.phaseType)&&<label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={phase.includeConsolation||false} onChange={e=>updatePhase(idx,'includeConsolation',e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"/><span className="text-sm text-gray-700">Include consolation bracket</span></label>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Advancement Rules */}
      {!vs.isFlexible&&vs.phases.length>1&&(
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-purple-600"/>Rules ({vs.advancementRules.length})</h4>
            <div className="flex items-center gap-2">
              <button type="button" onClick={()=>update({advancementRules:autoGenerateRules(vs.phases)})}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border"><Zap className="w-3 h-3"/>Auto</button>
              <button type="button" onClick={addRule} className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Plus className="w-3 h-3"/>Add</button>
            </div>
          </div>
          {vs.advancementRules.length===0?<p className="text-sm text-gray-400 italic py-2">No rules. Click "Auto" to generate defaults.</p>:(
            <div className="border rounded-lg overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">Source</th><th className="px-3 py-2 text-left font-medium">Pool</th>
              <th className="px-3 py-2 text-left font-medium">Pos</th><th className="px-3 py-2 w-6"></th>
              <th className="px-3 py-2 text-left font-medium">Target</th><th className="px-3 py-2 text-left font-medium">Slot</th><th className="px-3 py-2 w-8"></th>
            </tr></thead><tbody>{vs.advancementRules.map((rule,i)=>{
              const sp=vs.phases[rule.sourcePhaseOrder-1], hp=sp?.phaseType==='Pools'&&(parseInt(sp.poolCount)||0)>1
              return(<tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1.5"><select value={rule.sourcePhaseOrder} onChange={e=>updateRule(i,'sourcePhaseOrder',parseInt(e.target.value))}
                  className="w-full px-1 py-1 border rounded text-sm">{vs.phases.map((p,j)=><option key={j} value={j+1}>{j+1}. {p.name}</option>)}</select></td>
                <td className="px-3 py-1.5">{hp?<select value={rule.sourcePoolIndex??''} onChange={e=>updateRule(i,'sourcePoolIndex',e.target.value===''?null:parseInt(e.target.value))}
                  className="w-full px-1 py-1 border rounded text-sm"><option value="">Any</option>
                  {Array.from({length:parseInt(sp.poolCount)||0},(_,k)=><option key={k} value={k}>Pool {k+1}</option>)}</select>:<span className="text-gray-400 text-xs">—</span>}</td>
                <td className="px-3 py-1.5"><input type="number" min={1} value={rule.finishPosition} onChange={e=>updateRule(i,'finishPosition',parseInt(e.target.value)||1)}
                  className="w-14 px-1 py-1 border rounded text-sm"/></td>
                <td className="px-1"><ArrowRight className="w-3 h-3 text-purple-400"/></td>
                <td className="px-3 py-1.5"><select value={rule.targetPhaseOrder} onChange={e=>updateRule(i,'targetPhaseOrder',parseInt(e.target.value))}
                  className="w-full px-1 py-1 border rounded text-sm">{vs.phases.map((p,j)=><option key={j} value={j+1}>{j+1}. {p.name}</option>)}</select></td>
                <td className="px-3 py-1.5"><input type="number" min={1} value={rule.targetSlotNumber} onChange={e=>updateRule(i,'targetSlotNumber',parseInt(e.target.value)||1)}
                  className="w-14 px-1 py-1 border rounded text-sm"/></td>
                <td className="px-2 py-1.5"><button type="button" onClick={()=>removeRule(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button></td>
              </tr>)})}</tbody></table></div>)}
        </div>
      )}

      {/* Exit Positions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Award className="w-4 h-4 text-purple-600"/>Exits ({vs.exitPositions.length})</h4>
          <button type="button" onClick={addExit} className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Plus className="w-3 h-3"/>Add</button>
        </div>
        {vs.exitPositions.length===0?<p className="text-sm text-gray-400 italic py-2">No exit positions defined.</p>:(
          <div className="space-y-2">{vs.exitPositions.map((ep,i)=>(
            <div key={i} className="flex items-center gap-2 sm:gap-3 bg-white border rounded-lg px-3 py-2">
              <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold flex-shrink-0">#{ep.rank}</span>
              <input type="number" min={1} value={ep.rank} onChange={e=>updateExit(i,'rank',parseInt(e.target.value)||1)} className="w-14 px-2 py-1 border rounded text-sm"/>
              <input type="text" value={ep.label} onChange={e=>updateExit(i,'label',e.target.value)} placeholder="Label" className="flex-1 min-w-0 px-2 py-1 border rounded text-sm"/>
              <select value={ep.awardType||'none'} onChange={e=>updateExit(i,'awardType',e.target.value)} className="px-2 py-1 border rounded text-sm">
                {AWARD_TYPES.map(a=><option key={a} value={a}>{a==='none'?'No Award':a}</option>)}</select>
              <button type="button" onClick={()=>update({exitPositions:vs.exitPositions.filter((_,j)=>j!==i)})} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>))}</div>)}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// DuplicateFromSystemModal
// ══════════════════════════════════════════
const DuplicateFromSystemModal = ({ onSelect, onClose }) => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')

  useEffect(() => {
    tournamentApi.getPhaseTemplates().then(res => {
      setTemplates((Array.isArray(res)?res:(res.data||[])).filter(t=>t.isSystemTemplate&&t.isActive))
    }).catch(()=>setTemplates([])).finally(()=>setLoading(false))
  }, [])

  const filtered = templates.filter(t => (cat==='all'||t.category===cat) && (!search||t.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Duplicate System Template</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="px-6 py-3 border-b flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"/>
          </div>
          <select value={cat} onChange={e=>setCat(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading?<div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-purple-500"/></div>
          :filtered.length===0?<p className="text-center text-gray-500 py-8">No system templates found.</p>
          :<div className="space-y-2">{filtered.map(t=>(
            <button key={t.id} onClick={()=>onSelect(t)} className="w-full text-left p-3 border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors">
              <div className="flex items-center justify-between">
                <div><div className="font-medium text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.category} · {t.minUnits}–{t.maxUnits} teams{t.description?` · ${t.description.slice(0,60)}${t.description.length>60?'...':''}`:''}</div>
                </div><Copy className="w-4 h-4 text-purple-500 flex-shrink-0"/>
              </div>
            </button>))}</div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// MyTemplates — Main page
// ══════════════════════════════════════════
const MyTemplates = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | template
  const [editorMode, setEditorMode] = useState('visual')
  const [visualState, setVisualState] = useState(null)
  const [formData, setFormData] = useState({...EMPTY_FORM})
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadTemplates = async () => {
    setLoading(true); setError(null)
    try { const r=await tournamentApi.getMyPhaseTemplates(); setTemplates(Array.isArray(r)?r:(r?.data||[])) }
    catch(e){ setError(e.message||'Failed to load templates') } finally{ setLoading(false) }
  }
  useEffect(()=>{loadTemplates()},[])

  const filteredTemplates = categoryFilter==='all'?templates:templates.filter(t=>t.category===categoryFilter)

  const openEditor = (fd, tpl=null) => { setFormData(fd); setVisualState(parseStructureToVisual(fd.structureJson)); setEditorMode('visual'); setEditing(tpl||'new') }
  const handleCreate = () => openEditor({...EMPTY_FORM})
  const templateToForm = (t) => { const s=typeof t.structureJson==='string'?t.structureJson:JSON.stringify(t.structureJson,null,2)
    return { name:t.name, description:t.description||'', category:t.category, minUnits:t.minUnits, maxUnits:t.maxUnits, defaultUnits:t.defaultUnits, diagramText:t.diagramText||'', tags:t.tags||'', structureJson:s } }
  const handleEdit = (t) => openEditor(templateToForm(t), t)
  const handleDuplicate = (t) => openEditor({...templateToForm(t), name:`${t.name} (Copy)`})

  const handleVisualChange = useCallback((newVs) => { setVisualState(newVs); setFormData(p=>({...p,structureJson:serializeVisualToJson(newVs)})) }, [])
  const handleToggleMode = () => { if(editorMode==='visual'){setEditorMode('json')} else {setVisualState(parseStructureToVisual(formData.structureJson));setEditorMode('visual')} }

  const handleSave = async () => {
    try{JSON.parse(formData.structureJson)}catch{alert('Invalid JSON. Fix syntax first.');return}
    if(!formData.name.trim()){alert('Name is required');return}
    setSaving(true)
    try {
      const payload = { name:formData.name.trim(), description:formData.description.trim(), category:formData.category,
        minUnits:parseInt(formData.minUnits), maxUnits:parseInt(formData.maxUnits), defaultUnits:parseInt(formData.defaultUnits),
        diagramText:formData.diagramText.trim(), tags:formData.tags.trim(), structureJson:formData.structureJson, isSystemTemplate:false }
      if(editing&&editing!=='new'&&editing.id) await tournamentApi.updatePhaseTemplate(editing.id,payload)
      else await tournamentApi.createPhaseTemplate(payload)
      setEditing(null); loadTemplates()
    } catch(e){ alert(e.message||'Failed to save') } finally{ setSaving(false) }
  }

  const handleDelete = async (t) => { try{await tournamentApi.deletePhaseTemplate(t.id);setDeleteConfirm(null);loadTemplates()}catch(e){alert(e.message||'Failed to delete')} }

  const sf = (f,v) => setFormData(p=>({...p,[f]:v}))
  const fi = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"

  // ═══ Editor View ═══
  if (editing) return (
    <div className="min-h-screen bg-gray-50">
      <Navigation/>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={()=>setEditing(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5"/><span className="font-medium">Back</span></button>
          <div className="flex items-center gap-2">
            <button onClick={handleToggleMode} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
              {editorMode==='visual'?<Code className="w-4 h-4"/>:<LayoutList className="w-4 h-4"/>}{editorMode==='visual'?'JSON':'Visual'}</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {saving?<RefreshCw className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{saving?'Saving...':'Save'}</button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{editing==='new'?'Create New Template':`Edit: ${formData.name||'Template'}`}</h1>

        {/* Metadata */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Info className="w-5 h-5 text-purple-600"/>Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={e=>sf('name',e.target.value)} placeholder="e.g. 8-Team Single Elimination" className={fi}/></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={e=>sf('description',e.target.value)} rows={2} placeholder="Brief description..." className={fi}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={formData.category} onChange={e=>sf('category',e.target.value)} className={fi}>
                {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                <input type="number" min={2} value={formData.minUnits} onChange={e=>sf('minUnits',parseInt(e.target.value)||2)} className={fi}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
                <input type="number" min={2} value={formData.maxUnits} onChange={e=>sf('maxUnits',parseInt(e.target.value)||2)} className={fi}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Default</label>
                <input type="number" min={2} value={formData.defaultUnits} onChange={e=>sf('defaultUnits',parseInt(e.target.value)||2)} className={fi}/></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input type="text" value={formData.tags} onChange={e=>sf('tags',e.target.value)} placeholder="beginner, quick" className={fi}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Diagram Text</label>
              <input type="text" value={formData.diagramText} onChange={e=>sf('diagramText',e.target.value)} placeholder="Short diagram label" className={fi}/></div>
          </div>
        </div>

        {/* Structure */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-600"/>Structure</h2>
          {editorMode==='visual'&&visualState?<PhaseEditor visualState={visualState} onChange={handleVisualChange}/>:(
            <div><div className="flex items-center gap-2 mb-2"><FileJson className="w-4 h-4 text-gray-500"/><span className="text-sm text-gray-600">Raw JSON</span></div>
              <textarea value={formData.structureJson} onChange={e=>sf('structureJson',e.target.value)} rows={18}
                className="w-full px-4 py-3 border rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-purple-500"/></div>)}
        </div>
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"/>
          <p className="text-sm text-amber-800"><strong>Tip:</strong> Use Visual Editor for phases and rules. Switch to JSON for fine control. Changes sync between modes.</p>
        </div>
      </div>
    </div>
  )

  // ═══ List View ═══
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation/>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900">My Templates</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage your tournament phase templates</p></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowDuplicateModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50">
              <Copy className="w-4 h-4"/>From System</button>
            <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm">
              <Plus className="w-4 h-4"/>New Template</button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={()=>setCategoryFilter('all')} className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${categoryFilter==='all'?'bg-purple-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
          {CATEGORIES.map(c=><button key={c.value} onClick={()=>setCategoryFilter(c.value)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${categoryFilter===c.value?'bg-purple-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c.label}</button>)}
        </div>

        {error&&<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-4 h-4"/><span className="text-sm">{error}</span>
          <button onClick={loadTemplates} className="ml-auto text-sm underline">Retry</button></div>}

        {loading?<div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-purple-500"/></div>
        :filteredTemplates.length===0?(
          <div className="text-center py-16 bg-white rounded-xl border">
            <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">{templates.length===0?'No templates yet':'No templates in this category'}</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{templates.length===0?'Create your first template or duplicate from system templates.':'Try another category or create a new template.'}</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={()=>setShowDuplicateModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"><Copy className="w-4 h-4"/>From System</button>
              <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Plus className="w-4 h-4"/>Create</button>
            </div>
          </div>
        ):(
          <div className="space-y-3">{filteredTemplates.map(t=>{
            const ci=CATEGORIES.find(c=>c.value===t.category), CI=ci?.icon||Layers
            let pc=0; try{const s=typeof t.structureJson==='string'?JSON.parse(t.structureJson):t.structureJson;pc=s.isFlexible?0:(s.phases?.length||0)}catch{}
            return(
              <div key={t.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0"><CI className="w-5 h-5 text-purple-600"/></div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{ci?.label||t.category}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3"/>{t.minUnits}–{t.maxUnits}</span>
                        {pc>0&&<span className="text-xs text-gray-500 flex items-center gap-1"><Hash className="w-3 h-3"/>{pc} phase{pc!==1?'s':''}</span>}
                        {t.tags&&<span className="text-xs text-gray-400 flex items-center gap-1"><Tag className="w-3 h-3"/>{t.tags}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive!==false?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{t.isActive!==false?'Active':'Inactive'}</span>
                      </div>
                      {t.description&&<p className="text-sm text-gray-500 mt-1 line-clamp-1">{t.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={()=>handleDuplicate(t)} title="Duplicate" className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"><Copy className="w-4 h-4"/></button>
                    <button onClick={()=>handleEdit(t)} title="Edit" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={()=>setDeleteConfirm(t)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>)})}</div>)}
      </div>

      {showDuplicateModal&&<DuplicateFromSystemModal onSelect={t=>{setShowDuplicateModal(false);handleDuplicate(t)}} onClose={()=>setShowDuplicateModal(false)}/>}

      {deleteConfirm&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600"/></div>
              <div><h3 className="font-semibold text-gray-900">Delete Template</h3><p className="text-sm text-gray-500">Cannot be undone.</p></div>
            </div>
            <p className="text-sm text-gray-700 mb-6">Delete <strong>"{deleteConfirm.name}"</strong>?</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={()=>handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>)}
    </div>
  )
}

export default MyTemplates
