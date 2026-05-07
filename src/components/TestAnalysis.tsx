import React, { useState, useEffect } from 'react';
import { TestSubmission, getTestSubmissions, addTestSubmission, deleteTestSubmission, SubjectStat, QuestionStat, updateTestSubmission, getAllDailyPlans } from '../lib/db';
import { Activity, Plus, Trash2, ArrowLeft, Save, HelpCircle, AlertCircle, Info, ChevronRight, CheckCircle2, XCircle, MinusCircle, Edit3, Target, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// We'll create a wizard-like flow
export function TestAnalysis() {
  const [tests, setTests] = useState<TestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'detail' | 'compare'>('list');
  const [selectedTest, setSelectedTest] = useState<TestSubmission | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [testToDelete, setTestToDelete] = useState<string | null>(null);

  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState({
    hours: 0,
    completedTasks: 0,
    totalTasks: 0,
    topReason: 'None'
  });

  useEffect(() => {
    fetchTests();
    checkWeeklyReview();
  }, [view]);

  const checkWeeklyReview = async () => {
    const plans = await getAllDailyPlans();
    const now = new Date();
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    let hours = 0;
    let completedTasks = 0;
    let totalTasks = 0;
    const reasons: Record<string, number> = {};

    plans.forEach(p => {
      if (p.dateStr !== 'current' && p.dateStr !== 'tomorrow') {
        const planDate = new Date(p.dateStr);
        if (planDate >= last7Days && planDate <= now) {
          hours += p.hoursStudied || 0;
          totalTasks += p.tasks.length;
          completedTasks += p.tasks.filter(t => t.completed).length;
          
          p.tasks.forEach(t => {
            if (!t.completed && t.missedReason) {
              const reason = t.missedReason === 'Other' ? (t.missedNotes || 'Other') : t.missedReason;
              reasons[reason] = (reasons[reason] || 0) + 1;
            }
          });
        }
      }
    });

    let topReason = 'None';
    let maxCount = 0;
    Object.entries(reasons).forEach(([r, c]) => {
      if (c > maxCount) {
        maxCount = c;
        topReason = r;
      }
    });

    setWeeklyStats({ hours, completedTasks, totalTasks, topReason });
  };

  const fetchTests = async () => {
    setIsLoading(true);
    try {
      const data = await getTestSubmissions();
      setTests(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setTestToDelete(id);
  };

  const confirmDelete = async () => {
    if (!testToDelete) return;
    try {
      await deleteTestSubmission(testToDelete);
      setTests(prev => prev.filter(t => t.id !== testToDelete));
      toast.success('Test deleted');
      if (selectedTest?.id === testToDelete) {
        setView('list');
        setSelectedTest(null);
      }
    } catch {
      toast.error('Failed to delete test');
    } finally {
      setTestToDelete(null);
    }
  };

  const handleUpdate = async (testToUpdate: TestSubmission) => {
    try {
      await updateTestSubmission(testToUpdate);
      setTests(prev => prev.map(t => t.id === testToUpdate.id ? testToUpdate : t));
      if (selectedTest?.id === testToUpdate.id) {
         setSelectedTest(testToUpdate);
      }
      toast.success('Test updated');
    } catch {
      toast.error('Failed to update test');
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden relative">
      <header className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'list' && (
            <button 
              onClick={() => {
                setView('list');
                setCompareSelection([]);
              }}
              className="p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors mr-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Test Analysis</h1>
            {view === 'list' && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Track mock tests, AITS, and batch tests.</p>
            )}
            {view === 'create' && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Add a new test result</p>
            )}
            {view === 'detail' && selectedTest && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{selectedTest.name}</p>
            )}
            {view === 'compare' && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Compare {compareSelection.length} selected tests</p>
            )}
          </div>
        </div>
        
        {view === 'list' && (
          <div className="flex items-center gap-2">
            {tests.length >= 2 && (
              <button
                onClick={() => {
                  if (isCompareMode && compareSelection.length >= 2) {
                    setView('compare');
                  } else {
                    setIsCompareMode(!isCompareMode);
                    setCompareSelection([]);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm",
                  isCompareMode && compareSelection.length >= 2 
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : isCompareMode
                      ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                )}
              >
                {isCompareMode && compareSelection.length >= 2 ? `Compare (${compareSelection.length})` : isCompareMode ? 'Cancel' : 'Compare'}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Tabs / Navigation */}
      {(view === 'list' || view === 'create') && (
        <div className="px-6 pt-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex space-x-6">
            <button
              onClick={() => setView('list')}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                view === 'list' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
              )}
            >
              Dashboard
            </button>
            <button
              onClick={() => { setView('create'); setIsCompareMode(false); }}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                view === 'create' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" 
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
              )}
            >
              Add Test
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {view === 'list' && (
          <div className="p-4 sm:p-6 w-full max-w-5xl mx-auto space-y-8">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 cursor-pointer hover:shadow-xl transition-all" onClick={() => setShowWeeklyReview(true)}>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">The Weekly Review</h3>
                  <p className="text-white/80 text-sm">Analyze your execution consistency from the Planner over the last 7 days.</p>
                </div>
              </div>
              <button className="px-6 py-2 bg-white text-indigo-600 font-bold rounded-lg whitespace-nowrap hover:bg-neutral-50 transition-colors">
                Run Review
              </button>
            </div>

            {!isCompareMode && tests.length > 0 && <DashboardTrends tests={tests} />}
            <TestList 
              tests={tests} 
              isLoading={isLoading} 
              onSelect={(test) => { 
                if (isCompareMode) {
                  setCompareSelection(prev => 
                    prev.includes(test.id) ? prev.filter(id => id !== test.id) : [...prev, test.id].slice(-3) // Max 3 for comparison
                  );
                } else {
                  setSelectedTest(test); 
                  setView('detail'); 
                }
              }} 
              onDelete={handleDelete} 
              isCompareMode={isCompareMode}
              compareSelection={compareSelection}
            />
          </div>
        )}
        {view === 'compare' && (
          <TestComparison tests={tests.filter(t => compareSelection.includes(t.id))} />
        )}
        {view === 'create' && (
          <CreateTestWizard onComplete={() => { fetchTests(); setView('list'); }} onCancel={() => setView('list')} />
        )}
        {view === 'detail' && selectedTest && (
          <TestDetail test={selectedTest} onDelete={() => handleDelete(selectedTest.id)} onUpdate={handleUpdate} />
        )}
      </div>

      {testToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">Delete Test</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm">
              Are you sure you want to delete this test? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setTestToDelete(null)}
                className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Review Modal */}
      {showWeeklyReview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Weekly Execution Review</h2>
              <p className="text-neutral-500 mt-2">Based on the daily planner over the last 7 days.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl text-center">
                <p className="text-sm font-medium text-neutral-500 mb-1">Hours Studied</p>
                <p className="text-3xl font-bold text-neutral-900 dark:text-white">{weeklyStats.hours}<span className="text-lg text-neutral-400 font-medium">h</span></p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl text-center">
                <p className="text-sm font-medium text-neutral-500 mb-1">Tasks Completed</p>
                <p className="text-3xl font-bold text-neutral-900 dark:text-white">
                  {weeklyStats.completedTasks}<span className="text-lg text-neutral-400 font-medium">/{weeklyStats.totalTasks}</span>
                </p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-5 rounded-2xl mb-8 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
              <div>
                <h4 className="font-bold text-rose-700 dark:text-rose-400 mb-1">Execution Leak</h4>
                <p className="text-sm text-rose-600 dark:text-rose-300">
                  Your #1 reason for missed targets this week was: <strong>{weeklyStats.topReason}</strong>
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowWeeklyReview(false)}
              className="w-full py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl text-lg hover:opacity-90 transition-opacity shadow-sm active:scale-[0.98]"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardTrends({ tests }: { tests: TestSubmission[] }) {
  // Sort tests chronologically for trends
  const trendData = [...tests].sort((a, b) => a.timestamp - b.timestamp).map(t => {
    const totalScoreP = (t.score / t.maxScore) * 100; // simplify to % for mixing mains/adv
    const getAcc = (c: number, i: number) => {
      const tot = c + i;
      if (tot === 0) return 0;
      return Math.round((c / tot) * 100);
    };
    const pAcc = getAcc(t.physics.correct, t.physics.incorrect);
    const cAcc = getAcc(t.chemistry.correct, t.chemistry.incorrect);
    const mAcc = getAcc(t.maths.correct, t.maths.incorrect);
    
    return {
      name: t.name,
      scorePercent: parseFloat(totalScoreP.toFixed(1)),
      percentile: t.percentile || null,
      pAcc, cAcc, mAcc,
      score: t.score
    };
  });

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-indigo-500" /> Performance Trends
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
            <RechartsTooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }}/>
            <Line type="monotone" dataKey="scorePercent" name="Score %" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="pAcc" name="Phy Acc %" stroke="#3b82f6" strokeWidth={2} dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="cAcc" name="Chem Acc %" stroke="#10b981" strokeWidth={2} dot={false} opacity={0.5} />
            <Line type="monotone" dataKey="mAcc" name="Math Acc %" stroke="#f43f5e" strokeWidth={2} dot={false} opacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTS
// -------------------------------------------------------------

function TestList({ tests, isLoading, onSelect, onDelete, isCompareMode, compareSelection }: { tests: TestSubmission[], isLoading: boolean, onSelect: (t: TestSubmission) => void, onDelete: (id: string) => void, isCompareMode?: boolean, compareSelection?: string[] }) {
  if (isLoading) {
    return <div className="p-8 text-center text-neutral-500">Loading tests...</div>;
  }

  if (tests.length === 0) {
    return (
      <div className="p-12 text-center text-neutral-500 max-w-sm mx-auto mt-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
        <Activity className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No Tests Logged</h3>
        <p className="text-sm">Start tracking your AITS, regular batch tests, and mock tests to analyze weak areas over time.</p>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tests.map(test => {
        const isSelected = isCompareMode && compareSelection?.includes(test.id);
        const getAcc = (c: number, i: number) => {
          const t = c + i;
          if (t === 0) return 0;
          return Math.round((c / t) * 100);
        };
        const overallAcc = getAcc(test.physics.correct + test.chemistry.correct + test.maths.correct, test.physics.incorrect + test.chemistry.incorrect + test.maths.incorrect);
        
        return (
          <div 
            key={test.id} 
            onClick={() => onSelect(test)}
            className={cn(
              "bg-white dark:bg-neutral-900 border rounded-xl p-5 transition-all cursor-pointer group relative",
              isSelected 
                ? "border-amber-500 shadow-md ring-2 ring-amber-500/20" 
                : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 hover:shadow-md"
            )}
          >
            {isCompareMode && (
              <div className={cn(
                "absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10",
                isSelected ? "bg-amber-500 border-amber-500 text-white" : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-transparent"
              )}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider",
                    test.category === 'Regular Batch' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    test.category === 'AITS' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  )}>
                    {test.category}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 uppercase tracking-wider">
                    {test.type}
                  </span>
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white line-clamp-1 pr-6">{test.name}</h3>
              </div>
              {!isCompareMode && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(test.id); }}
                  className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all absolute top-4 right-4"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-end justify-between mb-4">
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{test.score}</span>
                <span className="text-neutral-500 dark:text-neutral-400 font-medium pb-0.5">/ {test.maxScore}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Accuracy</span>
                <span className={cn(
                  "font-bold text-sm",
                  overallAcc >= 80 ? "text-emerald-500" : overallAcc >= 60 ? "text-amber-500" : "text-rose-500"
                )}>{overallAcc}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-neutral-600 dark:text-neutral-400">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Percentile</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{test.percentile ? `${test.percentile}%ile` : '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Rank</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{test.rank ? `#${test.rank}` : '-'}</span>
              </div>
              <div className="col-span-2 flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs">
                    {new Date(test.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {!isCompareMode && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (test.testUrl) {
                          window.open(test.testUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          toast('No link saved. Go to details to add one.', { icon: 'ℹ️' }); 
                        }
                      }}
                      className={cn(
                        "text-[10px] uppercase font-bold tracking-wider flex items-center gap-0.5",
                        test.testUrl ? "text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400" : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                      )}
                    >
                      Go to Test
                    </button>
                  )}
                </div>
                {!isCompareMode && <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------
// WIZARD
// -------------------------------------------------------------

function CreateTestWizard({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'JEE Mains' | 'JEE Advanced'>('JEE Mains');
  const [category, setCategory] = useState<'Regular Batch' | 'AITS' | 'Mock Test'>('AITS');
  const [subType, setSubType] = useState<'Paper 1' | 'Paper 2' | 'Combined' | null>(null); // For Adv

  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [testUrl, setTestUrl] = useState('');

  const [overallScore, setOverallScore] = useState('');
  const [maxScore, setMaxScore] = useState('300'); // Default 300 for Mains
  const [percentile, setPercentile] = useState('');
  const [rank, setRank] = useState('');

  // Subject Stats
  const emptySubject = { score: '', percentile: '', correct: '', incorrect: '', skipped: '' };
  const [physics, setPhysics] = useState({ ...emptySubject });
  const [chemistry, setChemistry] = useState({ ...emptySubject });
  const [maths, setMaths] = useState({ ...emptySubject });

  // Questions Grids
  const [questions, setQuestions] = useState<QuestionStat[]>([]);

  // Build grid based on Type when advancing to grid step
  useEffect(() => {
    if (step === 3 && questions.length === 0) {
      const qNum = type === 'JEE Mains' ? 25 : 17; // Assuming 17 per subj for Adv
      const initial: QuestionStat[] = [];
      const subjects = ['Physics', 'Chemistry', 'Mathematics'];
      let globalId = 1;

      for (const subj of subjects) {
        for (let i = 1; i <= qNum; i++) {
          initial.push({
            id: `Q${globalId++}`,
            subject: subj,
            status: 'Unmarked'
          });
        }
      }
      setQuestions(initial);
    }
  }, [step, type, questions.length]);

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    
    try {
      const parseNum = (val: string) => val ? Number(val) : 0;
      
      const payload: TestSubmission = {
        id: crypto.randomUUID(),
        name,
        timestamp: new Date(dateStr).getTime() + (new Date().getTime() % 86400000), // add current time of day
        type,
        category,
        score: parseNum(overallScore),
        maxScore: parseNum(maxScore) || (type === 'JEE Mains' ? 300 : 360),
        percentile: percentile ? parseNum(percentile) : undefined,
        rank: rank ? parseNum(rank) : undefined,
        testUrl: testUrl.trim() ? testUrl.trim() : undefined,
        
        physics: {
          score: parseNum(physics.score),
          percentile: physics.percentile ? parseNum(physics.percentile) : undefined,
          correct: parseNum(physics.correct),
          incorrect: parseNum(physics.incorrect),
          skipped: parseNum(physics.skipped),
        },
        chemistry: {
          score: parseNum(chemistry.score),
          percentile: chemistry.percentile ? parseNum(chemistry.percentile) : undefined,
          correct: parseNum(chemistry.correct),
          incorrect: parseNum(chemistry.incorrect),
          skipped: parseNum(chemistry.skipped),
        },
        maths: {
          score: parseNum(maths.score),
          percentile: maths.percentile ? parseNum(maths.percentile) : undefined,
          correct: parseNum(maths.correct),
          incorrect: parseNum(maths.incorrect),
          skipped: parseNum(maths.skipped),
        },
        questions
      };

      if (type === 'JEE Advanced' && subType) {
        payload.name = `${payload.name} (${subType})`;
      }

      await addTestSubmission(payload);
      toast.success('Test Saved Successfully');
      onComplete();
    } catch (e) {
      toast.error('Failed to save test');
      console.error(e);
      setIsSaving(false);
    }
  };

  const toggleStatus = (idx: number) => {
    const nextArr = [...questions];
    const q = nextArr[idx];
    if (q.status === 'Unmarked') q.status = 'Correct';
    else if (q.status === 'Correct') q.status = 'Incorrect';
    else if (q.status === 'Incorrect') q.status = 'Skipped';
    else q.status = 'Unmarked';
    setQuestions(nextArr);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8">
      {/* Progess Bar */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(st => (
          <div key={st} className="flex-1 flex flex-col gap-2">
            <div className={cn("h-2 rounded-full transition-colors", step >= st ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-800")} />
            <span className={cn("text-xs font-bold uppercase tracking-wider", step >= st ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-400")}>
              {st === 1 ? 'Details' : st === 2 ? 'Scores' : 'Questions (Opt)'}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium mb-1.5">Test Name</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. AITS Test 4, Weekly Part Test 2"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1.5">Date</label>
                <input 
                  type="date"
                  value={dateStr} onChange={e => setDateStr(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1.5">Category</label>
                <select 
                  value={category} onChange={e => setCategory(e.target.value as any)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800"
                >
                  <option value="Regular Batch">Regular Batch Test</option>
                  <option value="AITS">All India Test Series (AITS)</option>
                  <option value="Mock Test">Personal Mock Test</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1.5">Test Link (Opt)</label>
                <input 
                  type="url"
                  value={testUrl} onChange={e => setTestUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                Test Pattern
                <span title="Select the official pattern this test follows to pre-configure defaults and layout."><HelpCircle className="w-4 h-4 text-neutral-400 cursor-help" /></span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setType('JEE Mains'); setMaxScore('300'); setSubType(null); }}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    type === 'JEE Mains' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                  )}
                >
                  <div className="font-bold mb-1">JEE Mains</div>
                  <div className="text-xs opacity-80 mt-1">Single Paper (300 Marks)</div>
                </button>
                <button
                  onClick={() => { setType('JEE Advanced'); setMaxScore('180'); setSubType('Paper 1'); }}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    type === 'JEE Advanced' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                  )}
                >
                  <div className="font-bold mb-1">JEE Advanced</div>
                  <div className="text-xs opacity-80 mt-1">Multi Paper (Varying Marks)</div>
                </button>
              </div>

              {type === 'JEE Advanced' && (
                <div className="flex gap-2 mt-4">
                   {['Paper 1', 'Paper 2', 'Combined'].map(p => (
                     <button 
                      key={p}
                      onClick={() => setSubType(p as any)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium border",
                        subType === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-400"
                      )}
                     >
                       {p}
                     </button>
                   ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-4">
              <button 
                onClick={handleNext}
                disabled={!name.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg disabled:opacity-50"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* OVERALL */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
                Overall Performance <span className="text-xs font-normal text-indigo-500 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded">Required</span>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Total Score</label>
                  <input type="number" value={overallScore} onChange={e => setOverallScore(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-950 font-bold" placeholder="e.g. 210" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Max Score</label>
                  <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-950 text-neutral-500" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1">
                    Percentile (Opt)
                    <span title="Your relative performance metric comparing you to other test takers."><HelpCircle className="w-3.5 h-3.5 text-neutral-400 cursor-help" /></span>
                  </label>
                  <input type="number" step="0.01" value={percentile} onChange={e => setPercentile(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-950" placeholder="e.g. 98.5" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1">
                    Rank (Opt)
                    <span title="Your all India or batch rank for this specific test."><HelpCircle className="w-3.5 h-3.5 text-neutral-400 cursor-help" /></span>
                  </label>
                  <input type="number" value={rank} onChange={e => setRank(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-950" placeholder="e.g. 4500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SubjectInputCard title="Physics" data={physics} onChange={setPhysics} color="blue" />
              <SubjectInputCard title="Chemistry" data={chemistry} onChange={setChemistry} color="emerald" />
              <SubjectInputCard title="Mathematics" data={maths} onChange={setMaths} color="rose" />
            </div>

            <div className="flex justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
               <button onClick={handlePrev} className="px-6 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-bold rounded-lg transition-colors">
                Back
              </button>
              <button onClick={handleNext} disabled={!overallScore} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg disabled:opacity-50 transition-colors">
                Question Analysis (Optional) →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-amber-50 dark:bg-amber-900/20 border justify-between flex-wrap border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex items-center md:items-center gap-4 text-amber-800 dark:text-amber-300">
              <div className="flex gap-3">
                <Info className="w-5 h-5 shrink-0" />
                <div className="text-sm">
                  <strong>Question Grid (Optional)</strong>
                  <p>Click to toggle: <span className="text-emerald-600 font-bold">1x (Correct)</span> → <span className="text-red-500 font-bold">2x (Incorrect)</span> → <span className="text-neutral-400 font-bold">3x (Skipped)</span>.
                  <br />Useful for tracking exactly which questions cost you.</p>
                </div>
              </div>
              <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 w-full sm:w-auto shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm whitespace-nowrap"
                >
                  {isSaving ? "Saving..." : "Save Test Now"}
                </button>
            </div>

            <div className="space-y-8">
              {['Physics', 'Chemistry', 'Mathematics'].map(subj => {
                const subQs = questions.filter(q => q.subject === subj);
                if (subQs.length === 0) return null;
                
                return (
                  <div key={subj}>
                    <h4 className={cn(
                      "font-bold text-sm uppercase tracking-wider mb-3 pb-1 border-b",
                      subj === 'Physics' ? "text-blue-500 border-blue-100 dark:border-blue-900/30" :
                      subj === 'Chemistry' ? "text-emerald-500 border-emerald-100 dark:border-emerald-900/30" :
                      "text-rose-500 border-rose-100 dark:border-rose-900/30"
                    )}>{subj}</h4>
                    <div className="flex flex-wrap gap-2">
                       {subQs.map((q) => {
                         const idx = questions.findIndex(x => x.id === q.id);
                         return (
                           <button
                            key={idx}
                            onClick={() => toggleStatus(idx)}
                            className={cn(
                              "w-10 h-10 rounded-lg text-xs font-black transition-all flex items-center justify-center border-2 border-b-4 active:border-b-2 active:translate-y-[2px]",
                              q.status === 'Unmarked' ? "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400" :
                              q.status === 'Correct' ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400" :
                              q.status === 'Incorrect' ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400" :
                              "bg-neutral-100 dark:bg-neutral-800 border-neutral-400 text-neutral-600 dark:text-neutral-400 border-dashed"
                            )}
                           >
                             {q.id.replace('Q', '')}
                           </button>
                         )
                       })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between pt-6 border-t border-neutral-100 dark:border-neutral-800">
               <button onClick={handlePrev} className="px-6 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-bold rounded-lg transition-colors">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubjectInputCard({ title, data, onChange, color }: { title: string, data: any, onChange: (d: any) => void, color: 'blue' | 'emerald' | 'rose' }) {
  const handleChange = (field: string, val: string) => onChange({ ...data, [field]: val });
  
  return (
    <div className={cn(
      "p-4 border rounded-xl bg-white dark:bg-neutral-950",
      color === 'blue' ? "border-blue-100 dark:border-blue-900/30" :
      color === 'emerald' ? "border-emerald-100 dark:border-emerald-900/30" :
      "border-rose-100 dark:border-rose-900/30"
    )}>
       <h4 className={cn("font-bold text-sm uppercase tracking-wider mb-4 pb-2 border-b",
          color === 'blue' ? "text-blue-600 border-blue-100 dark:border-blue-900/30" :
          color === 'emerald' ? "text-emerald-600 border-emerald-100 dark:border-emerald-900/30" :
          "text-rose-600 border-rose-100 dark:border-rose-900/30"
       )}>{title}</h4>
       <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Score</label>
               <input type="number" value={data.score} onChange={e => handleChange('score', e.target.value)} className="w-full px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-md text-sm" />
             </div>
             <div>
               <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">%ile</label>
               <input type="number" step="0.01" value={data.percentile} onChange={e => handleChange('percentile', e.target.value)} className="w-full px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 rounded-md text-sm" />
             </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
             <div className="text-center">
               <label className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1"><CheckCircle2 className="w-3 h-3 mx-auto mb-0.5"/> Cor</label>
               <input type="number" value={data.correct} onChange={e => handleChange('correct', e.target.value)} className="w-full px-2 py-1 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 rounded-md text-sm text-center" />
             </div>
             <div className="text-center">
               <label className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1"><XCircle className="w-3 h-3 mx-auto mb-0.5"/> Inc</label>
               <input type="number" value={data.incorrect} onChange={e => handleChange('incorrect', e.target.value)} className="w-full px-2 py-1 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md text-sm text-center" />
             </div>
             <div className="text-center">
               <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1"><MinusCircle className="w-3 h-3 mx-auto mb-0.5"/> Skip</label>
               <input type="number" value={data.skipped} onChange={e => handleChange('skipped', e.target.value)} className="w-full px-2 py-1 border border-neutral-200 bg-neutral-50 dark:bg-neutral-900 dark:border-neutral-800 rounded-md text-sm text-center" />
             </div>
          </div>
       </div>
    </div>
  )
}

function TestComparison({ tests }: { tests: TestSubmission[] }) {
  if (tests.length === 0) return null;

  const getAcc = (c: number, i: number) => {
    const t = c + i;
    if (t === 0) return 0;
    return Math.round((c / t) * 100);
  };

  const chartData = ['Physics', 'Chemistry', 'Mathematics'].map(subj => {
    const obj: any = { subject: subj };
    tests.forEach((t, i) => {
      const subjectData = subj === 'Physics' ? t.physics : subj === 'Chemistry' ? t.chemistry : t.maths;
      obj[`test_${i}_score`] = subjectData.score;
      obj[`test_${i}_acc`] = getAcc(subjectData.correct, subjectData.incorrect);
    });
    return obj;
  });

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="p-4 sm:p-8 w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-6">Compare Tests</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Subject Scores</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                  <XAxis dataKey="subject" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: 'transparent'}}/>
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                  {tests.map((t, i) => (
                    <Bar key={t.id} dataKey={`test_${i}_score`} name={t.name.slice(0, 15) + (t.name.length > 15 ? '...' : '')} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-4">Subject Accuracy (%)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                  <XAxis dataKey="subject" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: 'transparent'}}/>
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                  {tests.map((t, i) => (
                    <Bar key={t.id} dataKey={`test_${i}_acc`} name={t.name.slice(0, 15) + (t.name.length > 15 ? '...' : '')} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} opacity={0.8} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8 max-w-3xl mx-auto">
             {tests.map((t, i) => {
               const oAcc = getAcc(t.physics.correct + t.chemistry.correct + t.maths.correct, t.physics.incorrect + t.chemistry.incorrect + t.maths.incorrect);
               return (
                 <div key={t.id} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 flex flex-wrap items-center gap-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                    <div className="flex-1">
                      <div className="font-bold">{t.name}</div>
                      <div className="text-xs text-neutral-500 uppercase tracking-wider">{t.category} • {t.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-lg">{t.score} <span className="text-sm font-normal text-neutral-400">/ {t.maxScore}</span></div>
                      <div className="text-xs font-semibold text-neutral-500">{oAcc}% Acc</div>
                    </div>
                 </div>
               );
             })}
          </div>

        <div className="overflow-x-auto mt-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500">
                <th className="p-4 font-medium border-b border-neutral-200 dark:border-neutral-800">Metric</th>
                {tests.map((t, i) => (
                  <th key={t.id} className="p-4 font-medium border-b border-neutral-200 dark:border-neutral-800" style={{ color: colors[i % colors.length] }}>
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-neutral-100 dark:border-neutral-800/50">
                <td className="p-4 font-bold text-neutral-600 dark:text-neutral-400">Percentile</td>
                {tests.map(t => <td key={t.id} className="p-4 font-semibold">{t.percentile ? `${t.percentile}%` : '-'}</td>)}
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-800/50">
                <td className="p-4 font-bold text-neutral-600 dark:text-neutral-400">Rank</td>
                {tests.map(t => <td key={t.id} className="p-4 font-semibold">{t.rank ? `#${t.rank}` : '-'}</td>)}
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-800/50">
                <td className="p-4 font-bold text-neutral-600 dark:text-neutral-400">Overall Accuracy</td>
                {tests.map(t => {
                   const oAcc = getAcc(t.physics.correct + t.chemistry.correct + t.maths.correct, t.physics.incorrect + t.chemistry.incorrect + t.maths.incorrect);
                   return <td key={t.id} className="p-4 font-semibold">{oAcc}%</td>
                })}
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-800/50">
                <td className="p-4 font-bold text-blue-500">Physics Score</td>
                {tests.map(t => <td key={t.id} className="p-4 font-semibold">{t.physics.score}</td>)}
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-800/50">
                <td className="p-4 font-bold text-emerald-500">Chemistry Score</td>
                {tests.map(t => <td key={t.id} className="p-4 font-semibold">{t.chemistry.score}</td>)}
              </tr>
              <tr className="border-b border-neutral-100 dark:border-neutral-800/50 break-words">
                <td className="p-4 font-bold text-rose-500">Maths Score</td>
                {tests.map(t => <td key={t.id} className="p-4 font-semibold">{t.maths.score}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TestDetail({ test, onDelete, onUpdate }: { test: TestSubmission, onDelete: () => void, onUpdate: (test: TestSubmission) => void }) {
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [editUrl, setEditUrl] = useState(test.testUrl || '');

  const getAcc = (c: number, i: number) => {
    const t = c + i;
    if (t === 0) return 0;
    return Math.round((c / t) * 100);
  };
  
  const overallAcc = getAcc(test.physics.correct + test.chemistry.correct + test.maths.correct, test.physics.incorrect + test.chemistry.incorrect + test.maths.incorrect);

  return (
    <div className="p-4 sm:p-8 w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER CARD */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Activity className="w-48 h-48 max-w-full" />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              {test.type}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {test.category}
            </span>
            <span className="text-sm text-neutral-500 ml-auto">
              Attempted On: {new Date(test.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white">{test.name}</h2>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {!isEditingLink ? (
                <>
                  <button 
                    onClick={() => {
                      if (test.testUrl) {
                        window.open(test.testUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        setIsEditingLink(true);
                      }
                    }}
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-none px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-lg transition-colors text-sm shadow-sm"
                  >
                    {test.testUrl ? 'Go to Test' : 'Add Link'} <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                  {test.testUrl && (
                    <button onClick={() => setIsEditingLink(true)} className="p-2 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={onDelete} className="p-2 border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input 
                    type="url" 
                    value={editUrl} 
                    onChange={e => setEditUrl(e.target.value)} 
                    placeholder="https://example.com"
                    className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-950 flex-1 min-w-[200px]"
                    autoFocus
                  />
                  <button 
                    onClick={() => {
                      const finalUrl = editUrl.trim() || undefined;
                      onUpdate({ ...test, testUrl: finalUrl });
                      setIsEditingLink(false);
                    }}
                    className="p-2 border border-emerald-200 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shrink-0"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => { setEditUrl(test.testUrl || ''); setIsEditingLink(false); }}
                    className="p-2 bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 shrink-0"
                  >
                     <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-6 rounded-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">Total Score</div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-blue-700 dark:text-blue-400 leading-none">{test.score}</span>
                <span className="text-xl text-blue-400 dark:text-blue-600 font-bold mb-1">/ {test.maxScore}</span>
              </div>
              {test.percentile && <div className="mt-4 text-sm font-medium text-blue-800 dark:text-blue-300">Percentile: {test.percentile}</div>}
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-6 rounded-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">Overall Rank</div>
              <div className="flex items-end gap-2 text-amber-700 dark:text-amber-400">
                 {test.rank ? <><span className="text-2xl font-bold mb-1 pb-1">#</span> <span className="text-5xl font-black leading-none">{test.rank.toLocaleString()}</span></> : <span className="text-lg">Rank not uploaded</span>}
              </div>
              <div className="mt-4 text-sm font-medium text-amber-800 dark:text-amber-300">Overall Accuracy: {overallAcc}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ANALYSIS TABLE */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden mb-8">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
           <h3 className="font-bold text-lg">Section Wise Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500">
                <th className="p-4 font-medium">Section</th>
                <th className="p-4 font-medium text-center">Score</th>
                <th className="p-4 font-medium text-center">%ile</th>
                <th className="p-4 font-medium text-center text-emerald-600">Correct</th>
                <th className="p-4 font-medium text-center text-red-500">Incorrect</th>
                <th className="p-4 font-medium text-center text-neutral-400">Skipped</th>
                <th className="p-4 font-medium text-center">Accuracy</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { n: 'Physics', d: test.physics, col: 'bg-blue-500' },
                { n: 'Chemistry', d: test.chemistry, col: 'bg-emerald-500' },
                { n: 'Maths', d: test.maths, col: 'bg-rose-500' },
              ].map((row, i) => (
                <tr key={row.n} className={cn("border-b border-neutral-100 dark:border-neutral-800/50", i === 2 && "border-0")}>
                  <td className="p-4 font-bold flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", row.col)} />
                    {row.n}
                  </td>
                  <td className="p-4 font-bold text-center">{row.d.score}</td>
                  <td className="p-4 text-center">{row.d.percentile || '-'}</td>
                  <td className="p-4 font-bold text-emerald-600 text-center">{row.d.correct}</td>
                  <td className="p-4 font-bold text-red-500 text-center">{row.d.incorrect}</td>
                  <td className="p-4 text-neutral-500 text-center">{row.d.skipped}</td>
                  <td className="p-4 font-semibold text-center">{getAcc(row.d.correct, row.d.incorrect)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MENTOR INSIGHTS */}
      <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 rounded-2xl p-6 sm:p-8">
        <h3 className="font-black text-xl text-indigo-900 dark:text-indigo-400 mb-6 flex items-center gap-2">
          <Info className="w-6 h-6" /> JEE Mentor Insights
        </h3>
        <div className="space-y-4">
          {[
            { n: 'Physics', d: test.physics },
            { n: 'Chemistry', d: test.chemistry },
            { n: 'Maths', d: test.maths },
          ].map(subj => {
            const acc = getAcc(subj.d.correct, subj.d.incorrect);
            const totalQs = subj.d.correct + subj.d.incorrect + subj.d.skipped;
            const attempt = subj.d.correct + subj.d.incorrect;
            const attemptRate = totalQs > 0 ? (attempt / totalQs) * 100 : 0;
            
            let insight = '';
            let color = 'text-neutral-700 dark:text-neutral-300';
            
            if (attemptRate < 40 && acc > 85) {
              insight = "Excellent accuracy, but attempt rate is too low. You need to improve your speed and widen your syllabus coverage.";
              color = "text-amber-600 dark:text-amber-400";
            } else if (attemptRate > 70 && acc < 60) {
              insight = "High attempts but poor accuracy. You are losing too many marks to negative marking. Be more selective and avoid guessing.";
              color = "text-red-600 dark:text-red-400";
            } else if (attemptRate < 50 && acc < 60) {
              insight = "Low attempts and low accuracy. Back to basics. Focus on strengthening core concepts before taking full tests.";
              color = "text-rose-600 dark:text-rose-400";
            } else if (attemptRate >= 60 && acc >= 80) {
              insight = "Strong performance. Good balance of speed and accuracy. Focus on eliminating the few remaining silly mistakes and maintaining consistency.";
              color = "text-emerald-600 dark:text-emerald-400";
            } else {
              insight = "Average performance. Focus on analyzing your incorrect questions to see if they were conceptual gaps or silly calculation errors.";
              color = "text-blue-600 dark:text-blue-400";
            }
            return (
              <div key={subj.n} className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-900/20">
                <div className="font-bold text-neutral-900 dark:text-white mb-1">{subj.n} Analysis</div>
                <div className={cn("text-sm font-medium", color)}>{insight}</div>
                <div className="mt-2 text-xs text-neutral-500 flex gap-4">
                  <span>Attempt Rate: {Math.round(attemptRate)}%</span>
                  <span>Accuracy: {acc}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUESTION GRID DISPLAY */}
      {test.questions && test.questions.filter(q => q.status !== 'Unmarked').length > 0 && (
         <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6">
            <h3 className="font-bold text-lg mb-6">Attempt Map</h3>
            <div className="space-y-6">
              {['Physics', 'Chemistry', 'Mathematics'].map(subj => {
                const subQs = test.questions.filter(q => q.subject === subj);
                if (subQs.length === 0) return null;
                
                return (
                  <div key={subj}>
                    <h4 className={cn(
                      "font-bold text-xs uppercase tracking-wider mb-3",
                      subj === 'Physics' ? "text-blue-500" :
                      subj === 'Chemistry' ? "text-emerald-500" :
                      "text-rose-500"
                    )}>{subj}</h4>
                    <div className="flex flex-wrap gap-2">
                       {subQs.map((q, idx) => (
                         <div
                          key={idx}
                          className={cn(
                            "w-8 h-8 rounded text-[10px] font-bold flex items-center justify-center border",
                            q.status === 'Unmarked' ? "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400" :
                            q.status === 'Correct' ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400" :
                            q.status === 'Incorrect' ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400" :
                            "bg-neutral-100 dark:bg-neutral-800 border-neutral-400 text-neutral-600 dark:text-neutral-400 border-dashed"
                          )}
                          title={q.status}
                         >
                           {q.id.replace('Q', '')}
                         </div>
                       ))}
                    </div>
                  </div>
                )
              })}
            </div>
         </div>
      )}
    </div>
  );
}
