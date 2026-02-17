import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';

// ============================================
// API Configuration
// ============================================
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// ============================================
// BASELINE DATA (Feb 2026 Exit) - Updated brand order
// ============================================
const INITIAL_BASELINE_DATA = {
  syndication: {
    Inquisitr: { revenue: 81282, cost: 31429 },
    Cheatsheet: { revenue: 49499, cost: 5439 },
    Fadeaway: { revenue: 17422, cost: 12186 },
    FPD: { revenue: 4100, cost: 2022 },
    Wonderwall: { revenue: 0, cost: 0 },
    OKMagazine: { revenue: 0, cost: 0 }
  },
  discover: {
    Nofilmschool: { revenue: 28038, cost: 2854, currentTraffic: 850000, rpm: 3.3, adNetwork: 'tier1' },
    'Vintage Aviation': { revenue: 6357, cost: 4045, currentTraffic: 240000, rpm: 2.65, adNetwork: 'tier1' },
    'Best Classic Bands': { revenue: 3977, cost: 0, currentTraffic: 180000, rpm: 2.2, adNetwork: 'tier2' },
    Whatnow: { revenue: 14395, cost: 4381, currentTraffic: 520000, rpm: 2.77, adNetwork: 'tier1' },
    Edhat: { revenue: 8836, cost: 3394, currentTraffic: 380000, rpm: 2.33, adNetwork: 'tier1' },
    Cultofmac: { revenue: 0, cost: 0, currentTraffic: 500000, rpm: 3.0, adNetwork: 'tier1' },
    F4WOnline: { revenue: 93623, cost: 34617, currentTraffic: 2800000, rpm: 3.35, adNetwork: 'tier1' },
    Ewrestlingnews: { revenue: 17371, cost: 8684, currentTraffic: 620000, rpm: 2.8, adNetwork: 'tier1' },
    Aviationist: { revenue: 0, cost: 0, currentTraffic: 400000, rpm: 2.5, adNetwork: 'tier1' },
    'Shark Tank Blog': { revenue: 8953, cost: 926, currentTraffic: 320000, rpm: 2.8, adNetwork: 'tier1' },
    Wordsmyth: { revenue: 0, cost: 0, currentTraffic: 200000, rpm: 2.0, adNetwork: 'tier2' }
  }
};

const DEFAULT_RPM_SEASONALITY = {
  Mar: 0.75, Apr: 0.85, May: 0.90, Jun: 0.88, Jul: 0.85, Aug: 0.88, Sep: 0.95, Oct: 1.05, Nov: 1.25, Dec: 1.35
};

const DEFAULT_REV_SHARE_SLABS = [
  { threshold: 1.3, lh2Share: 0 },
  { threshold: 2, lh2Share: 0.20 },
  { threshold: 3, lh2Share: 0.30 },
  { threshold: Infinity, lh2Share: 0.50 }
];

const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WORKING_DAYS = 22;

const getDefaultSyndConfig = () => ({
  shared: { authors: 2, editors: 1, articlesPerAuthorPerDay: 5 },
  salaries: { authorSalary: 800, editorSalary: 1200, videoEditorSalary: 1000 },
  indirectCostsPct: 10,
  programmatic: { sessionsPerArticle: 400, rpm: 4.0 },
  syndication: { viewsPerArticle: 1100, blendedRpm: 3.25, momExtraViews: MONTHS.map(() => 0) },
  msnVideos: { videoEditors: 1, videosPerEditorPerDay: 3, engagedViewsPerVideo: 5000, rpm: 2.5, momExtraEngagedViews: MONTHS.map(() => 0) },
  baseRevenue: 2000,
  baseCosts: 1000,
  revShareSlabs: JSON.parse(JSON.stringify(DEFAULT_REV_SHARE_SLABS)),
  successProbability: 100
});

const getDefaultDiscoverConfig = (data) => ({
  baseTraffic: data.currentTraffic,
  baseRpm: data.rpm,
  rpmUplift: 1.0,
  transitionMonth: 'Mar',
  baseCost: Math.round(data.cost),
  successProbability: 100,
  trafficGrowth: MONTHS.map(() => 0),
  directCosts: MONTHS.map(() => 0),
  baseRevenue: 0,
  baseCostsLH2: 0,
  revShareSlabs: JSON.parse(JSON.stringify(DEFAULT_REV_SHARE_SLABS))
});

const getDefaultHiringPlan = () => ({
  authors: MONTHS.map(() => 0),
  editors: MONTHS.map(() => 0),
  videoEditors: MONTHS.map(() => 0)
});

const getApplicableSlab = (growthMultiple, slabs, baseRevenue, baseCosts) => {
  if (baseRevenue === 0 && baseCosts === 0) return 0.50;
  for (let i = 0; i < slabs.length; i++) {
    if (growthMultiple <= slabs[i].threshold) return slabs[i].lh2Share;
  }
  return slabs[slabs.length - 1].lh2Share;
};

const fmt = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(2)}M` : v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${Math.round(v)}`;
const fmtNum = (v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : Math.round(v);

const Input = ({ label, value, onChange, step = 1, min = 0, className = '', small = false, placeholder = '' }) => (
  <div className={`flex flex-col ${className}`}>
    {label && <label className="text-xs text-gray-500 mb-1">{label}</label>}
    <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} step={step} min={min} placeholder={placeholder} className={`w-full px-2 py-1 border rounded text-sm ${small ? 'text-xs' : ''}`} />
  </div>
);

const TextInput = ({ label, value, onChange, placeholder = '', className = '' }) => (
  <div className={`flex flex-col ${className}`}>
    {label && <label className="text-xs text-gray-500 mb-1">{label}</label>}
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-2 py-1 border rounded text-sm" />
  </div>
);

const Slider = ({ label, value, onChange, min, max, step = 1, suffix = '', color = 'blue' }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={`text-xs font-bold ${color === 'green' ? 'text-green-600' : color === 'orange' ? 'text-orange-600' : 'text-blue-600'}`}>{value}{suffix}</span>
    </div>
    <input type="range" value={value} onChange={e => onChange(parseFloat(e.target.value))} min={min} max={max} step={step} className={`w-full h-2 bg-gray-200 rounded-lg cursor-pointer ${color === 'green' ? 'accent-green-600' : color === 'orange' ? 'accent-orange-600' : 'accent-blue-600'}`} />
  </div>
);

