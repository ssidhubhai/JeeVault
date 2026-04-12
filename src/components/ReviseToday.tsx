import React, { useEffect, useState } from 'react';
import { getAllQuestions, updateQuestion, Question } from '../lib/db';
import { CheckCircle, X, Clock, BrainCircuit, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';

// SRS Intervals: 1 day, 3 days, 1 week, 1 month
const SRS_INTERVALS = [
  1 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
];

export function ReviseToday() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const loadQuestions = async () => {
      const all = await getAllQuestions();
      const now = Date.now();
      // Get questions due for review, limit to 20
      const due = all.filter(q => !q.isUncategorized && !q.isSolved && q.nextReviewDate && q.nextReviewDate <= now)
                     .slice(0, 20);
      setQuestions(due);
    };
    loadQuestions();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (questions.length === 0) return;
      if (e.key === ' ') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'ArrowRight') {
        // Skip
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsFlipped(false);
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (!isFlipped) setIsFlipped(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [questions, currentIndex, isFlipped]);

  const handleReview = async (confidence: 'High' | 'Medium' | 'Low') => {
    const q = questions[currentIndex];
    if (!q) return;

    let newStage = q.reviewStage || 0;
    let nextDate = Date.now();
    let isSolved = false;

    if (confidence === 'High') {
      newStage++;
      if (newStage >= SRS_INTERVALS.length) {
        isSolved = true; // Mastered
      } else {
        nextDate += SRS_INTERVALS[newStage];
      }
    } else if (confidence === 'Medium') {
      // Keep same stage, review tomorrow
      nextDate += SRS_INTERVALS[0];
    } else {
      // Reset stage, review tomorrow
      newStage = 0;
      nextDate += SRS_INTERVALS[0];
    }

    try {
      await updateQuestion({
        ...q,
        reviewStage: newStage,
        nextReviewDate: nextDate,
        isSolved,
        confidence
      });
      
      setIsFlipped(false);
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Done
        setQuestions([]);
        toast.success('Daily revision complete!');
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        <div className="text-center space-y-4">
          <div className="text-6xl mb-4 flex justify-center"><BrainCircuit className="w-20 h-20 text-emerald-500" /></div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">All Caught Up!</h2>
          <p className="text-sm max-w-sm mx-auto">You have completed your spaced repetition reviews for today. Check back tomorrow!</p>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-100 dark:bg-neutral-950">
      <header className="p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" />
            Revise Today
          </h2>
          <p className="text-sm text-neutral-500">Spaced Repetition System</p>
        </div>
        <div className="px-4 py-2 bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 font-medium">
          {currentIndex + 1} / {questions.length}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 perspective-1000">
        <div 
          className={cn(
            "w-full max-w-3xl h-[60vh] relative preserve-3d transition-transform duration-500 cursor-pointer",
            isFlipped ? "rotate-y-180" : ""
          )}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950/50">
              <span className="text-sm font-medium text-neutral-500">Question</span>
              <span className="text-xs text-neutral-400">Press Space to flip</span>
            </div>
            <div className="flex-1 p-6 flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-900">
              <img src={q.imageBase64} alt="Question" className="max-w-full max-h-full object-contain" />
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950/50">
              <span className="text-sm font-medium text-neutral-500">Details</span>
              <span className="text-xs text-neutral-400">Rate your confidence</span>
            </div>
            <div className="flex-1 p-8 flex flex-col justify-center items-center text-center space-y-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">{q.chapter}</h3>
                <p className="text-neutral-500">{q.subject}</p>
              </div>
              
              {q.tags && q.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {q.tags.map(t => (
                    <span key={t} className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {q.notes && (
                <div className="max-w-lg w-full p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 rounded-xl text-left">
                  <p className="text-sm whitespace-pre-wrap">{q.notes}</p>
                </div>
              )}
            </div>
            
            {/* Confidence Buttons */}
            <div className="p-6 bg-neutral-50 dark:bg-neutral-950/50 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-3 gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); handleReview('Low'); }}
                className="flex flex-col items-center justify-center py-3 px-4 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-xl transition-colors"
              >
                <span className="font-bold mb-1">Low</span>
                <span className="text-xs opacity-80">Review tomorrow</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReview('Medium'); }}
                className="flex flex-col items-center justify-center py-3 px-4 bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded-xl transition-colors"
              >
                <span className="font-bold mb-1">Medium</span>
                <span className="text-xs opacity-80">Review tomorrow</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReview('High'); }}
                className="flex flex-col items-center justify-center py-3 px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-xl transition-colors"
              >
                <span className="font-bold mb-1">High</span>
                <span className="text-xs opacity-80">Mastered / Next Stage</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
