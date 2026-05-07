import React, { useState, useEffect } from 'react';
import { JEE_SYLLABUS } from '../lib/constants';
import { ChapterProgress, getSyllabusProgress, saveChapterProgress } from '../lib/db';
import { CheckCircle2, Circle, GraduationCap, ArrowUpRight, BarChart2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Subject } from '../App';

const STAGES = [
  { key: 'lectures', label: 'Lectures' },
  { key: 'module', label: 'Module Solved' },
  { key: 'mains', label: 'Mains PYQs' },
  { key: 'adv', label: 'Adv PYQs' },
  { key: 'notes', label: 'Short Notes' },
  { key: 'revision', label: 'Revision 1' }
];

export function SyllabusTracker() {
  const [activeSubject, setActiveSubject] = useState<Subject>('Physics');
  const [progress, setProgress] = useState<ChapterProgress[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getSyllabusProgress();
    setProgress(data);
  };

  const getProgressForChapter = (subject: string, chapter: string) => {
    return progress.find(p => p.id === `${subject}_${chapter}`) || {
      id: `${subject}_${chapter}`,
      subject,
      chapter,
      lectures: false,
      module: false,
      mains: false,
      adv: false,
      notes: false,
      revision: false
    };
  };

  const toggleStage = async (subject: string, chapter: string, stage: keyof ChapterProgress) => {
    const existing = getProgressForChapter(subject, chapter);
    const updated = { ...existing, [stage]: !existing[stage] };
    
    // Optimistic update
    setProgress(prev => {
      const filtered = prev.filter(p => p.id !== updated.id);
      return [...filtered, updated];
    });

    await saveChapterProgress(updated as ChapterProgress);
  };

  const subjects: Subject[] = ['Physics', 'Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry', 'Mathematics'];

  const calculateSubjectProgress = (subject: string) => {
    const class12 = JEE_SYLLABUS[subject]['Class 12'] || [];
    const allChapters = [...class12];
    
    let totalChecks = allChapters.length * STAGES.length;
    let completedChecks = 0;
    
    allChapters.forEach(ch => {
      const cp = getProgressForChapter(subject, ch);
      STAGES.forEach(st => {
        if ((cp as any)[st.key]) completedChecks++;
      });
    });

    return totalChecks === 0 ? 0 : Math.round((completedChecks / totalChecks) * 100);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
              Macro Syllabus Tracker
            </h1>
            <p className="text-sm md:text-base text-neutral-500 dark:text-neutral-400">
              The Bird's-Eye View. Track your 90+ JEE chapters through specific stages of mastery.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm min-w-[200px]">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl text-blue-600 dark:text-blue-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Overall Mastery</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {Math.round(subjects.reduce((sum, s) => sum + calculateSubjectProgress(s), 0) / subjects.length)}%
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Subject Navigation */}
        <div className="flex overflow-x-auto pb-2 scrollbar-none gap-2">
          {subjects.map(subject => {
            const prog = calculateSubjectProgress(subject);
            return (
              <button
                key={subject}
                onClick={() => setActiveSubject(subject)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap transition-all border shrink-0",
                  activeSubject === subject 
                    ? "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 shadow-sm" 
                    : "bg-transparent border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/50 text-neutral-500"
                )}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className={cn(
                    "font-medium text-sm transition-colors",
                    activeSubject === subject ? "text-neutral-900 dark:text-white" : ""
                  )}>
                    {subject}
                  </span>
                  <div className="flex items-center gap-2 w-full">
                    <div className="h-1.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-neutral-400">{prog}%</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Chapter Grid */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-wider bg-neutral-50 dark:bg-neutral-950 sticky left-0 z-20 shadow-[1px_0_0_0_theme(colors.neutral.200)] dark:shadow-[1px_0_0_0_theme(colors.neutral.800)] min-w-[200px]">Chapter Name</th>
                  {STAGES.map(stage => (
                    <th key={stage.key} className="px-4 py-4 text-center font-bold tracking-wider whitespace-nowrap bg-neutral-50 dark:bg-neutral-950">
                      {stage.label}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center font-bold tracking-wider bg-neutral-50 dark:bg-neutral-950">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {['Class 12'].map(className => (
                  <React.Fragment key={className}>
                    <tr className="bg-neutral-50/50 dark:bg-neutral-950/50">
                      <td colSpan={STAGES.length + 2} className="px-6 py-2 font-bold text-neutral-900 dark:text-white text-xs uppercase tracking-wider sticky left-0">
                        {className}
                      </td>
                    </tr>
                    {(JEE_SYLLABUS[activeSubject as any]?.[className as any] || []).map((chapter: string) => {
                      const cp = getProgressForChapter(activeSubject, chapter);
                      let checks = 0;
                      STAGES.forEach(st => { if ((cp as any)[st.key]) checks++; });
                      const capProgress = Math.round((checks / STAGES.length) * 100);
                      
                      return (
                        <tr key={chapter} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/20 transition-colors group">
                          <td className="px-6 py-4 font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap sticky left-0 bg-white dark:bg-neutral-900 group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800/80 transition-colors shadow-[1px_0_0_0_theme(colors.neutral.200)] dark:shadow-[1px_0_0_0_theme(colors.neutral.800)]">
                            {chapter}
                          </td>
                          {STAGES.map(stage => (
                            <td key={stage.key} className="px-4 py-4">
                              <button
                                onClick={() => toggleStage(activeSubject, chapter, stage.key as any)}
                                className="w-full flex justify-center text-neutral-300 dark:text-neutral-700 hover:scale-110 transition-transform focus:outline-none"
                              >
                                {(cp as any)[stage.key] ? (
                                  <CheckCircle2 className="w-6 h-6 text-emerald-500 drop-shadow-sm" />
                                ) : (
                                  <Circle className="w-6 h-6 hover:text-emerald-500/50 transition-colors" />
                                )}
                              </button>
                            </td>
                          ))}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 justify-center text-xs font-semibold text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                              <span>{capProgress}%</span>
                              <div className="h-1.5 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden shrink-0">
                                <div 
                                  className={cn("h-full rounded-full transition-all", capProgress === 100 ? "bg-emerald-500" : "bg-neutral-400 dark:bg-neutral-600")}
                                  style={{ width: `${capProgress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
