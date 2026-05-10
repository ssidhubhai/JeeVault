import React, { useEffect, useState } from 'react';
import { BookOpen, FlaskConical, Calculator, ChevronRight, ChevronDown, Layers, Calendar, Inbox as InboxIcon, Timer, HardDrive, Trash2, Activity, Settings, PanelLeftClose, AlertOctagon, BarChart2 } from 'lucide-react';
import { Subject, ViewState } from '../App';
import { getAllQuestionsMetadata, getRecycleBin, syncMetadata } from '../lib/db';
import { cn } from '../lib/utils';
import { JEE_SYLLABUS } from '../lib/constants';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  selectedSubject: Subject | null;
  selectedChapter: string | null;
  onSelectSubject: (subject: Subject) => void;
  onSelectChapter: (chapter: string) => void;
  refreshTrigger: number;
  onCloseDesktop?: () => void;
}

const SUBJECTS: { name: Subject; icon: React.ElementType; color: string; category?: string }[] = [
  { name: 'Physics', icon: BookOpen, color: 'text-blue-500' },
  { name: 'Physical Chemistry', icon: FlaskConical, color: 'text-emerald-500', category: 'Chemistry' },
  { name: 'Inorganic Chemistry', icon: FlaskConical, color: 'text-emerald-500', category: 'Chemistry' },
  { name: 'Organic Chemistry', icon: FlaskConical, color: 'text-emerald-500', category: 'Chemistry' },
  { name: 'Mathematics', icon: Calculator, color: 'text-rose-500' },
];

interface SubjectSectionProps {
  name: Subject;
  icon: any;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  expandedClasses: Set<string>;
  toggleClass: (subject: Subject, className: string) => void;
  chapterCounts: Record<string, { total: number, unsolved: number }>;
  currentView: ViewState;
  selectedSubject: Subject | null;
  selectedChapter: string | null;
  onSelectSubject: (subject: Subject) => void;
  onSelectChapter: (chapter: string) => void;
  onViewChange: (view: ViewState) => void;
  compact?: boolean;
}

