import React, { useState, useEffect } from 'react';
import { DailyPlan, DailyTask, getDailyPlan, saveDailyPlan, getAllDailyPlans } from '../lib/db';
import { Calendar as CalendarIcon, CheckCircle2, Circle, Clock, Save, Target, X, ChevronRight, XCircle, Trash2, Bell, AlertCircle, Repeat, GripVertical, Lock, Unlock } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const getTodayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export function Planner() {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [tomorrowPlan, setTomorrowPlan] = useState<DailyPlan | null>(null);
  const [notes, setNotes] = useState('');
  const [newTodayTaskText, setNewTodayTaskText] = useState('');
  const [newTodayTaskTime, setNewTodayTaskTime] = useState('');
  const [newTodayTaskRecurrence, setNewTodayTaskRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  
  const [notifiedTasks, setNotifiedTasks] = useState<Set<string>>(new Set());
  
  // Wrap up modal state
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [hoursStudied, setHoursStudied] = useState(0);
  const [missedTasks, setMissedTasks] = useState<{ id: string, reason: string, customReason: string }[]>([]);
  const [wrapUpDateStr, setWrapUpDateStr] = useState(getTodayStr());

  const REASONS = [
    "Underestimated time",
    "Procrastination",
    "Unexpected personal event",
    "Difficult Concept",
    "Other"
  ];

  const checkOverdue = (time?: string) => {
    if (!time) return false;
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    return time < `${currentHours}:${currentMinutes}`;
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const interval = setInterval(() => {
      if (!todayPlan || todayPlan.locked) return;
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      todayPlan.tasks.forEach(task => {
        if (!task.completed && task.reminderTime === timeStr && !notifiedTasks.has(task.id)) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Task Reminder', { body: task.text });
          } else toast.success('Reminder: ' + task.text, { icon: '🔔' });
          setNotifiedTasks(prev => new Set(prev).add(task.id));
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [todayPlan, notifiedTasks]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const all = await getAllDailyPlans();
    // History plans are those that aren't 'current' or 'tomorrow'
    const historyPlans = all.filter(p => p.dateStr !== 'current' && p.dateStr !== 'tomorrow');
    setPlans(historyPlans.sort((a, b) => b.dateStr.localeCompare(a.dateStr))); // newest first
    
    let today = all.find(p => p.dateStr === 'current');
    if (!today) {
      // If we don't have a current plan, maybe see if there's an unlocked plan for the actual today string? (to be foolproof)
      const realToday = historyPlans.find(p => p.dateStr === getTodayStr());
      if (realToday && !realToday.locked) {
        today = { ...realToday, dateStr: 'current' };
      } else {
        today = { dateStr: 'current', tasks: [], locked: false };
      }
    }
    setTodayPlan(today);
    setNotes(today.notes || '');
    
    const tomorrow = all.find(p => p.dateStr === 'tomorrow');
    if (tomorrow) {
      setTomorrowPlan(tomorrow);
    } else {
      setTomorrowPlan({ dateStr: 'tomorrow', tasks: [], locked: false });
    }
  };

  const handleNotesChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    if (todayPlan && !todayPlan.locked) {
      const updated = { ...todayPlan, notes: e.target.value };
      setTodayPlan(updated);
      await saveDailyPlan(updated);
    }
  };

  const handleAddTodayTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodayTaskText.trim() || !todayPlan || todayPlan.locked) return;
    
    const newTask: DailyTask = {
      id: crypto.randomUUID(),
      text: newTodayTaskText.trim(),
      completed: false,
      reminderTime: newTodayTaskTime || undefined,
      recurrence: newTodayTaskRecurrence
    };
    
    const updated = {
      ...todayPlan,
      tasks: [...todayPlan.tasks, newTask]
    };
    
    setTodayPlan(updated);
    await saveDailyPlan(updated);
    setNewTodayTaskText('');
    setNewTodayTaskTime('');
    setNewTodayTaskRecurrence('none');
  };

  const handleRemoveTodayTask = async (taskId: string) => {
    if (!todayPlan || todayPlan.locked) return;
    const updated = {
      ...todayPlan,
      tasks: todayPlan.tasks.filter(t => t.id !== taskId)
    };
    setTodayPlan(updated);
    await saveDailyPlan(updated);
  };

  const handleAddTomorrowTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !tomorrowPlan) return;
    
    const newTask: DailyTask = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      completed: false,
      reminderTime: newTaskTime || undefined,
      recurrence: newTaskRecurrence
    };
    
    const updated = {
      ...tomorrowPlan,
      tasks: [...tomorrowPlan.tasks, newTask]
    };
    
    setTomorrowPlan(updated);
    await saveDailyPlan(updated);
    setNewTaskText('');
    setNewTaskTime('');
    setNewTaskRecurrence('none');
  };

  const handleRemoveTomorrowTask = async (taskId: string) => {
    if (!tomorrowPlan) return;
    const updated = {
      ...tomorrowPlan,
      tasks: tomorrowPlan.tasks.filter(t => t.id !== taskId)
    };
    setTomorrowPlan(updated);
    await saveDailyPlan(updated);
  };

  const startWrapUp = () => {
    if (!todayPlan) return;
    const unfinished = todayPlan.tasks.filter(t => !t.completed);
    setMissedTasks(unfinished.map(t => ({ id: t.id, reason: REASONS[0], customReason: '' })));
    
    const now = new Date();
    // Default to yesterday if it's before noon
    if (now.getHours() < 12) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setMinutes(yesterday.getMinutes() - yesterday.getTimezoneOffset());
      setWrapUpDateStr(yesterday.toISOString().split('T')[0]);
    } else {
      setWrapUpDateStr(getTodayStr());
    }

    setShowWrapUp(true);
  };

  const confirmWrapUp = async () => {
    if (!todayPlan) return;
    
    // Update the missed tasks with their reasons
    const updatedTasks = todayPlan.tasks.map(t => {
      if (!t.completed) {
        const missedInfo = missedTasks.find(m => m.id === t.id);
        if (missedInfo) {
          return { 
            ...t, 
            missedReason: missedInfo.reason,
            missedNotes: missedInfo.reason === 'Other' ? missedInfo.customReason : undefined
          };
        }
      }
      return t;
    });

    // 1. Archive today's plan into the history using real date
    const historyPlan: DailyPlan = {
      ...todayPlan,
      dateStr: wrapUpDateStr, // assign selected date
      tasks: updatedTasks,
      hoursStudied,
      studyGoalHours: todayPlan.studyGoalHours,
      locked: true,
      notes
    };
    await saveDailyPlan(historyPlan);

    // 2. Move "tomorrow" to "today" ('current') and append recurring
    const nextTodayTasks = tomorrowPlan ? [...tomorrowPlan.tasks] : [];
    const recurringTasks = todayPlan.tasks
      .filter(t => t.recurrence && t.recurrence !== 'none')
      .map(t => ({ ...t, id: crypto.randomUUID(), completed: false }));
    const combinedTasks = [...nextTodayTasks, ...recurringTasks];

    const newTodayPlan: DailyPlan = {
      dateStr: 'current',
      tasks: combinedTasks,
      locked: false,
      notes: ''
    };
    await saveDailyPlan(newTodayPlan);

    // 3. Wipe "tomorrow" ('tomorrow')
    const newTomorrowPlan: DailyPlan = {
      dateStr: 'tomorrow',
      tasks: [],
      locked: false
    };
    await saveDailyPlan(newTomorrowPlan);

    toast.success("Day wrapped up! Tomorrow's tasks moved to Today.");
    setShowWrapUp(false);
    loadData();
  };

  // Generate calendar grid for current month
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });

  const [showHistoryModal, setShowHistoryModal] = useState<DailyPlan | null>(null);

  const getDayColor = (dateStr: string) => {
    if (dateStr === getTodayStr() && todayPlan && !todayPlan.locked) return 'ring-2 ring-blue-500 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white';
    
    const plan = plans.find(p => p.dateStr === dateStr);
    if (!plan || !plan.locked) {
      if (new Date(dateStr) < new Date(getTodayStr())) return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400';
      return 'bg-white dark:bg-neutral-900 text-neutral-500';
    }
    
    const total = plan.tasks.length;
    const completed = plan.tasks.filter(t => t.completed).length;
    
    if (total === 0 || plan.hoursStudied === 0) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold';
    if (completed === total) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold';
    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold';
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    
    if (source.droppableId === 'today' && destination.droppableId === 'today' && todayPlan && !todayPlan.locked) {
      const items = Array.from(todayPlan.tasks);
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      const updated = { ...todayPlan, tasks: items };
      setTodayPlan(updated);
      await saveDailyPlan(updated);
    } else if (source.droppableId === 'tomorrow' && destination.droppableId === 'tomorrow' && tomorrowPlan) {
      const items = Array.from(tomorrowPlan.tasks);
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      const updated = { ...tomorrowPlan, tasks: items };
      setTomorrowPlan(updated);
      await saveDailyPlan(updated);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="max-w-6xl mx-auto">
        <header className="mb-6 md:mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
            Control Room
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">Plan your targets, log your notes, and wrap up your day.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left Section: History Calendar */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col min-h-[400px]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
              History
            </h2>
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-medium text-neutral-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map(d => {
                const dayNum = parseInt(d.split('-')[2]);
                return (
                  <button
                    key={d}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-sm transition-all hover:scale-105",
                      getDayColor(d)
                    )}
                    onClick={() => {
                      const plan = plans.find(p => p.dateStr === d);
                      if (plan && plan.locked) {
                        setShowHistoryModal(plan);
                      }
                    }}
                  >
                    {dayNum}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Center Section: Today's Status & Notes */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                <Target className="w-5 h-5 text-emerald-500" />
                Today's Status
              </h2>
              {todayPlan && (
                <button
                  onClick={async () => {
                    const updated = { ...todayPlan, locked: !todayPlan.locked };
                    setTodayPlan(updated);
                    await saveDailyPlan(updated);
                  }}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title={todayPlan.locked ? "Unlock Day" : "Lock Day"}
                >
                  {todayPlan.locked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Targets</h3>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span>Goal:</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      disabled={todayPlan?.locked}
                      value={todayPlan?.studyGoalHours || ''}
                      onChange={async (e) => {
                        if (!todayPlan) return;
                        const val = parseFloat(e.target.value);
                        const updated = { ...todayPlan, studyGoalHours: isNaN(val) ? undefined : val };
                        setTodayPlan(updated);
                        await saveDailyPlan(updated);
                      }}
                      className="w-16 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-center focus:outline-none"
                      placeholder="hrs"
                    />
                  </div>
                </div>
                
                {!todayPlan?.locked && (
                  <form onSubmit={handleAddTodayTask} className="flex flex-col gap-2 mb-3 p-3 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTodayTaskText}
                        onChange={e => setNewTodayTaskText(e.target.value)}
                        placeholder="Add an urgent task..."
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                      <button 
                        type="submit"
                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 font-bold rounded-lg text-sm transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="flex items-center gap-1.5 text-neutral-500 bg-white dark:bg-neutral-900 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700">
                        <Clock className="w-3.5 h-3.5" />
                        <input
                          type="time"
                          value={newTodayTaskTime}
                          onChange={e => setNewTodayTaskTime(e.target.value)}
                          className="bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-500 bg-white dark:bg-neutral-900 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700">
                        <Repeat className="w-3.5 h-3.5" />
                        <select
                          value={newTodayTaskRecurrence}
                          onChange={e => setNewTodayTaskRecurrence(e.target.value as any)}
                          className="bg-transparent focus:outline-none appearance-none"
                        >
                          <option value="none">Once</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                  </form>
                )}

                {todayPlan?.tasks.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic">No targets set for today. Add some above!</p>
                ) : (
                  <Droppable droppableId="today">
                    {(provided) => (
                      <div className="space-y-2" {...provided.droppableProps} ref={provided.innerRef}>
                        {todayPlan?.tasks.map((t, index) => {
                          // @ts-ignore
                          return (<Draggable key={t.id} draggableId={t.id} index={index} isDragDisabled={todayPlan.locked}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "flex items-start justify-between gap-2 p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 group transition-colors",
                                  !t.completed && checkOverdue(t.reminderTime) && "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10"
                                )}
                              >
                                <div className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                  <div {...provided.dragHandleProps} className="text-neutral-400 mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <button onClick={async () => {
                                    if (todayPlan.locked) return;
                                    const updated = { ...todayPlan, tasks: todayPlan.tasks.map(task => task.id === t.id ? {...task, completed: !task.completed} : task) };
                                    setTodayPlan(updated);
                                    await saveDailyPlan(updated);
                                  }} className="mt-0.5">
                                    {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />}
                                  </button>
                                  <div className="flex flex-col">
                                    <span className={cn(t.completed && "line-through text-neutral-400")}>{t.text}</span>
                                    <div className="flex items-center gap-3 mt-1">
                                      {t.reminderTime && (
                                        <span className={cn("text-xs flex items-center gap-1", (!t.completed && checkOverdue(t.reminderTime)) ? "text-red-500 font-medium" : "text-neutral-400")}>
                                          <Clock className="w-3 h-3" /> {t.reminderTime}
                                          {(!t.completed && checkOverdue(t.reminderTime)) && <AlertCircle className="w-3 h-3" />}
                                        </span>
                                      )}
                                      {t.recurrence && t.recurrence !== 'none' && (
                                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                                          <Repeat className="w-3 h-3" /> {t.recurrence}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {!todayPlan?.locked && (
                                  <button
                                    onClick={() => handleRemoveTodayTask(t.id)}
                                    className="opacity-0 lg:group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all p-1 rounded md:opacity-100 shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </Draggable>);
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-2">Daily Notes</h3>
                <textarea
                  value={notes}
                  onChange={handleNotesChange}
                  disabled={todayPlan?.locked}
                  placeholder="Jot down quick thoughts during the day..."
                  className="w-full h-32 p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={startWrapUp}
              disabled={todayPlan?.locked}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {todayPlan?.locked ? "Day Locked" : "End Day Wrap-Up"}
            </button>
          </div>

          {/* Right Section: Plan Tomorrow */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col min-h-[400px]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
              <ChevronRight className="w-5 h-5 text-purple-500" />
              Plan Tomorrow
            </h2>
            
            <form onSubmit={handleAddTomorrowTask} className="flex flex-col gap-2 mb-4 p-3 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  placeholder="What to do tomorrow?"
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
                <button 
                  type="submit"
                  className="px-4 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 font-bold rounded-lg transition-colors text-sm"
                >
                  Add
                </button>
              </div>
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-500 bg-white dark:bg-neutral-900 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700">
                  <Clock className="w-3.5 h-3.5" />
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={e => setNewTaskTime(e.target.value)}
                    className="bg-transparent focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-neutral-500 bg-white dark:bg-neutral-900 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700">
                  <Repeat className="w-3.5 h-3.5" />
                  <select
                    value={newTaskRecurrence}
                    onChange={e => setNewTaskRecurrence(e.target.value as any)}
                    className="bg-transparent focus:outline-none appearance-none"
                  >
                    <option value="none">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2">
              {tomorrowPlan?.tasks.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-sm">
                  Tomorrow's canvas is blank.
                </div>
              ) : (
                <Droppable droppableId="tomorrow">
                  {(provided) => (
                    <div className="space-y-2" {...provided.droppableProps} ref={provided.innerRef}>
                      {tomorrowPlan?.tasks.map((t, index) => {
                        // @ts-ignore
                        return (<Draggable key={t.id} draggableId={t.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="flex items-start justify-between gap-2 p-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg group transition-colors hover:border-neutral-300 dark:hover:border-neutral-700"
                            >
                              <div className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                <div {...provided.dragHandleProps} className="text-neutral-400 mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col mt-0.5">
                                  <span>{t.text}</span>
                                  <div className="flex items-center gap-3 mt-1">
                                    {t.reminderTime && (
                                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {t.reminderTime}
                                      </span>
                                    )}
                                    {t.recurrence && t.recurrence !== 'none' && (
                                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                                        <Repeat className="w-3 h-3" /> {t.recurrence}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveTomorrowTask(t.id)}
                                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all p-1 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </Draggable>);
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          </div>
        </div>
        </div>
      </DragDropContext>

      {/* End Day Wrap-Up Modal */}
      {showWrapUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-xl text-neutral-900 dark:text-white">End Day Wrap-Up</h3>
              <button onClick={() => setShowWrapUp(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                  Date
                </label>
                <input 
                  type="date" 
                  value={wrapUpDateStr}
                  onChange={(e) => setWrapUpDateStr(e.target.value)}
                  className="w-full p-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                  Approximate hours studied today {todayPlan?.studyGoalHours ? `(Goal: ${todayPlan.studyGoalHours}h)` : ''}
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" max="16" step="0.5"
                    value={hoursStudied}
                    onChange={(e) => setHoursStudied(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <div className="w-16 text-center font-bold text-xl text-blue-600 dark:text-blue-400">
                    {hoursStudied}h
                  </div>
                </div>
              </div>

              {missedTasks.length > 0 && (
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-3 text-red-500">Unfinished Targets Accountability</h4>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">You left some tasks unchecked. Please log the reason why.</p>
                  
                  <div className="space-y-4">
                    {missedTasks.map((mt, idx) => {
                      const task = todayPlan?.tasks.find(t => t.id === mt.id);
                      return (
                        <div key={mt.id} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                            {task?.text}
                          </p>
                          <select
                            value={mt.reason}
                            onChange={(e) => {
                              const newMissed = [...missedTasks];
                              newMissed[idx].reason = e.target.value;
                              setMissedTasks(newMissed);
                            }}
                            className="w-full p-2 text-sm bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:ring-2 focus:ring-red-500 mb-2"
                          >
                            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          
                          {mt.reason === 'Other' && (
                            <input
                              type="text"
                              placeholder="Specify reason..."
                              value={mt.customReason}
                              onChange={(e) => {
                                const newMissed = [...missedTasks];
                                newMissed[idx].customReason = e.target.value;
                                setMissedTasks(newMissed);
                              }}
                              className="w-full p-2 text-sm bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:ring-2 focus:ring-red-500"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-neutral-950">
              <button 
                onClick={() => setShowWrapUp(false)}
                className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmWrapUp}
                disabled={missedTasks.some(mt => mt.reason === 'Other' && !mt.customReason.trim())}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-xl text-neutral-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" />
                {showHistoryModal.dateStr}
              </h3>
              <button onClick={() => setShowHistoryModal(null)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div>
                  <p className="text-sm text-neutral-500">Tasks Completed</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {showHistoryModal.tasks.filter(t => t.completed).length} <span className="text-sm text-neutral-400 font-medium">/ {showHistoryModal.tasks.length}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500">Study Time</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {showHistoryModal.hoursStudied || 0}h
                    {showHistoryModal.studyGoalHours ? <span className="text-sm text-neutral-400 font-medium"> / {showHistoryModal.studyGoalHours}h</span> : null}
                  </p>
                </div>
              </div>

              {showHistoryModal.tasks.length > 0 && (
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-3 text-sm uppercase tracking-wider">Targets</h4>
                  <div className="space-y-3">
                    {showHistoryModal.tasks.map(t => (
                      <div key={t.id} className="text-sm">
                        <div className="flex gap-2 text-neutral-700 dark:text-neutral-300">
                          {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                          <span className={cn(t.completed && "text-neutral-400 line-through")}>{t.text}</span>
                        </div>
                        {!t.completed && t.missedReason && (
                          <div className="ml-6 mt-1 text-xs text-red-600 dark:text-red-400">
                            Reason: {t.missedReason === 'Other' ? t.missedNotes : t.missedReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showHistoryModal.notes && (
                <div>
                  <h4 className="font-bold text-neutral-900 dark:text-white mb-2 text-sm uppercase tracking-wider">Notes</h4>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    {showHistoryModal.notes}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