const Card = ({ title, value, sub, color }) => (
  <div className={`p-3 rounded-lg border ${color === 'green' ? 'bg-green-50 border-green-200' : color === 'purple' ? 'bg-purple-50 border-purple-200' : color === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
    <div className="text-xs text-gray-500 uppercase">{title}</div>
    <div className="text-xl font-bold">{value}</div>
    {sub && <div className="text-xs text-gray-600">{sub}</div>}
  </div>
);

// ============================================
// SAVE STATUS INDICATOR
// ============================================
const SaveStatus = ({ status, lastSaved }) => {
  const statusConfig = {
    saving: { text: 'Saving...', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '💾' },
    saved: { text: `Saved ${lastSaved}`, color: 'text-green-600', bg: 'bg-green-50', icon: '✓' },
    error: { text: 'Save failed', color: 'text-red-600', bg: 'bg-red-50', icon: '✗' },
    loading: { text: 'Loading...', color: 'text-blue-600', bg: 'bg-blue-50', icon: '⏳' }
  };
  const config = statusConfig[status] || statusConfig.saved;
  
  return (
    <div className={`px-3 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg} flex items-center gap-1`}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </div>
  );
};

// ============================================
// REVENUE SHARE SLABS EDITOR
// ============================================
const RevShareSlabsEditor = ({ slabs, setSlabs, compact = false }) => {
  const addSlab = () => {
    if (slabs.length < 5) {
      const newSlabs = [...slabs];
      newSlabs.splice(newSlabs.length - 1, 0, { threshold: 2.5, lh2Share: 0.25 });
      setSlabs(newSlabs);
    }
  };

  const removeSlab = (idx) => {
    if (slabs.length > 2 && idx < slabs.length - 1) {
      const newSlabs = slabs.filter((_, i) => i !== idx);
      setSlabs(newSlabs);
    }
  };

  const updateSlab = (idx, field, value) => {
    const newSlabs = [...slabs];
    newSlabs[idx] = { ...newSlabs[idx], [field]: value };
    setSlabs(newSlabs);
  };

  return (
    <div className={`p-3 bg-indigo-50 rounded-lg border border-indigo-200 ${compact ? 'text-xs' : ''}`}>
      <div className="flex justify-between items-center mb-2">
        <div className={`font-bold text-indigo-800 ${compact ? 'text-xs' : 'text-sm'}`}>💰 Revenue Share Slabs</div>
        {slabs.length < 5 && <button onClick={addSlab} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Add</button>}
      </div>
      <div className="space-y-1">
        {slabs.map((slab, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-gray-600 w-8">{idx === slabs.length - 1 ? '>' : '≤'}</span>
            {idx === slabs.length - 1 ? (
              <span className="w-16 text-center text-gray-600">∞</span>
            ) : (
              <input type="number" value={slab.threshold} onChange={e => updateSlab(idx, 'threshold', parseFloat(e.target.value) || 0)} step={0.1} className="w-16 px-1 py-0.5 border rounded text-center text-xs" />
            )}
            <span className="text-gray-600">x →</span>
            <input type="number" value={(slab.lh2Share * 100).toFixed(0)} onChange={e => updateSlab(idx, 'lh2Share', (parseFloat(e.target.value) || 0) / 100)} step={5} className="w-14 px-1 py-0.5 border rounded text-center text-xs" />
            <span className="text-gray-600">%</span>
            {idx < slabs.length - 1 && slabs.length > 2 && (
              <button onClick={() => removeSlab(idx)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// ADD BRAND WIZARD
// ============================================
const AddBrandWizard = ({ isOpen, onClose, onAddBrand }) => {
  const [step, setStep] = useState(1);
  const [brandType, setBrandType] = useState('');
  const [formData, setFormData] = useState({
    brandName: '', baselineRevenue: 0, baselineCost: 0,
    authors: 2, editors: 1, articlesPerAuthorPerDay: 5,
    authorSalary: 800, editorSalary: 1200, videoEditorSalary: 1000, indirectCostsPct: 10,
    sessionsPerArticle: 400, programmaticRpm: 4.0,
    syndicationViewsPerArticle: 1100, syndicationBlendedRpm: 3.25,
    videoEditors: 1, videosPerEditorPerDay: 3, engagedViewsPerVideo: 5000, videoRpm: 2.5,
    baseRevenueLH2: 0, baseCostsLH2: 0, useDefaultSlabs: true,
    revShareSlabs: JSON.parse(JSON.stringify(DEFAULT_REV_SHARE_SLABS)),
    successProbability: 100,
    currentTraffic: 500000, baseTraffic: 500000, baseRpm: 3.0, baseCostOperational: 0,
    rpmUplift: 1.0, transitionMonth: 'Mar',
    setMOMTraffic: false, trafficGrowth: MONTHS.map(() => 0),
    setMOMDirectCosts: false, directCosts: MONTHS.map(() => 0)
  });

  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleClose = () => { setStep(1); setBrandType(''); setFormData({ brandName: '', baselineRevenue: 0, baselineCost: 0, authors: 2, editors: 1, articlesPerAuthorPerDay: 5, authorSalary: 800, editorSalary: 1200, videoEditorSalary: 1000, indirectCostsPct: 10, sessionsPerArticle: 400, programmaticRpm: 4.0, syndicationViewsPerArticle: 1100, syndicationBlendedRpm: 3.25, videoEditors: 1, videosPerEditorPerDay: 3, engagedViewsPerVideo: 5000, videoRpm: 2.5, baseRevenueLH2: 0, baseCostsLH2: 0, useDefaultSlabs: true, revShareSlabs: JSON.parse(JSON.stringify(DEFAULT_REV_SHARE_SLABS)), successProbability: 100, currentTraffic: 500000, baseTraffic: 500000, baseRpm: 3.0, baseCostOperational: 0, rpmUplift: 1.0, transitionMonth: 'Mar', setMOMTraffic: false, trafficGrowth: MONTHS.map(() => 0), setMOMDirectCosts: false, directCosts: MONTHS.map(() => 0) }); onClose(); };

  const handleAddBrand = () => { onAddBrand(brandType, formData); handleClose(); };

  const getTotalSteps = () => brandType === 'syndication' ? 9 : 7;

  const canProceed = () => {
    if (step === 1) return brandType !== '';
    if (step === 2) return formData.brandName.trim() !== '';
    return true;
  };

  if (!isOpen) return null;

  const renderSyndicationStep = () => {
    switch (step) {
      case 2: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 2: Basic Info</h3>
          <TextInput label="Brand Name" value={formData.brandName} onChange={v => updateForm('brandName', v)} placeholder="e.g., New Brand" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Baseline Revenue (Feb 2026)" value={formData.baselineRevenue} onChange={v => updateForm('baselineRevenue', v)} />
            <Input label="Baseline Cost (Feb 2026)" value={formData.baselineCost} onChange={v => updateForm('baselineCost', v)} />
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 3: Shared Resources</h3>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Authors" value={formData.authors} onChange={v => updateForm('authors', v)} />
            <Input label="Editors" value={formData.editors} onChange={v => updateForm('editors', v)} />
            <Input label="Articles/Author/Day" value={formData.articlesPerAuthorPerDay} onChange={v => updateForm('articlesPerAuthorPerDay', v)} />
          </div>
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 4: Salaries & Costs</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Author Salary $/mo" value={formData.authorSalary} onChange={v => updateForm('authorSalary', v)} />
            <Input label="Editor Salary $/mo" value={formData.editorSalary} onChange={v => updateForm('editorSalary', v)} />
            <Input label="Video Editor Salary $/mo" value={formData.videoEditorSalary} onChange={v => updateForm('videoEditorSalary', v)} />
            <Input label="Indirect Costs %" value={formData.indirectCostsPct} onChange={v => updateForm('indirectCostsPct', v)} />
          </div>
        </div>
      );
      case 5: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 5: Programmatic</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sessions/Article" value={formData.sessionsPerArticle} onChange={v => updateForm('sessionsPerArticle', v)} />
            <Input label="Programmatic RPM $" value={formData.programmaticRpm} onChange={v => updateForm('programmaticRpm', v)} step={0.1} />
          </div>
        </div>
      );
      case 6: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 6: Syndication</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Syndication Views/Article" value={formData.syndicationViewsPerArticle} onChange={v => updateForm('syndicationViewsPerArticle', v)} />
            <Input label="Blended RPM $" value={formData.syndicationBlendedRpm} onChange={v => updateForm('syndicationBlendedRpm', v)} step={0.1} />
          </div>
        </div>
      );
      case 7: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 7: MSN Videos</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Video Editors" value={formData.videoEditors} onChange={v => updateForm('videoEditors', v)} />
            <Input label="Videos/Editor/Day" value={formData.videosPerEditorPerDay} onChange={v => updateForm('videosPerEditorPerDay', v)} />
            <Input label="Engaged Views/Video" value={formData.engagedViewsPerVideo} onChange={v => updateForm('engagedViewsPerVideo', v)} />
            <Input label="Video RPM $" value={formData.videoRpm} onChange={v => updateForm('videoRpm', v)} step={0.1} />
          </div>
        </div>
      );
      case 8: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 8: LH2 P&L Config</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Base Revenue (Pre-LH2)" value={formData.baseRevenueLH2} onChange={v => updateForm('baseRevenueLH2', v)} />
            <Input label="Base Costs (Pre-LH2)" value={formData.baseCostsLH2} onChange={v => updateForm('baseCostsLH2', v)} />
          </div>
          {formData.baseRevenueLH2 === 0 && formData.baseCostsLH2 === 0 && <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">⚡ Auto 50% mode will be applied</div>}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.useDefaultSlabs} onChange={e => updateForm('useDefaultSlabs', e.target.checked)} className="rounded" />
            <span className="text-sm">Use default revenue share slabs</span>
          </label>
          {!formData.useDefaultSlabs && <RevShareSlabsEditor slabs={formData.revShareSlabs} setSlabs={s => updateForm('revShareSlabs', s)} compact />}
          <Slider label="Success Probability" value={formData.successProbability} onChange={v => updateForm('successProbability', v)} min={0} max={100} step={5} suffix="%" color="orange" />
        </div>
      );
      case 9: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 9: Confirmation</h3>
          <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">✅ Ready to Add</h4>
            <p className="text-sm text-green-700"><strong>{formData.brandName}</strong> - Syndication brand</p>
          </div>
        </div>
      );
      default: return null;
    }
  };

  const renderDiscoverStep = () => {
    switch (step) {
      case 2: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 2: Basic Info</h3>
          <TextInput label="Brand Name" value={formData.brandName} onChange={v => updateForm('brandName', v)} placeholder="e.g., New Brand" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Baseline Revenue (Feb 2026)" value={formData.baselineRevenue} onChange={v => updateForm('baselineRevenue', v)} />
            <Input label="Baseline Cost (Feb 2026)" value={formData.baselineCost} onChange={v => updateForm('baselineCost', v)} />
            <Input label="Current Traffic (sessions)" value={formData.currentTraffic} onChange={v => { updateForm('currentTraffic', v); updateForm('baseTraffic', v); }} />
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 3: Traffic & RPM</h3>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Base Traffic" value={formData.baseTraffic} onChange={v => updateForm('baseTraffic', v)} />
            <Input label="Base RPM $" value={formData.baseRpm} onChange={v => updateForm('baseRpm', v)} step={0.1} />
            <Input label="Base Cost $/mo" value={formData.baseCostOperational} onChange={v => updateForm('baseCostOperational', v)} />
          </div>
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 4: RPM Uplift</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="RPM Uplift Multiplier" value={formData.rpmUplift} onChange={v => updateForm('rpmUplift', v)} step={0.1} min={0.1} />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Uplift from Month</label>
              <select value={formData.transitionMonth} onChange={e => updateForm('transitionMonth', e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {formData.rpmUplift !== 1.0 && <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">⚡ RPM will increase {formData.rpmUplift}x from {formData.transitionMonth}</div>}
        </div>
      );
      case 5: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 5: LH2 P&L Config</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Base Revenue (Pre-LH2)" value={formData.baseRevenueLH2} onChange={v => updateForm('baseRevenueLH2', v)} />
            <Input label="Base Costs (Pre-LH2)" value={formData.baseCostsLH2} onChange={v => updateForm('baseCostsLH2', v)} />
          </div>
          {formData.baseRevenueLH2 === 0 && formData.baseCostsLH2 === 0 && <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">⚡ Auto 50% mode will be applied</div>}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.useDefaultSlabs} onChange={e => updateForm('useDefaultSlabs', e.target.checked)} className="rounded" />
            <span className="text-sm">Use default revenue share slabs</span>
          </label>
          {!formData.useDefaultSlabs && <RevShareSlabsEditor slabs={formData.revShareSlabs} setSlabs={s => updateForm('revShareSlabs', s)} compact />}
          <Slider label="Success Probability" value={formData.successProbability} onChange={v => updateForm('successProbability', v)} min={0} max={100} step={5} suffix="%" color="orange" />
        </div>
      );
      case 6: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 6: MOM Inputs (Optional)</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.setMOMTraffic} onChange={e => updateForm('setMOMTraffic', e.target.checked)} className="rounded" />
            <span className="text-sm">Set MOM Traffic Growth</span>
          </label>
          {formData.setMOMTraffic && (
            <div className="p-3 bg-blue-50 rounded-lg grid grid-cols-10 gap-1">
              {MONTHS.map((m, i) => (
                <div key={m} className="text-center">
                  <div className="text-xs text-gray-500">{m}</div>
                  <input type="number" value={formData.trafficGrowth[i]} onChange={e => { const ng = [...formData.trafficGrowth]; ng[i] = parseFloat(e.target.value) || 0; updateForm('trafficGrowth', ng); }} className="w-full px-1 py-1 border rounded text-xs text-center" />
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.setMOMDirectCosts} onChange={e => updateForm('setMOMDirectCosts', e.target.checked)} className="rounded" />
            <span className="text-sm">Set MOM Direct Costs</span>
          </label>
          {formData.setMOMDirectCosts && (
            <div className="p-3 bg-orange-50 rounded-lg grid grid-cols-10 gap-1">
              {MONTHS.map((m, i) => (
                <div key={m} className="text-center">
                  <div className="text-xs text-gray-500">{m}</div>
                  <input type="number" value={formData.directCosts[i]} onChange={e => { const nc = [...formData.directCosts]; nc[i] = parseFloat(e.target.value) || 0; updateForm('directCosts', nc); }} className="w-full px-1 py-1 border rounded text-xs text-center" />
                </div>
              ))}
            </div>
          )}
        </div>
      );
      case 7: return (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Step 7: Confirmation</h3>
          <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">✅ Ready to Add</h4>
            <p className="text-sm text-green-700"><strong>{formData.brandName}</strong> - Discover brand</p>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">➕ Add New Brand</h2>
            <button onClick={handleClose} className="text-white hover:text-gray-200 text-2xl">&times;</button>
          </div>
          {brandType && (
            <div className="flex items-center gap-2 mt-2">
              <div className="text-sm">Step {step} of {getTotalSteps()}</div>
              <div className="flex-1 bg-white/30 rounded-full h-2">
                <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${(step / getTotalSteps()) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800">Step 1: Select Brand Type</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setBrandType('syndication')} className={`p-6 rounded-lg border-2 transition-all ${brandType === 'syndication' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                  <div className="text-3xl mb-2">📝</div>
                  <div className="font-bold text-gray-800">Syndication</div>
                </button>
                <button onClick={() => setBrandType('discover')} className={`p-6 rounded-lg border-2 transition-all ${brandType === 'discover' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                  <div className="text-3xl mb-2">🔍</div>
                  <div className="font-bold text-gray-800">Discover</div>
                </button>
              </div>
            </div>
          )}
          {brandType === 'syndication' && step > 1 && renderSyndicationStep()}
          {brandType === 'discover' && step > 1 && renderDiscoverStep()}
        </div>

        <div className="border-t p-4 flex justify-between">
          <button onClick={() => step === 1 ? handleClose() : setStep(step - 1)} className="px-4 py-2 text-gray-600 hover:text-gray-800">{step === 1 ? 'Cancel' : '← Back'}</button>
          {step < getTotalSteps() ? (
            <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className={`px-6 py-2 rounded-lg font-medium ${canProceed() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Next →</button>
          ) : (
            <button onClick={handleAddBrand} className="px-6 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700">✓ Add Brand</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SYNDICATION BRAND CARD
// ============================================
const SyndCard = ({ brand, data, config, setConfig, rpmSeasonality, hiringPlan }) => {
  const proj = useMemo(() => {
    return MONTHS.map((m, i) => {
      const seasonality = rpmSeasonality[m] || 1;
      const { authorSalary, editorSalary, videoEditorSalary } = config.salaries;
      const indirectCostsPct = config.indirectCostsPct || 0;
      
      const totalAuthors = config.shared.authors + hiringPlan.authors.slice(0, i + 1).reduce((s, v) => s + v, 0);
      const totalEditors = config.shared.editors + hiringPlan.editors.slice(0, i + 1).reduce((s, v) => s + v, 0);
      const monthlyArticles = totalAuthors * config.shared.articlesPerAuthorPerDay * WORKING_DAYS;
      
      const progRev = (monthlyArticles * config.programmatic.sessionsPerArticle / 1000) * config.programmatic.rpm * seasonality;
      const totalSyndViews = monthlyArticles * config.syndication.viewsPerArticle + ((config.syndication.momExtraViews || [])[i] || 0);
      const syndRev = (totalSyndViews / 1000) * config.syndication.blendedRpm * seasonality;
      
      const vidEditors = config.msnVideos.videoEditors + hiringPlan.videoEditors.slice(0, i + 1).reduce((s, v) => s + v, 0);
      const baseEngagedViews = vidEditors * config.msnVideos.videosPerEditorPerDay * WORKING_DAYS * config.msnVideos.engagedViewsPerVideo;
      const totalEngagedViews = baseEngagedViews + ((config.msnVideos.momExtraEngagedViews || [])[i] || 0);
      const vidRev = (totalEngagedViews / 1000) * config.msnVideos.rpm * seasonality;
      
      const totalRev = (progRev + syndRev + vidRev) * (config.successProbability / 100);
      const directCost = totalAuthors * authorSalary + totalEditors * editorSalary + vidEditors * videoEditorSalary;
      const totalCost = directCost * (1 + indirectCostsPct / 100);
      
      const growthMultiple = config.baseRevenue > 0 ? totalRev / config.baseRevenue : 0;
      const applicableSlab = getApplicableSlab(growthMultiple, config.revShareSlabs, config.baseRevenue, config.baseCosts);
      
      let lh2Rev, lh2Cost;
      if (config.baseRevenue === 0 && config.baseCosts === 0) {
        lh2Rev = totalRev * applicableSlab;
        lh2Cost = totalCost * applicableSlab;
      } else {
        lh2Rev = Math.max(0, totalRev - config.baseRevenue) * applicableSlab;
        lh2Cost = Math.max(0, totalCost - config.baseCosts) * applicableSlab;
      }

      return {
        month: m,
        progRev: Math.round(progRev * (config.successProbability / 100)),
        syndRev: Math.round(syndRev * (config.successProbability / 100)),
        vidRev: Math.round(vidRev * (config.successProbability / 100)),
        totalRev: Math.round(totalRev),
        totalCost: Math.round(totalCost),
        growthX: growthMultiple.toFixed(2),
        slabPct: (applicableSlab * 100).toFixed(0),
        lh2Rev: Math.round(lh2Rev),
        lh2Cost: Math.round(lh2Cost),
        lh2Net: Math.round(lh2Rev - lh2Cost)
      };
    });
  }, [config, rpmSeasonality, hiringPlan]);

  const totals = proj.reduce((a, p) => ({
    progRev: a.progRev + p.progRev, syndRev: a.syndRev + p.syndRev, vidRev: a.vidRev + p.vidRev,
    totalRev: a.totalRev + p.totalRev, totalCost: a.totalCost + p.totalCost,
    lh2Rev: a.lh2Rev + p.lh2Rev, lh2Cost: a.lh2Cost + p.lh2Cost, lh2Net: a.lh2Net + p.lh2Net
  }), { progRev: 0, syndRev: 0, vidRev: 0, totalRev: 0, totalCost: 0, lh2Rev: 0, lh2Cost: 0, lh2Net: 0 });

  const updateShared = (f, v) => setConfig({ ...config, shared: { ...config.shared, [f]: v } });
  const updateSalaries = (f, v) => setConfig({ ...config, salaries: { ...config.salaries, [f]: v } });
  const updateProgrammatic = (f, v) => setConfig({ ...config, programmatic: { ...config.programmatic, [f]: v } });
  const updateSyndication = (f, v) => setConfig({ ...config, syndication: { ...config.syndication, [f]: v } });
  const updateVideos = (f, v) => setConfig({ ...config, msnVideos: { ...config.msnVideos, [f]: v } });
  const updateSyndMOM = (i, v) => { const n = [...(config.syndication.momExtraViews || MONTHS.map(() => 0))]; n[i] = v; updateSyndication('momExtraViews', n); };
  const updateVidMOM = (i, v) => { const n = [...(config.msnVideos.momExtraEngagedViews || MONTHS.map(() => 0))]; n[i] = v; updateVideos('momExtraEngagedViews', n); };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-6 border-l-4 border-purple-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{brand}</h3>
          <div className="text-sm text-gray-500">Baseline: {fmt(data.revenue)}/mo</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{fmt(totals.lh2Net)}</div>
          <div className="text-xs text-gray-500">LH2 Net Earnings (10-mo)</div>
        </div>
      </div>

      <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
        <Slider label="🎯 Success Probability Factor" value={config.successProbability} onChange={v => setConfig({ ...config, successProbability: v })} min={0} max={100} step={5} suffix="%" color="orange" />
      </div>

      <div className="mb-4 p-3 bg-gray-100 rounded-lg border border-gray-300">
        <div className="text-sm font-bold text-gray-700 mb-2">👥 Shared Resources & Salaries</div>
        <div className="grid grid-cols-7 gap-2">
          <Input label="Authors" value={config.shared.authors} onChange={v => updateShared('authors', v)} />
          <Input label="Editors" value={config.shared.editors} onChange={v => updateShared('editors', v)} />
          <Input label="Art/Auth/Day" value={config.shared.articlesPerAuthorPerDay} onChange={v => updateShared('articlesPerAuthorPerDay', v)} />
          <Input label="Author $/mo" value={config.salaries.authorSalary} onChange={v => updateSalaries('authorSalary', v)} />
          <Input label="Editor $/mo" value={config.salaries.editorSalary} onChange={v => updateSalaries('editorSalary', v)} />
          <Input label="VidEd $/mo" value={config.salaries.videoEditorSalary} onChange={v => updateSalaries('videoEditorSalary', v)} />
          <Input label="Indirect %" value={config.indirectCostsPct} onChange={v => setConfig({ ...config, indirectCostsPct: v })} />
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-bold text-blue-800 mb-2">📊 Programmatic</div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sessions/Article" value={config.programmatic.sessionsPerArticle} onChange={v => updateProgrammatic('sessionsPerArticle', v)} />
            <Input label="Programmatic RPM $" value={config.programmatic.rpm} onChange={v => updateProgrammatic('rpm', v)} step={0.1} />
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm font-bold text-green-800 mb-2">📰 Syndication</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Syndication Views/Art" value={config.syndication.viewsPerArticle} onChange={v => updateSyndication('viewsPerArticle', v)} />
            <Input label="Blended RPM $" value={config.syndication.blendedRpm} onChange={v => updateSyndication('blendedRpm', v)} step={0.1} />
          </div>
          <div className="p-2 bg-green-100 rounded border border-green-300">
            <div className="text-xs font-bold text-green-700 mb-1">📈 MOM Extra Pageviews (e.g., Yahoo News)</div>
            <div className="grid grid-cols-10 gap-1">
              {MONTHS.map((m, i) => (
                <div key={m} className="text-center">
                  <div className="text-xs text-gray-500">{m}</div>
                  <input type="number" value={(config.syndication.momExtraViews || MONTHS.map(() => 0))[i]} onChange={e => updateSyndMOM(i, parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border rounded text-xs text-center" step={1000} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-sm font-bold text-red-800 mb-2">🎬 MSN Videos</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Input label="Video Editors" value={config.msnVideos.videoEditors} onChange={v => updateVideos('videoEditors', v)} />
            <Input label="Videos/Ed/Day" value={config.msnVideos.videosPerEditorPerDay} onChange={v => updateVideos('videosPerEditorPerDay', v)} />
            <Input label="Engaged Views/Vid" value={config.msnVideos.engagedViewsPerVideo} onChange={v => updateVideos('engagedViewsPerVideo', v)} />
            <Input label="Video RPM $" value={config.msnVideos.rpm} onChange={v => updateVideos('rpm', v)} step={0.1} />
          </div>
          <div className="p-2 bg-red-100 rounded border border-red-300">
            <div className="text-xs font-bold text-red-700 mb-1">📈 MOM Extra Engaged Views</div>
            <div className="grid grid-cols-10 gap-1">
              {MONTHS.map((m, i) => (
                <div key={m} className="text-center">
                  <div className="text-xs text-gray-500">{m}</div>
                  <input type="number" value={(config.msnVideos.momExtraEngagedViews || MONTHS.map(() => 0))[i]} onChange={e => updateVidMOM(i, parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border rounded text-xs text-center" step={1000} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-sm font-bold text-purple-800 mb-2">📋 Base Values (Pre-LH2)</div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Base Revenue $" value={config.baseRevenue} onChange={v => setConfig({ ...config, baseRevenue: v })} />
            <Input label="Base Costs $" value={config.baseCosts} onChange={v => setConfig({ ...config, baseCosts: v })} />
          </div>
          {config.baseRevenue === 0 && config.baseCosts === 0 && <div className="mt-2 text-xs text-purple-600 bg-purple-100 p-1 rounded">⚡ Auto 50% mode: Base Rev & Cost = 0</div>}
        </div>
        <RevShareSlabsEditor slabs={config.revShareSlabs} setSlabs={s => setConfig({ ...config, revShareSlabs: s })} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-left">Month</th>
              <th className="px-2 py-2 text-right text-blue-700">Prog</th>
              <th className="px-2 py-2 text-right text-green-700">Synd</th>
              <th className="px-2 py-2 text-right text-red-700">Videos</th>
              <th className="px-2 py-2 text-right font-bold bg-gray-200">Total Rev</th>
              <th className="px-2 py-2 text-right text-gray-600">Growth X</th>
              <th className="px-2 py-2 text-right text-purple-700 bg-purple-50">LH2 Rev</th>
              <th className="px-2 py-2 text-right text-orange-700 bg-orange-50">LH2 Cost</th>
              <th className="px-2 py-2 text-right font-bold bg-indigo-100">LH2 Net</th>
            </tr>
          </thead>
          <tbody>
            {proj.map(p => (
              <tr key={p.month} className="border-b hover:bg-gray-50">
                <td className="px-2 py-2 font-medium">{p.month}</td>
                <td className="px-2 py-2 text-right text-blue-600">{fmt(p.progRev)}</td>
                <td className="px-2 py-2 text-right text-green-600">{fmt(p.syndRev)}</td>
                <td className="px-2 py-2 text-right text-red-600">{fmt(p.vidRev)}</td>
                <td className="px-2 py-2 text-right font-bold bg-gray-50">{fmt(p.totalRev)}</td>
                <td className="px-2 py-2 text-right text-gray-600">{p.growthX}x ({p.slabPct}%)</td>
                <td className="px-2 py-2 text-right text-purple-700 bg-purple-50">{fmt(p.lh2Rev)}</td>
                <td className="px-2 py-2 text-right text-orange-700 bg-orange-50">({fmt(p.lh2Cost)})</td>
                <td className={`px-2 py-2 text-right font-bold bg-indigo-50 ${p.lh2Net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(p.lh2Net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-bold">
              <td className="px-2 py-2">TOTAL</td>
              <td className="px-2 py-2 text-right text-blue-700">{fmt(totals.progRev)}</td>
              <td className="px-2 py-2 text-right text-green-700">{fmt(totals.syndRev)}</td>
              <td className="px-2 py-2 text-right text-red-700">{fmt(totals.vidRev)}</td>
              <td className="px-2 py-2 text-right bg-gray-300">{fmt(totals.totalRev)}</td>
              <td className="px-2 py-2 text-right">—</td>
              <td className="px-2 py-2 text-right text-purple-700 bg-purple-100">{fmt(totals.lh2Rev)}</td>
              <td className="px-2 py-2 text-right text-orange-700 bg-orange-100">({fmt(totals.lh2Cost)})</td>
              <td className={`px-2 py-2 text-right bg-indigo-100 ${totals.lh2Net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totals.lh2Net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ============================================
// DISCOVER BRAND CARD
// ============================================
const DiscCard = ({ brand, data, config, setConfig, rpmSeasonality }) => {
  const proj = useMemo(() => MONTHS.map((m, i) => {
    const traffic = config.baseTraffic * (1 + (config.trafficGrowth[i] || 0) / 100);
    const isAfterTransition = i >= MONTHS.indexOf(config.transitionMonth);
    const effectiveRpm = (config.rpmUplift !== 1.0 && isAfterTransition ? config.baseRpm * config.rpmUplift : config.baseRpm) * (rpmSeasonality[m] || 1);
    
    const rev = (traffic / 1000) * effectiveRpm * (config.successProbability / 100);
    const totalCost = (config.baseCost || 0) + (config.directCosts?.[i] || 0);
    
    const growthMultiple = config.baseRevenue > 0 ? rev / config.baseRevenue : 0;
    const applicableSlab = getApplicableSlab(growthMultiple, config.revShareSlabs, config.baseRevenue, config.baseCostsLH2);
    
    let lh2Rev, lh2Cost;
    if (config.baseRevenue === 0 && config.baseCostsLH2 === 0) {
      lh2Rev = rev * applicableSlab;
      lh2Cost = totalCost * applicableSlab;
    } else {
      lh2Rev = Math.max(0, rev - config.baseRevenue) * applicableSlab;
      lh2Cost = Math.max(0, totalCost - config.baseCostsLH2) * applicableSlab;
    }
    
    return { 
      month: m, traffic: Math.round(traffic), rpm: effectiveRpm.toFixed(2), rev: Math.round(rev),
      totalCost: Math.round(totalCost),
      growthX: growthMultiple.toFixed(2), slabPct: (applicableSlab * 100).toFixed(0),
      lh2Rev: Math.round(lh2Rev), lh2Cost: Math.round(lh2Cost), lh2Net: Math.round(lh2Rev - lh2Cost),
      hasUplift: config.rpmUplift !== 1.0 && isAfterTransition
    };
  }), [config, rpmSeasonality]);
  
  const tot = proj.reduce((a, p) => ({ 
    rev: a.rev + p.rev, totalCost: a.totalCost + p.totalCost,
    lh2Rev: a.lh2Rev + p.lh2Rev, lh2Cost: a.lh2Cost + p.lh2Cost, lh2Net: a.lh2Net + p.lh2Net
  }), { rev: 0, totalCost: 0, lh2Rev: 0, lh2Cost: 0, lh2Net: 0 });

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-6 border-l-4 border-green-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{brand}</h3>
          <div className="text-sm text-gray-500">Base: {fmt(data.revenue)}/mo | {fmtNum(data.currentTraffic)} sessions</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{fmt(tot.lh2Net)}</div>
          <div className="text-xs text-gray-500">LH2 Net (10-mo)</div>
        </div>
      </div>

      <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
        <Slider label="🎯 Success Probability Factor" value={config.successProbability} onChange={v => setConfig({ ...config, successProbability: v })} min={0} max={100} step={5} suffix="%" color="orange" />
      </div>
      
      <div className="grid grid-cols-5 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <Input label="Base Traffic" value={config.baseTraffic} onChange={v => setConfig({ ...config, baseTraffic: v })} />
        <Input label="Base RPM $" value={config.baseRpm} onChange={v => setConfig({ ...config, baseRpm: v })} step={0.1} />
        <Input label="Base Cost $/mo" value={config.baseCost} onChange={v => setConfig({ ...config, baseCost: v })} />
        <Input label="RPM Uplift" value={config.rpmUplift} onChange={v => setConfig({ ...config, rpmUplift: v })} step={0.1} min={0.1} />
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Uplift from Month</label>
          <select value={config.transitionMonth} onChange={e => setConfig({ ...config, transitionMonth: e.target.value })} className="w-full px-2 py-1 border rounded text-sm">
            {MONTHS.map(m => <option key={m} value={m}>{m} 26</option>)}
          </select>
        </div>
      </div>

      {config.rpmUplift !== 1.0 && (
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-300 rounded-lg text-xs text-yellow-800">
          ⚡ RPM Uplift ({config.rpmUplift}x) applies from <strong>{config.transitionMonth} 2026</strong> onwards.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-sm font-bold text-purple-800 mb-2">📋 LH2 Base Values (Pre-LH2)</div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Base Revenue $" value={config.baseRevenue} onChange={v => setConfig({ ...config, baseRevenue: v })} />
            <Input label="Base Costs $" value={config.baseCostsLH2} onChange={v => setConfig({ ...config, baseCostsLH2: v })} />
          </div>
          {config.baseRevenue === 0 && config.baseCostsLH2 === 0 && <div className="mt-2 text-xs text-purple-600 bg-purple-100 p-1 rounded">⚡ Auto 50% mode: Base Rev & Cost = 0</div>}
        </div>
        <RevShareSlabsEditor slabs={config.revShareSlabs} setSlabs={s => setConfig({ ...config, revShareSlabs: s })} compact={true} />
      </div>

      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm font-bold text-blue-800 mb-2">📈 MOM Traffic Growth % (from base traffic)</div>
        <div className="grid grid-cols-10 gap-1">
          {MONTHS.map((m, i) => (
            <div key={m} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{m}</div>
              <input type="number" value={config.trafficGrowth[i]} onChange={e => { const n = [...config.trafficGrowth]; n[i] = parseFloat(e.target.value) || 0; setConfig({ ...config, trafficGrowth: n }); }} className="w-full px-1 py-1 border rounded text-xs text-center" step={1} />
              <div className="text-xs text-gray-400">%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
        <div className="text-sm font-bold text-orange-800 mb-2">💰 MOM Direct Costs ($) — Added to Base Cost each month</div>
        <div className="grid grid-cols-10 gap-1">
          {MONTHS.map((m, i) => (
            <div key={m} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{m}</div>
              <input type="number" value={(config.directCosts || MONTHS.map(() => 0))[i]} onChange={e => { const n = [...(config.directCosts || MONTHS.map(() => 0))]; n[i] = parseFloat(e.target.value) || 0; setConfig({ ...config, directCosts: n }); }} className="w-full px-1 py-1 border rounded text-xs text-center" step={100} />
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">Total Cost = Base Cost (${config.baseCost}) + Direct Cost</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 text-left">Month</th>
              <th className="px-2 py-1 text-right">Traffic</th>
              <th className="px-2 py-1 text-right">RPM</th>
              <th className="px-2 py-1 text-right">Revenue</th>
              <th className="px-2 py-1 text-right text-orange-700">Total Cost</th>
              <th className="px-2 py-1 text-right text-gray-600">Growth X</th>
              <th className="px-2 py-1 text-right text-purple-700 bg-purple-50">LH2 Rev</th>
              <th className="px-2 py-1 text-right text-orange-700 bg-orange-50">LH2 Cost</th>
              <th className="px-2 py-1 text-right font-bold bg-indigo-100">LH2 Net</th>
            </tr>
          </thead>
          <tbody>
            {proj.map(p => (
              <tr key={p.month} className={`border-b ${p.hasUplift ? 'bg-yellow-50' : ''}`}>
                <td className="px-2 py-1 font-medium">{p.month}{p.hasUplift && <span className="ml-1 text-yellow-600">⚡</span>}</td>
                <td className="px-2 py-1 text-right">{fmtNum(p.traffic)}</td>
                <td className="px-2 py-1 text-right">${p.rpm}</td>
                <td className="px-2 py-1 text-right">{fmt(p.rev)}</td>
                <td className="px-2 py-1 text-right text-orange-600">({fmt(p.totalCost)})</td>
                <td className="px-2 py-1 text-right text-gray-600">{p.growthX}x ({p.slabPct}%)</td>
                <td className="px-2 py-1 text-right text-purple-700 bg-purple-50">{fmt(p.lh2Rev)}</td>
                <td className="px-2 py-1 text-right text-orange-700 bg-orange-50">({fmt(p.lh2Cost)})</td>
                <td className={`px-2 py-1 text-right font-bold bg-indigo-50 ${p.lh2Net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(p.lh2Net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-bold">
              <td className="px-2 py-1">TOTAL</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right">{fmt(tot.rev)}</td>
              <td className="px-2 py-1 text-right text-orange-700">({fmt(tot.totalCost)})</td>
              <td className="px-2 py-1 text-right">—</td>
              <td className="px-2 py-1 text-right text-purple-700 bg-purple-100">{fmt(tot.lh2Rev)}</td>
              <td className="px-2 py-1 text-right text-orange-700 bg-orange-100">({fmt(tot.lh2Cost)})</td>
              <td className={`px-2 py-1 text-right bg-indigo-100 ${tot.lh2Net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(tot.lh2Net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ============================================
// HIRING PLAN TAB
// ============================================
const HiringPlanTab = ({ hiringPlans, setHiringPlans, brandNames }) => {
  const updateHiring = (brand, role, monthIdx, value) => {
    setHiringPlans(prev => {
      const brandPlan = prev[brand] || getDefaultHiringPlan();
      const newRole = [...brandPlan[role]];
      newRole[monthIdx] = value;
      return { ...prev, [brand]: { ...brandPlan, [role]: newRole } };
    });
  };

  return (
    <div className="space-y-6">
      {brandNames.map(brand => {
        const plan = hiringPlans[brand] || getDefaultHiringPlan();
        return (
          <div key={brand} className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-bold text-purple-800 mb-3">{brand} — Hiring Plan</h3>
            {['authors', 'editors', 'videoEditors'].map(role => (
              <div key={role} className="mb-3">
                <div className="text-sm font-medium text-gray-700 mb-1">+ {role === 'authors' ? 'Authors' : role === 'editors' ? 'Editors' : 'Video Editors'}</div>
                <div className="grid grid-cols-10 gap-1">
                  {MONTHS.map((m, i) => (
                    <div key={m} className="text-center">
                      <div className="text-xs text-gray-500">{m}</div>
                      <input type="number" value={plan[role][i]} onChange={e => updateHiring(brand, role, i, parseFloat(e.target.value) || 0)} className="w-full px-1 py-1 border rounded text-xs text-center" />
                    </div>
                  ))}
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="px-1 py-1 bg-gray-100 rounded text-xs font-bold">{plan[role].reduce((s, v) => s + v, 0)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// COLLAPSIBLE ROW COMPONENT FOR OVERVIEW
// ============================================
const CollapsibleRow = ({ label, data, total, brandData, color, isExpanded, onToggle }) => {
  const bgColor = color === 'purple' ? 'bg-purple-50' : color === 'green' ? 'bg-green-50' : color === 'indigo' ? 'bg-indigo-50' : color === 'blue' ? 'bg-blue-50' : '';
  const textColor = color === 'purple' ? 'text-purple-700' : color === 'green' ? 'text-green-700' : color === 'indigo' ? 'text-indigo-700' : color === 'blue' ? 'text-blue-700' : '';
  const bgColorDark = color === 'purple' ? 'bg-purple-100' : color === 'green' ? 'bg-green-100' : color === 'indigo' ? 'bg-indigo-100' : color === 'blue' ? 'bg-blue-100' : 'bg-gray-50';

  return (
    <>
      <tr className={`${bgColor} cursor-pointer hover:opacity-80`} onClick={onToggle}>
        <td className={`px-2 py-1 ${textColor} font-medium`}>
          <span className="inline-block w-4 text-center mr-1">{isExpanded ? '−' : '+'}</span>
          {label}
        </td>
        {data.map((val, i) => (
          <td key={i} className={`px-2 py-1 text-right ${textColor}`}>{fmt(val)}</td>
        ))}
        <td className={`px-2 py-1 text-right ${bgColorDark} font-bold ${textColor}`}>{fmt(total)}</td>
      </tr>
      {isExpanded && brandData.map(({ brand, values, total: brandTotal }) => (
        <tr key={brand} className="bg-gray-50 text-xs">
          <td className="px-2 py-1 pl-8 text-gray-600">↳ {brand}</td>
          {values.map((val, i) => (
            <td key={i} className="px-2 py-1 text-right text-gray-600">{fmt(val)}</td>
          ))}
          <td className="px-2 py-1 text-right text-gray-600 font-medium">{fmt(brandTotal)}</td>
        </tr>
      ))}
    </>
  );
};

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const [tab, setTab] = useState('overview');
  const [overhead, setOverhead] = useState({ salary: 47000, tech: 4855, admin: 12800 });
  const [rpmSeasonality, setRpmSeasonality] = useState(DEFAULT_RPM_SEASONALITY);
  const [baselineData, setBaselineData] = useState(INITIAL_BASELINE_DATA);
  const [syndConfigs, setSyndConfigs] = useState(() => {
    const configs = {};
    Object.keys(INITIAL_BASELINE_DATA.syndication).forEach(brand => { configs[brand] = getDefaultSyndConfig(); });
    return configs;
  });
  const [hiringPlans, setHiringPlans] = useState(() => {
    const plans = {};
    Object.keys(INITIAL_BASELINE_DATA.syndication).forEach(brand => { plans[brand] = getDefaultHiringPlan(); });
    return plans;
  });
  const [discConfigs, setDiscConfigs] = useState(() => {
    const configs = {};
    Object.entries(INITIAL_BASELINE_DATA.discover).forEach(([brand, data]) => { configs[brand] = getDefaultDiscoverConfig(data); });
    return configs;
  });
  const [showAddBrandWizard, setShowAddBrandWizard] = useState(false);
  const [saveStatus, setSaveStatus] = useState('loading');
  const [lastSaved, setLastSaved] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Expanded rows state for Overview tab
  const [expandedRows, setExpandedRows] = useState({
    syndRev: false,
    syndLh2Net: false,
    discRev: false,
    discLh2Net: false,
    totalLh2Net: false
  });

  const toggleRow = (row) => setExpandedRows(prev => ({ ...prev, [row]: !prev[row] }));

  // Load data on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/state`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          if (json.data.overhead) setOverhead(json.data.overhead);
          if (json.data.rpmSeasonality) setRpmSeasonality(json.data.rpmSeasonality);
          if (json.data.baselineData) setBaselineData(json.data.baselineData);
          if (json.data.syndConfigs) setSyndConfigs(json.data.syndConfigs);
          if (json.data.hiringPlans) setHiringPlans(json.data.hiringPlans);
          if (json.data.discConfigs) setDiscConfigs(json.data.discConfigs);
          if (json.data.lastUpdated) setLastSaved(new Date(json.data.lastUpdated).toLocaleTimeString());
        }
        setSaveStatus('saved');
        setIsLoaded(true);
      })
      .catch(err => { console.error('Load failed:', err); setSaveStatus('error'); setIsLoaded(true); });
  }, []);

  // Save data
  const saveData = useCallback(async () => {
    if (!isLoaded) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overhead, rpmSeasonality, baselineData, syndConfigs, hiringPlans, discConfigs, updatedBy: 'user' })
      });
      const json = await res.json();
      if (json.success) {
        setSaveStatus('saved');
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveStatus('error');
    }
  }, [overhead, rpmSeasonality, baselineData, syndConfigs, hiringPlans, discConfigs, isLoaded]);

  // Debounced auto-save
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(saveData, 1000);
    return () => clearTimeout(timer);
  }, [overhead, rpmSeasonality, baselineData, syndConfigs, hiringPlans, discConfigs, isLoaded, saveData]);

  // Reset to defaults
  const handleReset = async () => {
    if (!confirm('Reset all data to defaults? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      window.location.reload();
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  const handleAddBrand = (brandType, formData) => {
    const brandName = formData.brandName.trim();
    
    if (brandType === 'syndication') {
      setBaselineData(prev => ({ ...prev, syndication: { ...prev.syndication, [brandName]: { revenue: formData.baselineRevenue, cost: formData.baselineCost } } }));
      setSyndConfigs(prev => ({
        ...prev,
        [brandName]: {
          shared: { authors: formData.authors, editors: formData.editors, articlesPerAuthorPerDay: formData.articlesPerAuthorPerDay },
          salaries: { authorSalary: formData.authorSalary, editorSalary: formData.editorSalary, videoEditorSalary: formData.videoEditorSalary },
          indirectCostsPct: formData.indirectCostsPct,
          programmatic: { sessionsPerArticle: formData.sessionsPerArticle, rpm: formData.programmaticRpm },
          syndication: { viewsPerArticle: formData.syndicationViewsPerArticle, blendedRpm: formData.syndicationBlendedRpm, momExtraViews: MONTHS.map(() => 0) },
          msnVideos: { videoEditors: formData.videoEditors, videosPerEditorPerDay: formData.videosPerEditorPerDay, engagedViewsPerVideo: formData.engagedViewsPerVideo, rpm: formData.videoRpm, momExtraEngagedViews: MONTHS.map(() => 0) },
          baseRevenue: formData.baseRevenueLH2, baseCosts: formData.baseCostsLH2,
          revShareSlabs: formData.useDefaultSlabs ? JSON.parse(JSON.stringify(DEFAULT_REV_SHARE_SLABS)) : formData.revShareSlabs,
          successProbability: formData.successProbability
        }
      }));
      setHiringPlans(prev => ({ ...prev, [brandName]: getDefaultHiringPlan() }));
    } else {
      setBaselineData(prev => ({ ...prev, discover: { ...prev.discover, [brandName]: { revenue: formData.baselineRevenue, cost: formData.baselineCost, currentTraffic: formData.currentTraffic, rpm: formData.baseRpm, adNetwork: 'tier1' } } }));
      setDiscConfigs(prev => ({
        ...prev,
        [brandName]: {
          baseTraffic: formData.baseTraffic, baseRpm: formData.baseRpm, rpmUplift: formData.rpmUplift, transitionMonth: formData.transitionMonth,
          baseCost: formData.baseCostOperational, successProbability: formData.successProbability,
          trafficGrowth: formData.setMOMTraffic ? formData.trafficGrowth : MONTHS.map(() => 0),
          directCosts: formData.setMOMDirectCosts ? formData.directCosts : MONTHS.map(() => 0),
          baseRevenue: formData.baseRevenueLH2, baseCostsLH2: formData.baseCostsLH2,
          revShareSlabs: formData.useDefaultSlabs ? JSON.parse(JSON.stringify(DEFAULT_REV_SHARE_SLABS)) : formData.revShareSlabs
        }
      }));
    }
  };

  // P&L calculations with brand-level detail
  const { pnl, brandPnl } = useMemo(() => {
    const syndBrandData = {};
    const discBrandData = {};
    
    // Initialize brand data
    Object.keys(syndConfigs).forEach(brand => {
      syndBrandData[brand] = { rev: [], lh2Net: [] };
    });
    Object.keys(discConfigs).forEach(brand => {
      discBrandData[brand] = { rev: [], lh2Net: [] };
    });

    const pnlData = MONTHS.map((m, i) => {
      let syndTotalRev = 0, syndLh2Net = 0, discTotalRev = 0, discLh2Net = 0;
      const seasonality = rpmSeasonality[m] || 1;
      
      Object.entries(syndConfigs).forEach(([brand, config]) => {
        const hiring = hiringPlans[brand] || getDefaultHiringPlan();
        const { authorSalary, editorSalary, videoEditorSalary } = config.salaries;
        const indirectCostsPct = config.indirectCostsPct || 0;
        
        const totalAuthors = config.shared.authors + hiring.authors.slice(0, i + 1).reduce((s, v) => s + v, 0);
        const totalEditors = config.shared.editors + hiring.editors.slice(0, i + 1).reduce((s, v) => s + v, 0);
        const monthlyArticles = totalAuthors * config.shared.articlesPerAuthorPerDay * WORKING_DAYS;
        
        const progRev = (monthlyArticles * config.programmatic.sessionsPerArticle / 1000) * config.programmatic.rpm * seasonality;
        const totalSyndViews = monthlyArticles * config.syndication.viewsPerArticle + ((config.syndication.momExtraViews || [])[i] || 0);
        const syndRev = (totalSyndViews / 1000) * config.syndication.blendedRpm * seasonality;
        
        const vidEditors = config.msnVideos.videoEditors + hiring.videoEditors.slice(0, i + 1).reduce((s, v) => s + v, 0);
        const baseEngagedViews = vidEditors * config.msnVideos.videosPerEditorPerDay * WORKING_DAYS * config.msnVideos.engagedViewsPerVideo;
        const vidRev = ((baseEngagedViews + ((config.msnVideos.momExtraEngagedViews || [])[i] || 0)) / 1000) * config.msnVideos.rpm * seasonality;
        
        const totalRev = (progRev + syndRev + vidRev) * (config.successProbability / 100);
        const directCost = totalAuthors * authorSalary + totalEditors * editorSalary + vidEditors * videoEditorSalary;
        const totalCost = directCost * (1 + indirectCostsPct / 100);
        
        const growthMultiple = config.baseRevenue > 0 ? totalRev / config.baseRevenue : 0;
        const applicableSlab = getApplicableSlab(growthMultiple, config.revShareSlabs, config.baseRevenue, config.baseCosts);
        
        let lh2Rev, lh2Cost;
        if (config.baseRevenue === 0 && config.baseCosts === 0) { lh2Rev = totalRev * applicableSlab; lh2Cost = totalCost * applicableSlab; }
        else { lh2Rev = Math.max(0, totalRev - config.baseRevenue) * applicableSlab; lh2Cost = Math.max(0, totalCost - config.baseCosts) * applicableSlab; }
        
        const brandLh2Net = lh2Rev - lh2Cost;
        
        syndTotalRev += totalRev;
        syndLh2Net += brandLh2Net;
        
        syndBrandData[brand].rev.push(Math.round(totalRev));
        syndBrandData[brand].lh2Net.push(Math.round(brandLh2Net));
      });
      
      Object.entries(discConfigs).forEach(([brand, config]) => {
        const traffic = config.baseTraffic * (1 + (config.trafficGrowth[i] || 0) / 100);
        const isAfterTransition = i >= MONTHS.indexOf(config.transitionMonth);
        const effectiveRpm = (config.rpmUplift !== 1.0 && isAfterTransition ? config.baseRpm * config.rpmUplift : config.baseRpm) * seasonality;
        
        const rev = (traffic / 1000) * effectiveRpm * (config.successProbability / 100);
        const totalCost = (config.baseCost || 0) + (config.directCosts?.[i] || 0);
        
        const growthMultiple = config.baseRevenue > 0 ? rev / config.baseRevenue : 0;
        const applicableSlab = getApplicableSlab(growthMultiple, config.revShareSlabs, config.baseRevenue, config.baseCostsLH2);
        
        let lh2Rev, lh2Cost;
        if (config.baseRevenue === 0 && config.baseCostsLH2 === 0) { lh2Rev = rev * applicableSlab; lh2Cost = totalCost * applicableSlab; }
        else { lh2Rev = Math.max(0, rev - config.baseRevenue) * applicableSlab; lh2Cost = Math.max(0, totalCost - config.baseCostsLH2) * applicableSlab; }
        
        const brandLh2Net = lh2Rev - lh2Cost;
        
        discTotalRev += rev;
        discLh2Net += brandLh2Net;
        
        discBrandData[brand].rev.push(Math.round(rev));
        discBrandData[brand].lh2Net.push(Math.round(brandLh2Net));
      });
      
      const totalRev = syndTotalRev + discTotalRev;
      const oh = overhead.salary + overhead.tech + overhead.admin;
      const totalLh2Net = syndLh2Net + discLh2Net;
      
      return { month: m, syndRev: Math.round(syndTotalRev), syndLh2Net: Math.round(syndLh2Net), discRev: Math.round(discTotalRev), discLh2Net: Math.round(discLh2Net), totalRev: Math.round(totalRev), totalLh2Net: Math.round(totalLh2Net), overhead: oh, netProfit: Math.round(totalLh2Net - oh), margin: totalRev > 0 ? ((totalLh2Net - oh) / totalRev * 100) : 0 };
    });

    return { pnl: pnlData, brandPnl: { synd: syndBrandData, disc: discBrandData } };
  }, [syndConfigs, hiringPlans, discConfigs, rpmSeasonality, overhead]);

  const totals = pnl.reduce((a, p) => ({ syndRev: a.syndRev + p.syndRev, syndLh2Net: a.syndLh2Net + p.syndLh2Net, discRev: a.discRev + p.discRev, discLh2Net: a.discLh2Net + p.discLh2Net, totalRev: a.totalRev + p.totalRev, totalLh2Net: a.totalLh2Net + p.totalLh2Net, overhead: a.overhead + p.overhead, netProfit: a.netProfit + p.netProfit }), { syndRev: 0, syndLh2Net: 0, discRev: 0, discLh2Net: 0, totalRev: 0, totalLh2Net: 0, overhead: 0, netProfit: 0 });

  // Helper to get brand data for collapsible rows
  const getSyndBrandData = (metric) => Object.entries(brandPnl.synd).map(([brand, data]) => ({
    brand,
    values: data[metric],
    total: data[metric].reduce((s, v) => s + v, 0)
  }));

  const getDiscBrandData = (metric) => Object.entries(brandPnl.disc).map(([brand, data]) => ({
    brand,
    values: data[metric],
    total: data[metric].reduce((s, v) => s + v, 0)
  }));

  const Tab = ({ id, children }) => <button onClick={() => setTab(id)} className={`px-3 py-2 text-sm font-medium rounded-t-lg ${tab === id ? 'bg-white text-blue-600 border-t border-l border-r' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{children}</button>;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">LH2 Holdings — AOP Dashboard</h1>
            <p className="text-blue-200 text-sm">Annual Operating Plan | March - December 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <SaveStatus status={saveStatus} lastSaved={lastSaved} />
            <button onClick={() => setShowAddBrandWizard(true)} className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 flex items-center gap-2">
              <span className="text-xl">+</span> Add Brand
            </button>
          </div>
        </div>
      </header>
      
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 pt-2">
          <Tab id="overview">📊 Overview</Tab>
          <Tab id="syndication">📝 Syndication ({Object.keys(syndConfigs).length})</Tab>
          <Tab id="discover">🔍 Discover ({Object.keys(discConfigs).length})</Tab>
          <Tab id="hiring">👥 Hiring</Tab>
          <Tab id="settings">⚙️ Settings</Tab>
        </div>
      </div>
      
      <main className="max-w-6xl mx-auto p-4">
        {tab === 'overview' && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xl font-bold mb-4">Consolidated P&L (Mar - Dec 2026)</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Card title="Total Revenue" value={fmt(totals.totalRev)} color="blue" />
              <Card title="Synd LH2 Net" value={fmt(totals.syndLh2Net)} sub="After rev share" color="purple" />
              <Card title="Discover LH2 Net" value={fmt(totals.discLh2Net)} sub="After rev share" color="green" />
              <Card title="LH2 Gross Profit" value={fmt(totals.totalLh2Net)} sub={`${(totals.totalLh2Net / totals.totalRev * 100).toFixed(1)}% margin`} color={totals.totalLh2Net >= 0 ? 'green' : 'orange'} />
            </div>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pnl}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v, n) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="syndLh2Net" name="Synd LH2 Net" fill="#8b5cf6" stackId="r" />
                  <Bar dataKey="discLh2Net" name="Discover LH2 Net" fill="#10b981" stackId="r" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-gray-500 mb-2">💡 Click on rows with + to expand and see brand-wise breakdown</div>
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-100"><th className="px-2 py-1 text-left">Item</th>{MONTHS.map(m => <th key={m} className="px-2 py-1 text-right">{m}</th>)}<th className="px-2 py-1 text-right bg-gray-200">TOTAL</th></tr></thead>
              <tbody>
                {/* Syndication Total Rev - Collapsible */}
                <CollapsibleRow 
                  label="Syndication Total Rev" 
                  data={pnl.map(p => p.syndRev)} 
                  total={totals.syndRev}
                  brandData={getSyndBrandData('rev')}
                  color=""
                  isExpanded={expandedRows.syndRev}
                  onToggle={() => toggleRow('syndRev')}
                />
                
                {/* Synd LH2 Net - Collapsible */}
                <CollapsibleRow 
                  label="→ Synd LH2 Net" 
                  data={pnl.map(p => p.syndLh2Net)} 
                  total={totals.syndLh2Net}
                  brandData={getSyndBrandData('lh2Net')}
                  color="purple"
                  isExpanded={expandedRows.syndLh2Net}
                  onToggle={() => toggleRow('syndLh2Net')}
                />
                
                {/* Discover Total Rev - Collapsible */}
                <CollapsibleRow 
                  label="Discover Total Rev" 
                  data={pnl.map(p => p.discRev)} 
                  total={totals.discRev}
                  brandData={getDiscBrandData('rev')}
                  color=""
                  isExpanded={expandedRows.discRev}
                  onToggle={() => toggleRow('discRev')}
                />
                
                {/* Discover LH2 Net - Collapsible */}
                <CollapsibleRow 
                  label="→ Discover LH2 Net" 
                  data={pnl.map(p => p.discLh2Net)} 
                  total={totals.discLh2Net}
                  brandData={getDiscBrandData('lh2Net')}
                  color="green"
                  isExpanded={expandedRows.discLh2Net}
                  onToggle={() => toggleRow('discLh2Net')}
                />
                
                {/* LH2 Gross Profit - Collapsible (shows all brands) */}
                <CollapsibleRow 
                  label="LH2 Gross Profit" 
                  data={pnl.map(p => p.totalLh2Net)} 
                  total={totals.totalLh2Net}
                  brandData={[...getSyndBrandData('lh2Net'), ...getDiscBrandData('lh2Net')]}
                  color="indigo"
                  isExpanded={expandedRows.totalLh2Net}
                  onToggle={() => toggleRow('totalLh2Net')}
                />
              </tbody>
            </table>
          </div>
        )}
        
        {tab === 'syndication' && (
          <div>
            <div className="mb-4 p-3 bg-purple-100 rounded-lg flex justify-between items-center">
              <div>
                <h2 className="font-bold text-purple-800">Syndication Brands — {Object.keys(syndConfigs).length} brands</h2>
                <p className="text-sm text-purple-600">Programmatic + Syndication + MSN Videos | Per-brand salaries + indirect costs</p>
              </div>
              <button onClick={() => setShowAddBrandWizard(true)} className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">+ Add Syndication Brand</button>
            </div>
            {Object.entries(baselineData.syndication).map(([b, d]) => (
              <SyndCard key={b} brand={b} data={d} config={syndConfigs[b]} setConfig={c => setSyndConfigs(p => ({ ...p, [b]: c }))} rpmSeasonality={rpmSeasonality} hiringPlan={hiringPlans[b] || getDefaultHiringPlan()} />
            ))}
          </div>
        )}
        
        {tab === 'discover' && (
          <div>
            <div className="mb-4 p-3 bg-green-100 rounded-lg flex justify-between items-center">
              <div>
                <h2 className="font-bold text-green-800">Discover Brands — {Object.keys(discConfigs).length} brands</h2>
                <p className="text-sm text-green-600">Traffic × RPM | LH2 P&L applied | Configurable RPM uplift</p>
              </div>
              <button onClick={() => setShowAddBrandWizard(true)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">+ Add Discover Brand</button>
            </div>
            {Object.entries(baselineData.discover).map(([b, d]) => (
              <DiscCard key={b} brand={b} data={d} config={discConfigs[b]} setConfig={c => setDiscConfigs(p => ({ ...p, [b]: c }))} rpmSeasonality={rpmSeasonality} />
            ))}
          </div>
        )}
        
        {tab === 'hiring' && <HiringPlanTab hiringPlans={hiringPlans} setHiringPlans={setHiringPlans} brandNames={Object.keys(syndConfigs)} />}
        
        {tab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-bold mb-3">📈 Blended RPM Seasonality (Multipliers)</h4>
              <p className="text-xs text-gray-500 mb-3">These multipliers apply to ALL Base RPMs across Syndication and Discover brands</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gray-100"><th className="px-2 py-2 text-left text-sm">Month</th>{MONTHS.map(m => <th key={m} className="px-2 py-2 text-center text-sm">{m}</th>)}</tr></thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-2 font-medium text-sm">Multiplier</td>
                      {MONTHS.map(m => <td key={m} className="px-1 py-2"><input type="number" value={rpmSeasonality[m]} onChange={e => setRpmSeasonality(p => ({ ...p, [m]: parseFloat(e.target.value) || 1 }))} step={0.05} min={0.1} max={2} className="w-14 px-2 py-1 border rounded text-center text-sm" /></td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-bold mb-3">📋 Model Constants</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-xs">Working Days/Month</div><div className="font-bold text-lg">{WORKING_DAYS}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-gray-500 text-xs">Salaries & Indirect Costs</div><div className="font-bold text-sm">Per-brand in Syndication tab</div></div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-bold mb-3">📖 LH2 P&L Model Explained</h4>
              <div className="text-sm text-gray-700 space-y-2">
                <p><strong>Growth Multiple</strong> = Total Revenue ÷ Base Revenue</p>
                <p><strong>Shareable Revenue</strong> = Total Revenue − Base Revenue (incremental only)</p>
                <p><strong>LH2 Share of Revenue</strong> = Shareable Revenue × Applicable Slab %</p>
                <p><strong>LH2 Share of Costs</strong> = (Total Costs − Base Costs) × Same Slab %</p>
                <p><strong>LH2 Net Earnings</strong> = LH2 Revenue − LH2 Costs</p>
                <div className="mt-3 p-2 bg-indigo-50 rounded text-xs">
                  <strong>Default Slabs:</strong> Up to 1.3x → 0% | ≥2x → 20% | ≥3x → 30% | &gt;3x → 50%
                </div>
                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                  <strong>⚡ Auto 50% Mode:</strong> If Base Revenue AND Base Costs are both 0, the system automatically applies 50% rev share to total (not incremental).
                </div>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                  <strong>💡 Indirect Costs:</strong> Configured per brand as % of Direct Costs (salaries). Added to total costs before P&L calculation.
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-bold mb-3">🔄 Data Management</h4>
              <p className="text-sm text-gray-600 mb-3">All changes are auto-saved and shared with all users.</p>
              <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reset All Data to Defaults</button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="bg-gray-800 text-gray-400 text-center py-3 mt-6 text-sm">
        LH2 AOP Dashboard v10.0 | Collapsible Overview | {lastSaved && `Last saved: ${lastSaved}`}
      </footer>

      <AddBrandWizard isOpen={showAddBrandWizard} onClose={() => setShowAddBrandWizard(false)} onAddBrand={handleAddBrand} />
    </div>
  );
}
