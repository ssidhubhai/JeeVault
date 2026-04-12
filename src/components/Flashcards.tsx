import React, { useState, useEffect } from 'react';
import { getAllQuestions, Question } from '../lib/db';
import { Layers, RotateCcw, ChevronLeft, ChevronRight, Tag as TagIcon, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

export function Flashcards() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const load = async () => {
      const all = await getAllQuestions();
      // Shuffle questions for flashcards
      setQuestions(all.sort(() => Math.random() - 0.5));
    };
    load();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => {
          const next = Math.min(questions.length - 1, prev + 1);
          if (next !== prev) setIsFlipped(false);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => {
          const next = Math.max(0, prev - 1);
          if (next !== prev) setIsFlipped(false);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [questions.length]);

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
        <header className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Layers /> Flashcards Review</h2>
        </header>
        <div className="flex-1 flex items-center justify-center text-neutral-400">
          No questions available for flashcards. Paste some questions first!
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950">
      <header className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6" /> Flashcards Review</h2>
        <p className="text-sm font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full">
          Card {currentIndex + 1} of {questions.length}
        </p>
      </header>
      
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div 
          style={{ perspective: '1500px' }} 
          className="w-full max-w-3xl aspect-[4/3] relative cursor-pointer group"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div 
            style={{ 
              transformStyle: 'preserve-3d', 
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
            }} 
            className="w-full h-full transition-transform duration-500 relative"
          >
            {/* Front */}
            <div 
              style={{ backfaceVisibility: 'hidden' }} 
              className="absolute inset-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center p-6 group-hover:shadow-2xl transition-shadow"
            >
              <div className="flex-1 w-full flex items-center justify-center overflow-hidden mb-4">
                <img src={q.imageBase64} className="max-w-full max-h-full object-contain rounded-lg" alt="Question" />
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-sm font-medium">
                <RotateCcw className="w-4 h-4" /> Click to flip
              </div>
            </div>
            
            {/* Back */}
            <div 
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} 
              className="absolute inset-0 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="max-w-xl w-full flex flex-col items-center">
                <h3 className="text-2xl font-bold mb-1 text-neutral-900 dark:text-white">{q.chapter}</h3>
                <p className="text-sm font-medium text-neutral-500 mb-8 uppercase tracking-wider">{q.subject}</p>
                
                {q.tags && q.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {q.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800/50">
                        <TagIcon className="w-3.5 h-3.5" /> {t}
                      </span>
                    ))}
                  </div>
                )}
                
                {q.notes ? (
                  <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl w-full border border-neutral-100 dark:border-neutral-800 text-left">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Notes & Source
                    </h4>
                    <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{q.notes}</p>
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl w-full">
                    <p className="text-neutral-400 italic">No notes added for this question.</p>
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-6 flex items-center gap-2 text-neutral-400 text-sm font-medium">
                <RotateCcw className="w-4 h-4" /> Click to flip back
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="p-6 flex justify-center gap-6 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <button 
          onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setIsFlipped(false); }} 
          disabled={currentIndex === 0} 
          className="flex items-center gap-2 px-6 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-medium disabled:opacity-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> Previous
        </button>
        <button 
          onClick={() => { setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1)); setIsFlipped(false); }} 
          disabled={currentIndex === questions.length - 1} 
          className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-xl font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          Next <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
