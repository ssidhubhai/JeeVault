import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { getAllQuestionsMetadata, getAllPdfSessions, PdfSession, getRecycleBin, syncMetadata, DailyPlan, getDailyPlan, saveDailyPlan } from '../lib/db';
import { ViewState, Subject } from '../App';
import { BookOpen, Layers, Calendar, Inbox, Timer, FileText, ArrowRight, BrainCircuit, Play, Clock, Target, ChevronLeft, Trash2, FlaskConical, Calculator, CheckCircle2, Circle, Pause, RotateCcw, Check, Edit2, Plus, Maximize2, Minimize2, Flame, Zap, Award, X, Activity, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';
import { JEE_SYLLABUS } from '../lib/constants';

const getTodayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

interface DashboardProps {
  onViewChange: (view: ViewState) => void;
  refreshTrigger: number;
  onSelectSubject: (subject: Subject | null) => void;
  onSelectChapter: (chapter: string | null) => void;
}

function SubjectCard({ name, icon: Icon, color, onClick }: { name: string, icon: any, color: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col gap-4"
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-xl font-bold text-neutral-900 dark:text-white">{name}</h4>
    </button>
  );
}

export function Dashboard({ onViewChange, refreshTrigger, onSelectSubject, onSelectChapter }: DashboardProps) {
  const [stats, setStats] = useState({
    total: 0,
    solved: 0,
    inbox: 0,
    reviseToday: 0,
    solvedToday: 0,
    recycleBin: 0
  });
  const [recentPdfs, setRecentPdfs] = useState<PdfSession[]>([]);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);

  // Timer states with persistency support
  const [timer, setTimer] = useState<{
    isRunning: boolean;
    mode: 'countdown' | 'countup';
    duration: number;
    elapsed: number;
    lastTimestamp: number;
  }>({
    isRunning: false,
    mode: 'countdown',
    duration: 1500,
    elapsed: 0,
    lastTimestamp: 0
  });

  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoalHours, setNewGoalHours] = useState('');
  const [showManualLog, setShowManualLog] = useState(false);
  const [manualMins, setManualMins] = useState('');
  const [customTimerMins, setCustomTimerMins] = useState('');
  const [isSettingCustomTimer, setIsSettingCustomTimer] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('jee_sound_enabled') !== 'false';
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('jee_sound_enabled', String(next));
      return next;
    });
  };

  // Persistency Helper: Load Timer State on Mount with Passive Gap Catchup!
  const loadTimerState = () => {
    const isRunning = localStorage.getItem('jee_timer_running') === 'true';
    const mode = (localStorage.getItem('jee_timer_mode') || 'countdown') as 'countdown' | 'countup';
    const duration = parseInt(localStorage.getItem('jee_timer_duration') || '1500', 10);
    const elapsed = parseInt(localStorage.getItem('jee_timer_elapsed') || '0', 10);
    const lastTimestamp = parseInt(localStorage.getItem('jee_timer_last_timestamp') || '0', 10);
    
    let adjustedElapsed = elapsed;
    if (isRunning && lastTimestamp > 0) {
      const passedSeconds = Math.floor((Date.now() - lastTimestamp) / 1000);
      if (passedSeconds > 0) {
        if (mode === 'countdown') {
          adjustedElapsed = Math.min(elapsed + passedSeconds, duration);
        } else {
          adjustedElapsed = elapsed + passedSeconds;
        }
      }
    }

    return {
      isRunning,
      mode,
      duration,
      elapsed: adjustedElapsed,
      lastTimestamp: isRunning ? Date.now() : lastTimestamp
    };
  };

  // Persistency Helper: Save state to localStorage
  const saveTimerState = (state: typeof timer) => {
    localStorage.setItem('jee_timer_running', String(state.isRunning));
    localStorage.setItem('jee_timer_mode', state.mode);
    localStorage.setItem('jee_timer_duration', String(state.duration));
    localStorage.setItem('jee_timer_elapsed', String(state.elapsed));
    localStorage.setItem('jee_timer_last_timestamp', String(state.lastTimestamp));
  };

  // Load timer on mount
  useEffect(() => {
    const saved = loadTimerState();
    setTimer(saved);
  }, []);

  // Save timer triggers
  useEffect(() => {
    saveTimerState(timer);
  }, [timer]);

  // Keyboard Escape listener for fullscreen exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenMode) {
        setIsFullscreenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenMode]);

  // Main real-time focus ticking loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (timer.isRunning) {
      intervalId = setInterval(() => {
        setTimer(prev => {
          if (!prev.isRunning) return prev;
          
          const now = Date.now();
          const pSeconds = Math.max(1, Math.floor((now - prev.lastTimestamp) / 1000));
          const nextElapsed = prev.elapsed + pSeconds;

          if (prev.mode === 'countdown' && nextElapsed >= prev.duration) {
            if (intervalId) clearInterval(intervalId);
            return {
              ...prev,
              isRunning: false,
              elapsed: prev.duration,
              lastTimestamp: now
            };
          }

          return {
            ...prev,
            elapsed: nextElapsed,
            lastTimestamp: now
          };
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timer.isRunning]);

  // Trigger tactile vibration and synthesizer double-beep
  const triggerAlarm = () => {
    // 1. Audio alert (sine double beep via Web Audio API)
    if (soundEnabled) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const playBeep = (freq: number, startTime: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, startTime);
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
          };
          // Elegant double high pitch beep
          playBeep(920, ctx.currentTime, 0.15);
          playBeep(920, ctx.currentTime + 0.25, 0.25);
        }
      } catch (err) {
        console.warn("Could not play synthesised beep notification:", err);
      }
    }

    // 2. Dual tactile pulse vibration (works on mobile/devices even if audio is muted or system is silent)
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  };

  // Helper to automatically log structured study focus duration data
  const autoLogFinishedSession = async (minutes: number) => {
    if (minutes <= 0) return;
    const addedHours = Number((minutes / 60).toFixed(2));
    try {
      const plan = await getDailyPlan('current') || { dateStr: 'current', tasks: [], locked: false };
      const currentHours = plan.hoursStudied || 0;
      const now = Date.now();
      const sessions = plan.focusSessions || [];
      const newSession = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(now),
        durationMins: minutes,
        timestamp: now
      };
      
      const updatedPlan = {
        ...plan,
        hoursStudied: Number((currentHours + addedHours).toFixed(2)),
        focusSessions: [...sessions, newSession]
      };
      
      await saveDailyPlan(updatedPlan);
      setTodayPlan(updatedPlan);
      
      // Clear active countdown back to standard state
      setTimer(prev => ({
        ...prev,
        isRunning: false,
        elapsed: 0,
        lastTimestamp: Date.now()
      }));

      toast.success(`Focus Session Complete! Logged ${minutes} mins (+${addedHours}h) of deep study! 🏆`, {
        id: 'auto-logged-session',
        duration: 6000
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to automatically save study session.");
    }
  };

  // Trigger alarms and automatic logging when countdown ends
  useEffect(() => {
    if (timer.isRunning && timer.mode === 'countdown' && timer.elapsed >= timer.duration && timer.duration > 0) {
      const finishedMinutes = Math.floor(timer.duration / 60);
      triggerAlarm();
      autoLogFinishedSession(finishedMinutes);
    }
  }, [timer.isRunning, timer.mode, timer.elapsed, timer.duration]);

  // Individual Focus log entry deletion handler
  const handleDeleteFocusSession = async (sessionId: string) => {
    try {
      const plan = await getDailyPlan('current');
      if (!plan || !plan.focusSessions) return;

      const toDelete = plan.focusSessions.find(s => s.id === sessionId);
      if (!toDelete) return;

      const updatedSessions = plan.focusSessions.filter(s => s.id !== sessionId);
      const reducedHours = Number((toDelete.durationMins / 60).toFixed(2));
      const updatedPlan = {
        ...plan,
        hoursStudied: Math.max(0, Number(((plan.hoursStudied || 0) - reducedHours).toFixed(2))),
        focusSessions: updatedSessions
      };

      await saveDailyPlan(updatedPlan);
      setTodayPlan(updatedPlan);
      toast.success("Focus session log removed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove focus session log.");
    }
  };

  // LOG Focus time to Database manually
  const handleLogFocusedTime = async (secondsForce?: number) => {
    const elapsedSeconds = secondsForce !== undefined ? secondsForce : timer.elapsed;
    if (elapsedSeconds < 5) {
      toast.error("Study session too short to log. Focus a bit longer! ⏳");
      return;
    }

    const minutes = Math.floor(elapsedSeconds / 60);
    const addedHours = Number((minutes / 60).toFixed(2));

    try {
      const plan = await getDailyPlan('current') || { dateStr: 'current', tasks: [], locked: false };
      const currentHours = plan.hoursStudied || 0;
      const now = Date.now();
      const sessions = plan.focusSessions || [];
      const newSession = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(now),
        durationMins: minutes,
        timestamp: now
      };

      const updatedPlan = {
        ...plan,
        hoursStudied: Number((currentHours + addedHours).toFixed(2)),
        focusSessions: [...sessions, newSession]
      };
      await saveDailyPlan(updatedPlan);
      setTodayPlan(updatedPlan);
      
      // Reset timer elapsed
      setTimer(prev => ({
        ...prev,
        isRunning: false,
        elapsed: 0,
        lastTimestamp: Date.now()
      }));

      toast.success(`Logged ${minutes} mins (${addedHours}h) of deep study! 🚀`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update daily study hours.");
    }
  };

  // Log manual study minutes
  const handleManualHoursLog = async () => {
    const mins = parseInt(manualMins, 10);
    if (isNaN(mins) || mins <= 0) {
      toast.error("Please enter a valid number of study minutes.");
      return;
    }
    const addedHours = Number((mins / 60).toFixed(2));
    try {
      const plan = await getDailyPlan('current') || { dateStr: 'current', tasks: [], locked: false };
      const currentHours = plan.hoursStudied || 0;
      const now = Date.now();
      const sessions = plan.focusSessions || [];
      const newSession = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(now),
        durationMins: mins,
        timestamp: now,
        isOffline: true
      };

      const updatedPlan = {
        ...plan,
        hoursStudied: Number((currentHours + addedHours).toFixed(2)),
        focusSessions: [...sessions, newSession]
      };
      await saveDailyPlan(updatedPlan);
      setTodayPlan(updatedPlan);
      setManualMins('');
      setShowManualLog(false);
      toast.success(`Added ${mins} minutes (${addedHours}h) to today's study progress! 📚`);
    } catch (err) {
      console.error(err);
      toast.error("Could not save manual entry.");
    }
  };

  // Update study goals
  const handleSaveGoal = async () => {
    const hours = parseFloat(newGoalHours);
    if (isNaN(hours) || hours <= 0) {
      toast.error("Please specify a valid daily study goal in hours.");
      return;
    }
    try {
      const plan = await getDailyPlan('current') || { dateStr: 'current', tasks: [], locked: false };
      const updatedPlan = {
        ...plan,
        studyGoalHours: hours
      };
      await saveDailyPlan(updatedPlan);
      setTodayPlan(updatedPlan);
      setIsEditingGoal(false);
      toast.success(`Today's focus goal updated to ${hours} hours! 🎯`);
    } catch (err) {
      console.error(err);
      toast.error("Could not save focus goal.");
    }
  };

  // Toggle active session start/pause
  const toggleFocusTimer = () => {
    setTimer(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
      lastTimestamp: Date.now()
    }));
  };

  // Reset focus session
  const resetFocusTimer = () => {
    setTimer(prev => ({
      ...prev,
      isRunning: false,
      elapsed: 0,
      lastTimestamp: Date.now()
    }));
  };

  // Preset Mode selection
  const handleSelectPreset = (mode: 'countdown' | 'countup', min?: number) => {
    setTimer({
      isRunning: false,
      mode,
      duration: min ? min * 60 : 0,
      elapsed: 0,
      lastTimestamp: Date.now()
    });
    // Turn off custom setter form when a regular preset or stopwatch is chosen
    setIsSettingCustomTimer(false);
  };

  // Set and apply custom countdown session (duration in minutes)
  const handleApplyCustomTimer = () => {
    const mins = parseInt(customTimerMins, 10);
    if (isNaN(mins) || mins <= 0 || mins > 1440) {
      toast.error("Please enter a valid study duration between 1 and 1440 minutes.");
      return;
    }
    setTimer({
      isRunning: false,
      mode: 'countdown',
      duration: mins * 60,
      elapsed: 0,
      lastTimestamp: Date.now()
    });
    setIsSettingCustomTimer(false);
    toast.success(`Custom timer set to ${mins} minutes! 🎯`);
  };

  // Formatter function representing remaining or elapsed time
  const getFormattedTime = () => {
    let secs = 0;
    if (timer.mode === 'countdown') {
      secs = Math.max(0, timer.duration - timer.elapsed);
    } else {
      secs = timer.elapsed;
    }

    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  };

  const DAILY_GOAL = 50;

  useEffect(() => {
    const loadData = async () => {
      const plan = await getDailyPlan('current');
      if (plan) {
        setTodayPlan(plan);
      } else {
        setTodayPlan({ dateStr: 'current', tasks: [], locked: false });
      }

      let allMetadata = await getAllQuestionsMetadata();
      
      // If cache is empty, try to sync
      if (allMetadata.length === 0) {
        await syncMetadata();
        allMetadata = await getAllQuestionsMetadata();
      }

      const now = Date.now();
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      
      let total = 0;
      let solved = 0;
      let inbox = 0;
      let reviseToday = 0;
      let solvedToday = 0;

      allMetadata.forEach(q => {
        if (q.isUncategorized) {
          inbox++;
        } else {
          total++;
          if (q.isSolved) {
            solved++;
            if (q.timestamp && q.timestamp >= startOfDay) {
              solvedToday++;
            }
          }
          if (q.nextReviewDate && q.nextReviewDate <= now && !q.isSolved) {
            reviseToday++;
          }
        }
      });

      const recycle = await getRecycleBin();

      setStats({ total, solved, inbox, reviseToday, solvedToday, recycleBin: recycle.length });

      const pdfs = await getAllPdfSessions();
      pdfs.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
      setRecentPdfs(pdfs.slice(0, 3)); // Show top 3
    };
    loadData();
  }, [refreshTrigger]);

  const toggleTask = async (taskId: string) => {
    if (!todayPlan || todayPlan.locked) return;
    const updatedTasks = todayPlan.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const updatedPlan = { ...todayPlan, tasks: updatedTasks };
    setTodayPlan(updatedPlan);
    await saveDailyPlan(updatedPlan);
  };

  const completedCount = todayPlan?.tasks.filter(t => t.completed).length || 0;
  const totalCount = todayPlan?.tasks.length || 0;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      {/* Immersive Pitch-Black Focus Grid Panel - ZEN MODE */}
      {isFullscreenMode && (
        <div className="fixed inset-0 bg-[#000000] z-[9999] flex flex-col justify-between p-6 select-none animate-fade-in text-white font-sans overflow-hidden">
          {/* Top minimal status bar */}
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto opacity-30 hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-mono text-neutral-400">Zen Focus Mode</span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Sound alarm quick toggle in Zen mode */}
              <button
                onClick={toggleSound}
                className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                title={soundEnabled ? "Mute beep alarm" : "Unmute beep alarm"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-neutral-500" />
                )}
                <span className="text-xs font-mono">{soundEnabled ? "Sound On" : "Muted"}</span>
              </button>

              <button 
                onClick={() => setIsFullscreenMode(false)}
                className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer"
                title="Exit Zen Mode"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Huge centered clock numerals with glowing ring */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="relative flex items-center justify-center w-[300px] h-[300px] md:w-[450px] md:h-[450px]">
              {/* Outer circle layout */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle 
                  cx="50%" 
                  cy="50%" 
                  r="45%" 
                  className="stroke-neutral-950 fill-none" 
                  strokeWidth="4" 
                />
                {timer.mode === 'countdown' && (
                  <circle 
                    cx="50%" 
                    cy="50%" 
                    r="45%" 
                    className="stroke-emerald-400 transition-all duration-300 ease-linear fill-none drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" 
                    strokeWidth="4" 
                    strokeDasharray={`${2 * Math.PI * (window.innerWidth < 768 ? 135 : 202.5)}`}
                    strokeDashoffset={`${2 * Math.PI * (window.innerWidth < 768 ? 135 : 202.5) * (1 - (timer.elapsed / timer.duration))}`}
                  />
                )}
                {timer.mode === 'countup' && timer.isRunning && (
                  <circle 
                    cx="50%" 
                    cy="50%" 
                    r="45%" 
                    className="stroke-blue-400 fill-none transition-all duration-300 ease-linear fill-none drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]" 
                    strokeWidth="4" 
                    strokeDashoffset={timer.elapsed % 100}
                  />
                )}
              </svg>

              {/* Digital numeric focus string */}
              <div className="flex flex-col items-center justify-center text-center z-10 px-4 font-mono">
                <span className="text-xs uppercase tracking-widest text-neutral-600 mb-2 font-sans font-bold">
                  {timer.mode === 'countdown' ? 'Remaining time' : 'Session duration'}
                </span>
                <span className="text-7xl md:text-9xl font-black tracking-tighter select-none filter drop-shadow-[0_4px_24px_rgba(52,211,153,0.4)] text-white">
                  {getFormattedTime()}
                </span>
                <span className="text-xs text-neutral-500 mt-2 font-medium font-sans">
                  {timer.isRunning ? 'Deep study session running...' : 'Session paused'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom float controls with lower opacity */}
          <div className="w-full max-w-md mx-auto opacity-20 hover:opacity-100 transition-opacity duration-300 bg-neutral-950/80 border border-neutral-900 p-4 rounded-2xl flex items-center justify-around drop-shadow-2xl">
            <button
              onClick={resetFocusTimer}
              className="p-3 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-xl transition-all cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={toggleFocusTimer}
              className={cn(
                "p-4 rounded-2xl text-black font-extrabold hover:scale-105 active:scale-95 transition-all text-center flex items-center gap-2 cursor-pointer",
                timer.isRunning ? "bg-amber-400 hover:bg-amber-500" : "bg-white hover:bg-neutral-100"
              )}
            >
              {timer.isRunning ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pause Zen</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Resume Zen</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleLogFocusedTime()}
              disabled={timer.elapsed < 5}
              className={cn(
                "p-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer",
                timer.elapsed >= 5 
                  ? "text-emerald-400 hover:text-emerald-300 hover:bg-neutral-900" 
                  : "text-neutral-600 cursor-not-allowed"
              )}
              title="Log focused study session"
            >
              <Check className="w-5 h-5" />
              <span className="text-xs font-bold font-mono">Submit</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
              Execution Zone
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              Focus on today's tasks and get things done.
            </p>
          </div>

          {/* Daily Plan Progress */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm min-w-[250px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                <Target className="w-4 h-4 text-emerald-500" />
                Today's Progress
              </div>
              <span className="text-xs font-medium text-neutral-500">{completedCount} / {totalCount} ({progressPercent}%)</span>
            </div>
            <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </header>

        {/* --- DYNAMIC COCKPIT BENTO ELEMENT: STUDY FOCUS TIMER & GOAL PROFILER --- */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Bento Panel: Today's study goal profile & tracking (Span 5) */}
          <div className="md:col-span-12 lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-6 relative overflow-hidden group">
            {/* Soft decorative visual background shape */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                    <Flame className="w-4 h-4 animate-bounce" />
                  </div>
                  <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">Daily Study Goal</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setNewGoalHours(String(todayPlan?.studyGoalHours || 4));
                      setIsEditingGoal(!isEditingGoal);
                    }}
                    className="p-1 px-2.5 text-xs text-neutral-500 hover:text-blue-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors font-semibold cursor-pointer border border-neutral-100 dark:border-neutral-800 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Goal</span>
                  </button>
                </div>
              </div>

              {isEditingGoal ? (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center gap-2 animate-fade-in animate-duration-150">
                  <input 
                    type="number" 
                    step="0.5"
                    min="0.5"
                    max="22"
                    value={newGoalHours}
                    onChange={(e) => setNewGoalHours(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 dark:text-white"
                    placeholder="E.g. 6.0 (hours)"
                  />
                  <button 
                    onClick={handleSaveGoal}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              ) : null}

              {/* Progress visual metrics */}
              <div className="flex items-center gap-6 py-2">
                {/* SVG circular goal progress ring */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle 
                      cx="55" 
                      cy="55" 
                      r="36" 
                      className="stroke-neutral-100 dark:stroke-neutral-800 fill-none" 
                      strokeWidth="6" 
                    />
                    <circle 
                      cx="55" 
                      cy="55" 
                      r="36" 
                      className="stroke-emerald-500 fill-none transition-all duration-500 ease-out" 
                      strokeWidth="6" 
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - Math.min(1, (todayPlan?.hoursStudied || 0) / (todayPlan?.studyGoalHours || 4)))}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-lg font-extrabold text-neutral-800 dark:text-neutral-100 font-mono tracking-tight">
                      {Math.round(((todayPlan?.hoursStudied || 0) / (todayPlan?.studyGoalHours || 4)) * 100)}%
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Goal</span>
                  </div>
                </div>

                <div className="space-y-1 flex-1 select-none">
                  <p className="text-2xl font-black text-neutral-900 dark:text-white font-mono tracking-tight">
                    {todayPlan?.hoursStudied || 0}h
                    <span className="text-neutral-400 text-sm font-medium"> / {todayPlan?.studyGoalHours || 4}h</span>
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-semibold">
                    {((todayPlan?.hoursStudied || 0) >= (todayPlan?.studyGoalHours || 4)) 
                      ? "Incredible work! Today's goal achieved! 🌟 Keyboard Warrior status!" 
                      : `Requires ${Number(((todayPlan?.studyGoalHours || 4) - (todayPlan?.hoursStudied || 0)).toFixed(2))}h focus study to milestone.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100 dark:border-neutral-800/80 pt-4 mt-2">
              {showManualLog ? (
                <div className="flex items-center gap-2 animate-fade-in bg-neutral-50 dark:bg-neutral-800/20 p-2 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="Mins (e.g. 45)"
                    value={manualMins}
                    onChange={(e) => setManualMins(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500 dark:text-white"
                  />
                  <button 
                    onClick={handleManualHoursLog}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                  <button 
                    onClick={() => setShowManualLog(false)}
                    className="p-1 px-2 text-neutral-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowManualLog(true)}
                  className="w-full py-2 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-dashed border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Log Offline Study Hours</span>
                </button>
              )}
            </div>

            {/* Completed Focus Sessions Log list */}
            {todayPlan?.focusSessions && todayPlan.focusSessions.length > 0 && (
              <div className="mt-4 border-t border-neutral-100 dark:border-neutral-800/80 pt-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Today's Focus Log ({todayPlan.focusSessions.length})</span>
                </h4>
                <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-neutral-100 dark:divide-neutral-800/40">
                  {todayPlan.focusSessions.slice().reverse().map((session) => {
                    const timeString = new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={session.id} className="flex items-center justify-between py-1.5 text-xs text-neutral-600 dark:text-neutral-400 group/item">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono bg-neutral-50 dark:bg-neutral-800/60 p-1 px-2 rounded-lg">
                            {session.durationMins}m
                          </span>
                          <span className="text-neutral-400 dark:text-neutral-500">at {timeString}</span>
                          {session.isOffline && (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 p-0.5 px-1 rounded uppercase tracking-wider">Offline</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteFocusSession(session.id)}
                          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-400 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100 cursor-pointer"
                          title="Delete study session log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bento Panel: Study Focus Session Countdown & Stopwatch (Span 7) */}
          <div className="md:col-span-12 lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            
            {/* Mode selection links */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center animate-pulse">
                  <Timer className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">Study Focus Session</h3>
              </div>
              
              {/* Presets Row */}
              <div className="flex flex-wrap items-center gap-1.5 bg-neutral-50 dark:bg-neutral-800/40 p-1 rounded-xl border border-neutral-100 dark:border-neutral-800 shrink-0">
                <button 
                  onClick={() => handleSelectPreset('countdown', 25)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer",
                    timer.mode === 'countdown' && timer.duration === 1500 
                      ? "bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm border border-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  25m
                </button>
                <button 
                  onClick={() => handleSelectPreset('countdown', 45)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer",
                    timer.mode === 'countdown' && timer.duration === 2700 
                      ? "bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm border border-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  45m
                </button>
                <button 
                  onClick={() => handleSelectPreset('countdown', 60)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer",
                    timer.mode === 'countdown' && timer.duration === 3600 
                      ? "bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm border border-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  60m
                </button>
                <button 
                  onClick={() => handleSelectPreset('countup')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer",
                    timer.mode === 'countup' 
                      ? "bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-neutral-100" 
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                  title="Count-Up Stopwatch Mode"
                >
                  Stopwatch
                </button>
                <button 
                  onClick={() => setIsSettingCustomTimer(!isSettingCustomTimer)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer",
                    isSettingCustomTimer 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                  title="Configure Custom Countdown Duration"
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Custom countdown time config container */}
            {isSettingCustomTimer && (
              <div className="flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-950/30 rounded-2xl animate-fade-in">
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">Set Duration:</span>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="Mins (e.g. 50)"
                    value={customTimerMins}
                    onChange={(e) => setCustomTimerMins(e.target.value)}
                    className="w-full max-w-[120px] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3 py-1 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500 dark:text-white"
                  />
                  <span className="text-xs text-neutral-400 font-medium">min</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleApplyCustomTimer}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply</span>
                  </button>
                  <button
                    onClick={() => setIsSettingCustomTimer(false)}
                    className="p-1 px-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg transition-colors cursor-pointer text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Huge numeric display ticking center */}
            <div className="flex items-center justify-between gap-6 py-1 select-none">
              <div className="space-y-1">
                <p className="text-4xl md:text-5xl font-extrabold text-neutral-800 dark:text-white font-mono tracking-tighter flex items-center gap-1.5">
                  <span>{getFormattedTime()}</span>
                  <span className={cn(
                    "inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0",
                    timer.isRunning ? "animate-ping" : "opacity-40"
                  )} />
                </p>
                <p className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {timer.mode === 'countdown' ? 'Pomodoro Countdown Focus' : 'Continuous Stopwatch Focus'}
                  </span>
                </p>
              </div>

              {/* Fullscreen Immerse button */}
              <div className="flex items-center gap-1.5">
                {/* Alarm/Audio indicator toggle button */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className="p-2.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  title={soundEnabled ? "Mute beep alarm on finish" : "Unmute beep alarm on finish"}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => setIsFullscreenMode(true)}
                  className="p-2.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  title="Go Immersive Full Black Screen Mode"
                >
                  <Maximize2 className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  <span className="hidden sm:inline">Zen Mode 🧘</span>
                </button>
              </div>
            </div>

            {/* Quick Timer control tray */}
            <div className="flex items-center gap-2 border-t border-neutral-100 dark:border-neutral-800/80 pt-4">
              <button
                onClick={toggleFocusTimer}
                className={cn(
                  "flex-1 py-2 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all text-sm shadow-sm cursor-pointer active:scale-98",
                  timer.isRunning 
                    ? "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30" 
                    : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/10"
                )}
              >
                {timer.isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>

              <button
                onClick={resetFocusTimer}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-2xl transition-colors border border-neutral-100 dark:border-neutral-800 cursor-pointer shadow-sm"
                title="Reset active elapsed session timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleLogFocusedTime()}
                disabled={timer.elapsed < 5}
                className={cn(
                  "p-2 px-3 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer",
                  timer.elapsed >= 5
                    ? "bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 active:scale-98"
                    : "bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                )}
                title="Log this session towards daily goal"
              >
                <Check className="w-4 h-4" />
                <span>Submit</span>
              </button>
            </div>
          </div>

        </div>

        {/* Today's Targets */}
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            Today's Targets
          </h2>
          {totalCount === 0 ? (
            <p className="text-neutral-500 dark:text-neutral-400 italic py-4">No targets planned for today. Go to the Daily Planner to set some.</p>
          ) : (
            <div className="space-y-3">
              {todayPlan?.tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="w-full flex items-center justify-between p-3 text-left rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 flex-1 overflow-hidden pr-4">
                    <div className="shrink-0" onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}>
                      {task.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 cursor-pointer" />
                      ) : (
                        <Circle className="w-6 h-6 text-neutral-300 dark:text-neutral-600 group-hover:text-blue-500 transition-colors cursor-pointer" />
                      )}
                    </div>
                    <span 
                      className={cn(
                        "text-base md:text-lg font-medium transition-all duration-200 truncate",
                        task.completed 
                          ? "text-neutral-400 line-through" 
                          : "text-neutral-700 dark:text-neutral-300"
                      )}
                      onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                    >
                      {task.text}
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); alert('Mock: Opening resource for this task...'); }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-semibold rounded-lg hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subject / Chapter Navigation */}
        <div>
          {!activeSubject ? (
            <>
              <h3 className="text-lg font-bold mb-4 text-neutral-900 dark:text-white">Subjects</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SubjectCard 
                  name="Physics" 
                  icon={BookOpen} 
                  color="bg-blue-500" 
                  onClick={() => setActiveSubject('Physics')} 
                />
                
                {/* Chemistry Group */}
                <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white bg-emerald-500">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-neutral-900 dark:text-white">Chemistry</h4>
                  <div className="flex flex-col gap-2">
                    {['Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry'].map(sub => (
                      <button
                        key={sub}
                        onClick={() => setActiveSubject(sub as Subject)}
                        className="text-left text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-blue-500 transition-colors py-1 flex items-center justify-between group"
                      >
                        {sub}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>

                <SubjectCard 
                  name="Mathematics" 
                  icon={Calculator} 
                  color="bg-rose-500" 
                  onClick={() => setActiveSubject('Mathematics')} 
                />
              </div>
            </>
          ) : !activeClass ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => setActiveSubject(null)}
                  className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </button>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{activeSubject}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['Class 11', 'Class 12'].map(className => (
                  <button
                    key={className}
                    onClick={() => setActiveClass(className)}
                    className="p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all text-center"
                  >
                    <h4 className="text-2xl font-bold text-neutral-900 dark:text-white">{className}</h4>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => setActiveClass(null)}
                  className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </button>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{activeSubject} - {activeClass}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {JEE_SYLLABUS[activeSubject][activeClass as 'Class 11' | 'Class 12'].map(chapter => (
                  <button
                    key={chapter}
                    onClick={() => {
                      onSelectSubject(activeSubject);
                      onSelectChapter(chapter);
                      onViewChange('vault');
                    }}
                    className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    {chapter}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tools Grid */}
        <div>
          <h3 className="text-lg font-bold mb-4 text-neutral-900 dark:text-white">All Tools</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => onViewChange('vault')} className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-blue-500 transition-colors text-left group">
              <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><BookOpen className="w-5 h-5" /></div>
              <div><h4 className="font-bold text-sm">Vault</h4><p className="text-xs text-neutral-500">{stats.total} saved</p></div>
            </button>
            <button onClick={() => onViewChange('recycle-bin' as ViewState)} className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-red-500 transition-colors text-left group">
              <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg group-hover:bg-red-50 group-hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></div>
              <div><h4 className="font-bold text-sm">Recycle Bin</h4><p className="text-xs text-neutral-500">{stats.recycleBin} items</p></div>
            </button>
            <button onClick={() => onViewChange('flashcards')} className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-emerald-500 transition-colors text-left group">
              <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors"><Layers className="w-5 h-5" /></div>
              <div><h4 className="font-bold text-sm">Flashcards</h4><p className="text-xs text-neutral-500">Quick review</p></div>
            </button>
            <button onClick={() => onViewChange('pdf')} className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-indigo-500 transition-colors text-left group">
              <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><FileText className="w-5 h-5" /></div>
              <div><h4 className="font-bold text-sm">PDF Reader</h4><p className="text-xs text-neutral-500">Focus mode</p></div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