const SidebarSubjectSection: React.FC<SubjectSectionProps> = ({ 
  name, icon: Icon, color, isExpanded, onToggle, expandedClasses, toggleClass, 
  chapterCounts, currentView, selectedSubject, selectedChapter, 
  onSelectSubject, onSelectChapter, onViewChange, compact 
}) => {
  const classData = JEE_SYLLABUS[name];

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors",
          compact ? "text-xs font-medium" : "text-sm font-medium"
        )}
      >
        <div className="flex items-center gap-2">
          {!compact && <Icon className={cn("w-4 h-4", color)} />}
          <span>{name}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        )}
      </button>

      {isExpanded && (
        <div className={cn("space-y-1", compact ? "pl-2" : "pl-4")}>
          {Object.entries(classData).map(([className, chapters]) => {
            const isClassExpanded = expandedClasses.has(`${name}-${className}`);
            return (
              <div key={className} className="space-y-0.5">
                <button
                  onClick={() => toggleClass(name, className)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                >
                  {className}
                  {isClassExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                
                {isClassExpanded && (
                  <div className="pl-2 space-y-0.5">
                    {chapters.map(chapter => {
                      const counts = chapterCounts[chapter] || { total: 0, unsolved: 0 };
                      const isSelected = currentView === 'vault' && selectedSubject === name && selectedChapter === chapter;
                      
                      return (
                        <button
                          key={chapter}
                          onClick={() => {
                            onSelectSubject(name);
                            onSelectChapter(chapter);
                            onViewChange('vault');
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors flex items-center justify-between group",
                            isSelected
                              ? "bg-neutral-100 dark:bg-neutral-800 font-medium text-neutral-900 dark:text-white"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-white"
                          )}
                        >
                          <span className="truncate pr-2 text-[11px]" title={chapter}>{chapter}</span>
                          {counts.total > 0 && (
                            <span className={cn(
                              "text-[9px] px-1 py-0.5 rounded-full font-medium shrink-0",
                              counts.unsolved > 0 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            )}>
                              {counts.unsolved > 0 ? counts.unsolved : '✓'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ currentView, onViewChange, selectedSubject, selectedChapter, onSelectSubject, onSelectChapter, refreshTrigger, onCloseDesktop }: SidebarProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(['Physics', 'Chemistry', 'Mathematics']));
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [chapterCounts, setChapterCounts] = useState<Record<string, { total: number, unsolved: number }>>({});
  const [inboxCount, setInboxCount] = useState(0);

  const [recycleCount, setRecycleCount] = useState(0);

  useEffect(() => {
    const loadCounts = async () => {
      let allMetadata = await getAllQuestionsMetadata();
      
      // If cache is empty, try to sync
      if (allMetadata.length === 0) {
        await syncMetadata();
        allMetadata = await getAllQuestionsMetadata();
      }

      const counts: Record<string, { total: number, unsolved: number }> = {};
      let inbox = 0;
      const now = Date.now();
      
      allMetadata.forEach(q => {
        if (q.isUncategorized) {
          inbox++;
        } else {
          if (q.chapter) {
            if (!counts[q.chapter]) {
              counts[q.chapter] = { total: 0, unsolved: 0 };
            }
            counts[q.chapter].total += 1;
            if (!q.isSolved) {
              counts[q.chapter].unsolved += 1;
            }
          }
        }
      });
      
      const recycle = await getRecycleBin();
      
      setChapterCounts(counts);
      setInboxCount(inbox);
      setRecycleCount(recycle.length);
    };
    loadCounts();
  }, [refreshTrigger]);

  const toggleSubject = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  };

  const toggleClass = (subject: Subject, className: string) => {
    const key = `${subject}-${className}`;
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <aside className="w-full h-full bg-white dark:bg-neutral-950 flex flex-col">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-start gap-2">
        <div className="flex-1">
          <button 
            onClick={() => onViewChange('dashboard')}
            className="w-full text-left"
          >
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-2 py-1 rounded text-sm">JEE</span>
              Vault
            </h1>
          </button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">Paste (Ctrl+V) anywhere to save</p>
        </div>
        {onCloseDesktop && (
          <button 
            onClick={onCloseDesktop} 
            className="hidden md:flex p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md shrink-0 transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-1">
        <button
          onClick={() => onViewChange('dashboard')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'dashboard' 
              ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <Layers className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={() => onViewChange('planner')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'planner' 
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <Calendar className="w-4 h-4" />
          Daily Planner
        </button>
        <button
          onClick={() => onViewChange('test-analysis')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'test-analysis' 
              ? "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <BarChart2 className="w-4 h-4" />
          Analytics & Tests
        </button>
        <button
          onClick={() => onViewChange('syllabus')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'syllabus' 
              ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <BookOpen className="w-4 h-4" />
          Syllabus Tracker
        </button>
        <button
          onClick={() => onViewChange('mistakes')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'mistakes' 
              ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <AlertOctagon className="w-4 h-4" />
          The Mistake Book
        </button>
        <button
          onClick={() => onViewChange('settings')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'settings' 
              ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-white" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          onClick={() => onViewChange('inbox')}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'inbox' 
              ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <div className="flex items-center gap-2">
            <InboxIcon className="w-4 h-4" />
            Inbox (Dumps)
          </div>
          {inboxCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-amber-400">
              {inboxCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onViewChange('pdf')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === 'pdf' 
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <BookOpen className="w-4 h-4" />
          PDF Reader
        </button>
        <button
          onClick={() => onViewChange('recycle-bin' as ViewState)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors",
            currentView === ('recycle-bin' as ViewState)
              ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
          )}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Recycle Bin
          </div>
          {recycleCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
              {recycleCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Physics */}
        <SidebarSubjectSection 
          name="Physics" 
          icon={BookOpen} 
          color="text-blue-500" 
          isExpanded={expandedSubjects.has('Physics')}
          onToggle={() => toggleSubject('Physics')}
          expandedClasses={expandedClasses}
          toggleClass={toggleClass}
          chapterCounts={chapterCounts}
          currentView={currentView}
          selectedSubject={selectedSubject}
          selectedChapter={selectedChapter}
          onSelectSubject={onSelectSubject}
          onSelectChapter={onSelectChapter}
          onViewChange={onViewChange}
        />

        {/* Chemistry Group */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSubject('Chemistry')}
            className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-bold rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-emerald-600 dark:text-emerald-400"
          >
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              <span>Chemistry</span>
            </div>
            {expandedSubjects.has('Chemistry') ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {expandedSubjects.has('Chemistry') && (
            <div className="pl-2 space-y-3 mt-2 border-l border-neutral-200 dark:border-neutral-800 ml-4">
              {(['Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry'] as Subject[]).map((sub: Subject) => (
                <SidebarSubjectSection 
                  key={sub}
                  name={sub} 
                  icon={FlaskConical} 
                  color="text-emerald-500" 
                  isExpanded={expandedSubjects.has(sub)}
                  onToggle={() => toggleSubject(sub)}
                  expandedClasses={expandedClasses}
                  toggleClass={toggleClass}
                  chapterCounts={chapterCounts}
                  currentView={currentView}
                  selectedSubject={selectedSubject}
                  selectedChapter={selectedChapter}
                  onSelectSubject={onSelectSubject}
                  onSelectChapter={onSelectChapter}
                  onViewChange={onViewChange}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        {/* Mathematics */}
        <SidebarSubjectSection 
          name="Mathematics" 
          icon={Calculator} 
          color="text-rose-500" 
          isExpanded={expandedSubjects.has('Mathematics')}
          onToggle={() => toggleSubject('Mathematics')}
          expandedClasses={expandedClasses}
          toggleClass={toggleClass}
          chapterCounts={chapterCounts}
          currentView={currentView}
          selectedSubject={selectedSubject}
          selectedChapter={selectedChapter}
          onSelectSubject={onSelectSubject}
          onSelectChapter={onSelectChapter}
          onViewChange={onViewChange}
        />
      </div>
    </aside>
  );
}

