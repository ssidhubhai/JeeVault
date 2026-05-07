import React, { useState, useEffect, useMemo } from 'react';
import { MistakeRecord, getMistakes, saveMistake, deleteMistake } from '../lib/db';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { AlertOctagon, CheckCircle2, Circle, AlertTriangle, Filter, Plus, Trash2 } from 'lucide-react';
import { JEE_SYLLABUS } from '../lib/constants';
import { Subject } from '../App';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

const ERROR_TYPES = [
  { id: 'conceptual', label: 'Conceptual', color: '#ef4444' }, // Red
  { id: 'calculation', label: 'Calculation', color: '#f97316' }, // Orange
  { id: 'read_wrong', label: 'Read Problem Wrong', color: '#eab308' }, // Yellow
  { id: 'formula', label: 'Formula Mis-use', color: '#3b82f6' }, // Blue
  { id: 'time', label: 'Time Pressure/Panic', color: '#a855f7' }, // Purple
  { id: 'other', label: 'Other', color: '#737373' }, // Gray
];

export function MistakeBook() {
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [source, setSource] = useState('');
  const [subject, setSubject] = useState<Subject>('Physics');
  const [chapter, setChapter] = useState('');
  const [mistakeText, setMistakeText] = useState('');
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<string[]>([]);
  const [actionItem, setActionItem] = useState('');

  // Filter State
  const [filterSubject, setFilterSubject] = useState<Subject | 'All'>('All');
  const [filterResolved, setFilterResolved] = useState<'All' | 'Pending' | 'Resolved'>('All');

  useEffect(() => {
    loadMistakes();
  }, []);

  const loadMistakes = async () => {
    const data = await getMistakes();
    setMistakes(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !chapter || !mistakeText || !actionItem) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (selectedErrorTypes.length === 0) {
      toast.error("Please select at least one error type.");
      return;
    }

    const newMistake: MistakeRecord = {
      id: crypto.randomUUID(),
      source,
      subject,
      chapter,
      mistakeText,
      errorTypes: selectedErrorTypes,
      actionItem,
      resolved: false,
      timestamp: Date.now()
    };

    await saveMistake(newMistake);
    toast.success("Mistake logged successfully!");
    
    // Reset form
    setShowForm(false);
    setSource('');
    setMistakeText('');
    setActionItem('');
    setSelectedErrorTypes([]);
    
    loadMistakes();
  };

  const toggleResolved = async (id: string, currentState: boolean) => {
    const mistake = mistakes.find(m => m.id === id);
    if (mistake) {
      const updated = { ...mistake, resolved: !currentState };
      await saveMistake(updated);
      loadMistakes();
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this log?")) {
      await deleteMistake(id);
      loadMistakes();
    }
  };

  // --- Analytics Derivations ---

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    ERROR_TYPES.forEach(t => counts[t.id] = 0);
    
    let total = 0;
    mistakes.forEach(m => {
      m.errorTypes.forEach(type => {
        if (counts[type] !== undefined) {
          counts[type]++;
          total++;
        }
      });
    });

    if (total === 0) return [];

    return ERROR_TYPES.map(t => ({
      name: t.label,
      value: counts[t.id],
      color: t.color,
      percentage: Math.round((counts[t.id] / total) * 100)
    })).filter(d => d.value > 0);
  }, [mistakes]);

  const barData = useMemo(() => {
    const counts: Record<string, number> = {
      'Physics': 0, 'Physical Chemistry': 0, 'Inorganic Chemistry': 0, 'Organic Chemistry': 0, 'Mathematics': 0
    };
    mistakes.forEach(m => {
      if (counts[m.subject] !== undefined) counts[m.subject]++;
    });
    return Object.keys(counts).map(subj => ({
      subject: subj.replace(' Chemistry', ' Chem'), // Shorten for axis
      count: counts[subj]
    }));
  }, [mistakes]);

  const hotspots = useMemo(() => {
    const counts: Record<string, { subject: string, chapter: string, count: number }> = {};
    mistakes.forEach(m => {
      const key = `${m.subject}_${m.chapter}`;
      if (!counts[key]) counts[key] = { subject: m.subject, chapter: m.chapter, count: 0 };
      counts[key].count++;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [mistakes]);

  const filteredMistakes = useMemo(() => {
    return mistakes.filter(m => {
      if (filterSubject !== 'All' && m.subject !== filterSubject) return false;
      if (filterResolved === 'Pending' && m.resolved) return false;
      if (filterResolved === 'Resolved' && !m.resolved) return false;
      return true;
    });
  }, [mistakes, filterSubject, filterResolved]);

  const chaptersAvailable = useMemo(() => {
    const c11 = JEE_SYLLABUS[subject]?.['Class 11'] || [];
    const c12 = JEE_SYLLABUS[subject]?.['Class 12'] || [];
    return [...c11, ...c12];
  }, [subject]);

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2 flex items-center gap-3">
              <AlertOctagon className="w-8 h-8 text-rose-500" />
              The Mistake Book
            </h1>
            <p className="text-sm md:text-base text-neutral-500 dark:text-neutral-400 max-w-2xl">
              Error Analytics & Remedies. Log calculation errors, silly mistakes, and conceptual gaps. Force yourself to define an Action Item.
            </p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium rounded-lg shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {showForm ? <Filter className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'View Feed' : 'Log Mistake'}
          </button>
        </header>

        {/* Top Section - Analytics Dashboard */}
        {!showForm && mistakes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-neutral-900 dark:text-white mb-4">Mistakes by Type</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', background: '#171717', color: 'white' }}
                      itemStyle={{ color: 'white' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-sm text-neutral-500">
                {pieData.slice(0, 2).map((d, i) => (
                  <div key={i} className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}/>
                      {d.name}
                    </div>
                    <span className="font-medium text-neutral-900 dark:text-white">{d.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hidden md:block">
              <h3 className="font-bold text-neutral-900 dark:text-white mb-4">Mistakes by Subject</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                    <XAxis dataKey="subject" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
              <h3 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Hotspot Chapters
              </h3>
              <div className="flex-1 flex flex-col gap-3 justify-center">
                {hotspots.map((hs, i) => (
                  <div key={i} className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                      #{i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{hs.chapter}</p>
                      <p className="text-xs text-neutral-500 truncate">{hs.subject} • {hs.count} errors</p>
                    </div>
                  </div>
                ))}
                {hotspots.length === 0 && <p className="text-sm text-neutral-400 text-center">No clear hotspots yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Middle Section - The Entry Form */}
        {showForm && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold mb-6 text-neutral-900 dark:text-white">Log a New Error</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Source (e.g. Major Test 1)</label>
                  <input type="text" required value={source} onChange={e => setSource(e.target.value)} className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Subject</label>
                  <select value={subject} onChange={e => { setSubject(e.target.value as Subject); setChapter(''); }} className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="Physics">Physics</option>
                    <option value="Physical Chemistry">Physical Chemistry</option>
                    <option value="Inorganic Chemistry">Inorganic Chemistry</option>
                    <option value="Organic Chemistry">Organic Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Chapter</label>
                  <select required value={chapter} onChange={e => setChapter(e.target.value)} className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Chapter</option>
                    {chaptersAvailable.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">Error Types (Select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {ERROR_TYPES.map(type => {
                    const isSelected = selectedErrorTypes.includes(type.id);
                    return (
                      <button
                        type="button"
                        key={type.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedErrorTypes(prev => prev.filter(id => id !== type.id));
                          } else {
                            setSelectedErrorTypes(prev => [...prev, type.id]);
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                          isSelected 
                            ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900" 
                            : "bg-neutral-50 border-neutral-200 text-neutral-600 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        )}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    The Mistake: What went wrong?
                  </label>
                  <textarea 
                    required 
                    value={mistakeText}
                    onChange={e => setMistakeText(e.target.value)}
                    placeholder="e.g. I took g=9.8 instead of 10, or I forgot the formula for moment of inertia of a solid sphere."
                    className="w-full h-32 p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm resize-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold mb-1 text-rose-600 dark:text-rose-400">
                    <AlertOctagon className="w-4 h-4" />
                    Action Item (CRITICAL)
                  </label>
                  <textarea 
                    required 
                    value={actionItem}
                    onChange={e => setActionItem(e.target.value)}
                    placeholder="e.g. Re-read standard assumptions in mechanics, re-derive MoI for all standard shapes."
                    className="w-full h-32 p-3 rounded-xl border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-sm resize-none focus:ring-2 focus:ring-rose-500 placeholder:text-rose-400/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity">
                  Log Mistake
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Bottom Section - The Mistake Feed */}
        {!showForm && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Mistake Feed</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <select 
                  value={filterSubject}
                  onChange={e => setFilterSubject(e.target.value as any)}
                  className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm flex-1 sm:flex-none"
                >
                  <option value="All">All Subjects</option>
                  <option value="Physics">Physics</option>
                  <option value="Physical Chemistry">Physical Chemistry</option>
                  <option value="Inorganic Chemistry">Inorganic Chemistry</option>
                  <option value="Organic Chemistry">Organic Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                </select>
                <select 
                  value={filterResolved}
                  onChange={e => setFilterResolved(e.target.value as any)}
                  className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm flex-1 sm:flex-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredMistakes.map(mistake => (
                <div key={mistake.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-4">
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {mistake.source}
                        </span>
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">{mistake.subject}</span>
                        <span className="text-neutral-400">•</span>
                        <span className="text-sm text-neutral-500 truncate">{mistake.chapter}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {mistake.errorTypes.map(typeId => {
                          const typeDef = ERROR_TYPES.find(t => t.id === typeId);
                          return typeDef ? (
                            <span 
                              key={typeId} 
                              className="px-2 py-0.5 rounded text-xs font-medium border"
                              style={{ 
                                backgroundColor: `${typeDef.color}20`, // 20% opacity 
                                borderColor: `${typeDef.color}40`, 
                                color: typeDef.color 
                              }}
                            >
                              {typeDef.label}
                            </span>
                          ) : null;
                        })}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">What went wrong:</h4>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg">
                          {mistake.mistakeText}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">Action Item:</h4>
                        <p className={cn(
                          "text-sm p-3 rounded-lg font-medium transition-colors",
                          mistake.resolved 
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 line-through opacity-75" 
                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                        )}>
                          {mistake.actionItem}
                        </p>
                      </div>

                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <button 
                        onClick={() => toggleResolved(mistake.id, mistake.resolved)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                          mistake.resolved 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                      >
                        {mistake.resolved ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        {mistake.resolved ? 'Resolved' : 'Mark Done'}
                      </button>
                      <button 
                        onClick={() => handleDelete(mistake.id)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-neutral-400 mt-2">
                        {new Date(mistake.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                  </div>
                </div>
              ))}

              {mistakes.length === 0 && !showForm && (
                <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed">
                  <AlertOctagon className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">No mistakes logged yet</h3>
                  <p className="text-neutral-500 max-w-sm mx-auto mb-4">Start logging your errors to identify patterns and fix your conceptual gaps.</p>
                  <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium rounded-lg">Log First Mistake</button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
