import React, { useState, useEffect } from 'react';
import { getAllQuestions, Question } from '../lib/db';
import { Subject } from '../App';
import { JEE_SYLLABUS } from '../lib/constants';
import { Play, Timer, CheckCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function MockTest() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 1 hour
  const [isFinished, setIsFinished] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const toggleChapter = (chapter: string) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  };

  const startTest = async () => {
    if (selectedChapters.size === 0) return;
    const all = await getAllQuestions();
    const eligible = all.filter(q => !q.isUncategorized && !q.isSolved && selectedChapters.has(q.chapter));
    
    // Shuffle and pick 25
    const shuffled = eligible.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 25);
    
    setTestQuestions(selected);
    setIsTestRunning(true);
    setIsFinished(false);
    setTimeLeft(60 * 60);
    setCurrentIndex(0);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTestRunning && !isFinished && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTestRunning, isFinished, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isTestRunning) {
    if (testQuestions.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">No Questions Found</h2>
            <p className="text-neutral-500 mb-4">There are no unsolved questions in the selected chapters.</p>
            <button onClick={() => setIsTestRunning(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Go Back</button>
          </div>
        </div>
      );
    }

    const q = testQuestions[currentIndex];

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
        <header className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-400">Mock Test</span>
            <span className="px-2.5 py-1 bg-neutral-800 rounded-md text-sm font-medium">
              {currentIndex + 1} / {testQuestions.length}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className={cn(
              "flex items-center gap-2 font-mono text-xl font-bold",
              timeLeft < 300 ? "text-red-500" : "text-white"
            )}>
              <Timer className="w-5 h-5" />
              {formatTime(timeLeft)}
            </div>
            <button 
              onClick={() => setShowEndConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
            >
              End Test
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <img 
            src={q.imageBase64} 
            alt="Test question" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-white"
          />
        </div>

        <footer className="p-4 border-t border-neutral-800 bg-neutral-900 flex justify-center gap-4">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentIndex(prev => Math.min(testQuestions.length - 1, prev + 1))}
            disabled={currentIndex === testQuestions.length - 1}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors"
          >
            Next
          </button>
        </footer>

        {showEndConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">End Test</h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm">
                Are you sure you want to end the test? You won't be able to continue.
              </p>
              <div className="flex gap-3 justify-end mt-2">
                <button 
                  onClick={() => setShowEndConfirm(false)}
                  className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsFinished(true);
                    setIsTestRunning(false);
                    setShowEndConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  End Test
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Timer className="w-6 h-6 text-rose-500" />
          Custom Mock Test
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Select chapters to generate a 1-hour, 25-question test.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Grouping Chemistry for cleaner selection */}
          {['Physics', 'Chemistry', 'Mathematics'].map(group => {
            const subjectsInGroup = group === 'Chemistry' 
              ? ['Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry'] as Subject[]
              : [group as Subject];
            
            return (
              <div key={group} className="space-y-4">
                <h3 className={cn(
                  "text-xl font-bold border-b pb-2",
                  group === 'Physics' ? "text-blue-600 border-blue-100" :
                  group === 'Chemistry' ? "text-emerald-600 border-emerald-100" : "text-rose-600 border-rose-100"
                )}>
                  {group}
                </h3>
                
                <div className="space-y-6">
                  {subjectsInGroup.map(subject => {
                    const classData = JEE_SYLLABUS[subject];
                    const allChapters = [...classData['Class 11'], ...classData['Class 12']];
                    
                    return (
                      <div key={subject} className="space-y-2">
                        {group === 'Chemistry' && (
                          <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">{subject.replace(' Chemistry', '')}</h4>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {allChapters.map(chapter => (
                            <label key={chapter} className="flex items-start gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedChapters.has(chapter)}
                                onChange={() => toggleChapter(chapter)}
                                className="mt-1 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-tight">{chapter}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex justify-between items-center">
        <span className="text-sm font-medium text-neutral-500">
          {selectedChapters.size} chapters selected
        </span>
        <button
          onClick={startTest}
          disabled={selectedChapters.size === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4" fill="currentColor" />
          Start 1-Hour Test
        </button>
      </div>
    </div>
  );
}
