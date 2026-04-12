import React, { useEffect, useState } from 'react';
import { getAllQuestionsMetadata, getAllPdfSessions, PdfSession, getRecycleBin, syncMetadata } from '../lib/db';
import { ViewState, Subject } from '../App';
import { BookOpen, Layers, Calendar, Inbox, Timer, FileText, ArrowRight, BrainCircuit, Play, Clock, Target, ChevronLeft, Trash2, FlaskConical, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import { JEE_SYLLABUS } from '../lib/constants';

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

  const DAILY_GOAL = 50;

  useEffect(() => {
    const loadData = async () => {
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

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
              Welcome back
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              You have <strong className="text-neutral-900 dark:text-white">{stats.reviseToday}</strong> questions to revise and <strong className="text-neutral-900 dark:text-white">{stats.inbox}</strong> in your inbox.
            </p>
          </div>

          {/* Daily Goal Progress */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm min-w-[250px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300">
                <Target className="w-4 h-4 text-blue-500" />
                Daily Goal
              </div>
              <span className="text-xs font-medium text-neutral-500">{stats.solvedToday} / {DAILY_GOAL}</span>
            </div>
            <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.min((stats.solvedToday / DAILY_GOAL) * 100, 100)}%` }}
              />
            </div>
          </div>
        </header>

        {/* Active Launchpad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onViewChange('revise')}
            className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-2xl text-left text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform">
              <Calendar className="w-24 h-24" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Start Revision</h3>
            <p className="text-amber-100 mb-6 max-w-[80%]">Knock out your {stats.reviseToday} due questions using spaced repetition.</p>
            <div className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-medium backdrop-blur-sm transition-colors">
              <Play className="w-4 h-4" /> Begin Session
            </div>
          </button>

          <button
            onClick={() => onViewChange('inbox')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 p-6 rounded-2xl text-left text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform">
              <Inbox className="w-24 h-24" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Clear Inbox</h3>
            <p className="text-purple-100 mb-6 max-w-[80%]">Categorize your {stats.inbox} recently saved screenshots.</p>
            <div className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-medium backdrop-blur-sm transition-colors">
              <ArrowRight className="w-4 h-4" /> Process Inbox
            </div>
          </button>
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
