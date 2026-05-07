import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MockTestRecord, getMockTests, saveMockTest, getAllDailyPlans } from '../lib/db';
import { Activity, Plus, TrendingUp, TrendingDown, Target, Zap, AlertTriangle } from 'lucide-react';

export function AnalyticsView() {
  const [tests, setTests] = useState<MockTestRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  
  // Weekly Review Stats (mocked)
  const [weeklyStats, setWeeklyStats] = useState({
    hours: 0,
    completedTasks: 0,
    totalTasks: 0,
    topReason: 'Procrastination'
  });

  // Form State
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [testName, setTestName] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [positiveMarks, setPositiveMarks] = useState('');
  const [negativeMarks, setNegativeMarks] = useState('');

  useEffect(() => {
    loadData();
    checkWeeklyReview();
  }, []);

  const loadData = async () => {
    const data = await getMockTests();
    setTests(data);
  };

  const checkWeeklyReview = async () => {
    const now = new Date();
    // 0 is Sunday
    if (now.getDay() === 0) {
      // Calculate real stats for the last 7 days
      const plans = await getAllDailyPlans();
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
      setShowWeeklyReview(true);
    }
  };

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName || !totalMarks) return;

    const newTest: MockTestRecord = {
      id: crypto.randomUUID(),
      dateStr,
      testName,
      totalMarks: Number(totalMarks),
      positiveMarks: Number(positiveMarks) || 0,
      negativeMarks: Number(negativeMarks) || 0
    };

    await saveMockTest(newTest);
    setShowAddModal(false);
    
    // Reset form
    setTestName('');
    setTotalMarks('');
    setPositiveMarks('');
    setNegativeMarks('');
    
    loadData();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
              Analytics & Weekly Review
            </h1>
            <p className="text-sm md:text-base text-neutral-500 dark:text-neutral-400">
              Track your mock test trajectories and review weekly execution consistency.
            </p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Mock Test
          </button>
        </header>

        {/* Analytics Main View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 min-h-[400px] flex flex-col">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-neutral-900 dark:text-white">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Mock Test Trajectory
            </h2>
            
            <div className="flex-1 min-h-[300px]">
              {tests.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tests} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                    <XAxis dataKey="dateStr" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#171717' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="totalMarks" name="Total Score" stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="negativeMarks" name="Negative Marks" stroke="#ef4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                  <Activity className="w-12 h-12 mb-2 opacity-50" />
                  <p>No tests logged yet. Start tracking!</p>
                </div>
              )}
            </div>
          </div>

          {/* Test History List */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-col min-h-[400px]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
              <Target className="w-5 h-5 text-blue-500" />
              Test History
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {tests.map(t => (
                <div key={t.id} className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-white">{t.testName}</h4>
                      <p className="text-xs text-neutral-500">{t.dateStr}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{t.totalMarks}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-500 mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <span className="text-emerald-600 dark:text-emerald-400">+{t.positiveMarks}</span>
                    <span className="text-red-500">-{t.negativeMarks}</span>
                  </div>
                </div>
              ))}
              {tests.length === 0 && (
                <p className="text-sm text-neutral-400 text-center italic mt-10">No history available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Weekly Review Prompt */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 cursor-pointer hover:shadow-xl transition-all" onClick={() => setShowWeeklyReview(true)}>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">The Weekly Review</h3>
              <p className="text-white/80 text-sm">Analyze your execution and identify leaks. Do this every Sunday.</p>
            </div>
          </div>
          <button className="px-6 py-2 bg-white text-indigo-600 font-bold rounded-lg whitespace-nowrap hover:bg-neutral-50 transition-colors">
            Run Review
          </button>
        </div>

      </div>

      {/* Add Test Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-neutral-900 dark:text-white">Log Mock Test</h3>
            <form onSubmit={handleAddTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" required value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Test Name (e.g. AITS-1)</label>
                <input type="text" required value={testName} onChange={e => setTestName(e.target.value)} className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Marks Scored</label>
                <input type="number" required value={totalMarks} onChange={e => setTotalMarks(e.target.value)} placeholder="e.g. 185" className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-emerald-600">Positive Marks</label>
                  <input type="number" value={positiveMarks} onChange={e => setPositiveMarks(e.target.value)} placeholder="e.g. 200" className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-red-500">Negative Marks</label>
                  <input type="number" value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} placeholder="e.g. 15" className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-medium">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weekly Review Modal */}
      {showWeeklyReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Sunday Weekly Review</h2>
              <p className="text-neutral-500 mt-2">Brutal honesty is the only way to improve.</p>
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
                  Your #1 reason for missing targets this week was: <strong>{weeklyStats.topReason}</strong>
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
