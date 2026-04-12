import { useEffect, useState, useRef } from 'react';
import { Download, Trash2, Maximize2, X, CheckCircle, RotateCcw, Search, CheckSquare, Square, Play, Tag as TagIcon, FileText, ArrowUpDown, Clock, Info, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Subject } from '../App';
import { getQuestionsByChapter, deleteQuestion, deleteQuestions, updateQuestion, addQuestion, Question } from '../lib/db';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import { cn } from '../lib/utils';

// SRS Intervals: 1 day, 3 days, 1 week, 1 month
const SRS_INTERVALS = [
  1 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
];

interface MainContentProps {
  selectedSubject: Subject | null;
  selectedChapter: string | null;
  refreshTrigger: number;
  onRefresh: () => void;
}

export function MainContent({ selectedSubject, selectedChapter, refreshTrigger, onRefresh }: MainContentProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [showFullscreenDetails, setShowFullscreenDetails] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'unsolved' | 'solved'>('unsolved');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'tags'>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Practice Mode State
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showConfidence, setShowConfidence] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      if (selectedChapter) {
        const data = await getQuestionsByChapter(selectedChapter);
        setQuestions(data.filter(q => !q.isUncategorized));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
      } else {
        setQuestions([]);
      }
    };
    loadQuestions();
  }, [selectedChapter, refreshTrigger]);

  // Timer logic for Practice Mode
  useEffect(() => {
    if (isPracticeMode && !showConfidence) {
      timerRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPracticeMode, practiceIndex, showConfidence]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (fullscreenIndex !== null) {
        if (e.key === 'Escape') {
          setFullscreenIndex(null);
          setZoomLevel(1);
        } else if (e.key === 'ArrowRight') {
          setFullscreenIndex(prev => prev !== null && prev < displayedQuestions.length - 1 ? prev + 1 : prev);
          setZoomLevel(1);
        } else if (e.key === 'ArrowLeft') {
          setFullscreenIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
          setZoomLevel(1);
        } else if (e.key === '+' || e.key === '=') {
          setZoomLevel(prev => Math.min(prev + 0.5, 4));
        } else if (e.key === '-') {
          setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
        } else if (e.key === 'i' || e.key === 'I') {
          setShowFullscreenDetails(prev => !prev);
        }
        return;
      }

      if (!isPracticeMode) return;
      if (e.key === 'ArrowRight' && !showConfidence) {
        handlePracticeNext();
      } else if (e.key === 's' || e.key === 'S') {
        if (!showConfidence) {
          setShowConfidence(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPracticeMode, showConfidence, practiceIndex]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePracticeNext = () => {
    setTimeSpent(0);
    setShowConfidence(false);
    if (practiceIndex < displayedQuestions.length - 1) {
      setPracticeIndex(prev => prev + 1);
    } else {
      setIsPracticeMode(false);
    }
  };

  const handleConfidenceRating = async (confidence: 'High' | 'Medium' | 'Low') => {
    const q = displayedQuestions[practiceIndex];
    if (!q) return;

    let newStage = q.reviewStage || 0;
    let nextDate = Date.now();
    let isSolved = false;
    let newTags = [...(q.tags || [])];

    // Auto-tag Time Trap if > 3 mins
    if (timeSpent > 180 && !newTags.includes('Time Trap')) {
      newTags.push('Time Trap');
    }

    if (confidence === 'High') {
      newStage++;
      if (newStage >= SRS_INTERVALS.length) {
        isSolved = true; // Mastered
      } else {
        nextDate += SRS_INTERVALS[newStage];
      }
    } else if (confidence === 'Medium') {
      nextDate += SRS_INTERVALS[0];
    } else {
      newStage = 0;
      nextDate += SRS_INTERVALS[0];
    }

    try {
      await updateQuestion({
        ...q,
        reviewStage: newStage,
        nextReviewDate: nextDate,
        isSolved,
        confidence,
        timeTaken: timeSpent,
        tags: newTags
      });
      toast.success('Progress saved');
      onRefresh();
      handlePracticeNext();
    } catch (error) {
      toast.error('Failed to save progress');
    }
  };

  const handleDelete = async (id: string) => {
    const questionToDelete = questions.find(q => q.id === id);
    if (!questionToDelete) return;

    try {
      await deleteQuestion(id);
      onRefresh();
      toast((t) => (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Question deleted</span>
          <button
            onClick={async () => {
              await addQuestion(questionToDelete);
              toast.dismiss(t.id);
              onRefresh();
              toast.success('Question restored');
            }}
            className="px-3 py-1 bg-neutral-800 text-white rounded-md text-xs font-medium hover:bg-neutral-700 transition-colors"
          >
            Undo
          </button>
        </div>
      ), { duration: 5000 });
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const questionsToDelete = questions.filter(q => selectedIds.has(q.id));
    
    try {
      await deleteQuestions(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      onRefresh();
      
      toast((t) => (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Deleted {questionsToDelete.length} questions</span>
          <button
            onClick={async () => {
              await Promise.all(questionsToDelete.map(q => addQuestion(q)));
              toast.dismiss(t.id);
              onRefresh();
              toast.success('Questions restored');
            }}
            className="px-3 py-1 bg-neutral-800 text-white rounded-md text-xs font-medium hover:bg-neutral-700 transition-colors"
          >
            Undo
          </button>
        </div>
      ), { duration: 5000 });
    } catch (error) {
      toast.error('Failed to delete questions');
    }
  };

  const handleBulkToggleSolved = async () => {
    if (selectedIds.size === 0) return;
    try {
      const isSolved = activeTab === 'unsolved';
      const promises = Array.from(selectedIds).map(id => {
        const q = questions.find(q => q.id === id);
        if (q) return updateQuestion({ ...q, isSolved });
        return Promise.resolve();
      });
      await Promise.all(promises);
      toast.success(`Moved ${selectedIds.size} questions`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      onRefresh();
    } catch (error) {
      toast.error('Failed to update questions');
    }
  };

  const handleToggleSolved = async (q: Question) => {
    try {
      const isSolved = !q.isSolved;
      await updateQuestion({ ...q, isSolved });
      toast.success(isSolved ? 'Marked as Solved!' : 'Moved back to Unsolved');
      onRefresh();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportPDF = async () => {
    if (questions.length === 0 || !selectedChapter) return;
    
    setIsExporting(true);
    const toastId = toast.loading('Generating PDF...');
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - 2 * margin;
      
      const questionsToExport = displayedQuestions;
      
      if (questionsToExport.length === 0) {
        toast.error('No questions to export in this tab', { id: toastId });
        setIsExporting(false);
        return;
      }

      for (let i = 0; i < questionsToExport.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const imgData = questionsToExport[i].imageBase64;
        const img = new Image();
        img.src = imgData;
        await new Promise((resolve) => { img.onload = resolve; });
        
        const imgRatio = img.height / img.width;
        let finalWidth = usableWidth;
        let finalHeight = finalWidth * imgRatio;
        
        if (finalHeight > pageHeight - 2 * margin) {
          finalHeight = pageHeight - 2 * margin;
          finalWidth = finalHeight / imgRatio;
        }
        
        const x = margin + (usableWidth - finalWidth) / 2;
        const y = margin;
        
        pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
        
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`${selectedSubject} - ${selectedChapter} | Q${i + 1}`, margin, pageHeight - 5);
      }
      
      pdf.save(`${selectedSubject}_${selectedChapter.replace(/\s+/g, '_')}_${activeTab}.pdf`);
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedSubject || !selectedChapter) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-medium text-neutral-600 dark:text-neutral-300">No Chapter Selected</h2>
          <p className="text-sm">Select a chapter from the sidebar or paste an image to start.</p>
        </div>
      </div>
    );
  }

  const displayedQuestions = questions
    .filter(q => {
      const matchesTab = activeTab === 'solved' ? q.isSolved : !q.isSolved;
      if (!matchesTab) return false;
      
      const matchesTag = tagFilter === 'All' || q.tags?.includes(tagFilter);
      if (!matchesTag) return false;
      
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const inTags = q.tags?.some(t => t.toLowerCase().includes(query));
      const inNotes = q.notes?.toLowerCase().includes(query);
      return inTags || inNotes;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'tags') {
        const tagA = a.tags?.[0] || 'zzzz';
        const tagB = b.tags?.[0] || 'zzzz';
        return tagA.localeCompare(tagB);
      }
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <header className="flex flex-col p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{selectedSubject}</p>
            <h2 className="text-2xl font-bold tracking-tight">{selectedChapter}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
              <button
                onClick={() => { setActiveTab('unsolved'); setSelectedIds(new Set()); setIsSelectionMode(false); }}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                  activeTab === 'unsolved' 
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Solve Later ({questions.filter(q => !q.isSolved).length})
              </button>
              <button
                onClick={() => { setActiveTab('solved'); setSelectedIds(new Set()); setIsSelectionMode(false); }}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                  activeTab === 'solved' 
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Solved ({questions.filter(q => q.isSolved).length})
              </button>
            </div>

            <button
              onClick={() => {
                setPracticeIndex(0);
                setIsPracticeMode(true);
              }}
              disabled={displayedQuestions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Play className="w-4 h-4" fill="currentColor" />
              <span className="hidden sm:inline">Practice</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={displayedQuestions.length === 0 || isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-2 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search tags or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Tags</option>
                <option value="Silly Mistake">Silly Mistakes</option>
                <option value="Good Question">Good Questions</option>
                <option value="PYQ">PYQs</option>
                <option value="Doubt">Doubts</option>
                <option value="Important">Important</option>
              </select>
              <TagIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-8 pr-8 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="tags">Sort by Tags</option>
              </select>
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <span className="text-sm font-medium mr-2">{selectedIds.size} selected</span>
                <button
                  onClick={handleBulkToggleSolved}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                >
                  Mark {activeTab === 'unsolved' ? 'Solved' : 'Unsolved'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-1.5 text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                  className="px-3 py-1.5 text-sm font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSelectionMode(true)}
                disabled={displayedQuestions.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                Select
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {displayedQuestions.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            <div className="text-center">
              <p className="mb-2">
                {searchQuery 
                  ? "No questions match your search."
                  : activeTab === 'unsolved' 
                    ? "No questions to solve yet." 
                    : "No solved questions yet."}
              </p>
              {!searchQuery && activeTab === 'unsolved' && (
                <p className="text-sm">Paste (Ctrl+V) an image to add to this chapter</p>
              )}
            </div>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
            {displayedQuestions.map((q) => {
              const isSelected = selectedIds.has(q.id);
              return (
                <div 
                  key={q.id} 
                  className={cn(
                    "break-inside-avoid mb-6 group relative bg-white dark:bg-neutral-900 rounded-xl shadow-sm border overflow-hidden transition-all duration-200",
                    isSelected 
                      ? "border-blue-500 ring-2 ring-blue-500/20" 
                      : "border-neutral-200 dark:border-neutral-800 hover:shadow-md"
                  )}
                >
                  <img 
                    src={q.imageBase64} 
                    alt="Question" 
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                  
                  {(q.tags?.length || q.notes) && (
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-900/80 border-t border-neutral-100 dark:border-neutral-800">
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {q.tags.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                              <TagIcon className="w-3 h-3" /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.notes && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{q.notes}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className={cn(
                    "absolute inset-0 bg-black/40 transition-opacity duration-200 flex items-center justify-center gap-3 backdrop-blur-[2px]",
                    isSelectionMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {isSelectionMode ? (
                      <button
                        onClick={() => toggleSelection(q.id)}
                        className="p-3 text-white hover:scale-110 transition-transform"
                      >
                        {isSelected ? <CheckSquare className="w-8 h-8 text-blue-400" /> : <Square className="w-8 h-8" />}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleSolved(q)}
                          className={cn(
                            "p-2 text-white rounded-full backdrop-blur-md transition-colors",
                            q.isSolved 
                              ? "bg-neutral-500/80 hover:bg-neutral-500" 
                              : "bg-emerald-500/80 hover:bg-emerald-500"
                          )}
                          title={q.isSolved ? "Mark as Unsolved" : "Mark as Solved"}
                        >
                          {q.isSolved ? <RotateCcw className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => {
                            setFullscreenIndex(displayedQuestions.findIndex(dq => dq.id === q.id));
                            setShowFullscreenDetails(false);
                            setZoomLevel(1);
                          }}
                          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                          title="Expand"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fullscreenIndex !== null && displayedQuestions[fullscreenIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
          {/* Top Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))}
              className="p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white/70 text-sm font-mono w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))}
              className="p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button 
              onClick={() => setShowFullscreenDetails(!showFullscreenDetails)}
              className={cn(
                "p-2 rounded-full transition-colors",
                showFullscreenDetails ? "bg-blue-500 text-white" : "text-white/70 hover:text-white bg-black/50 hover:bg-black/80"
              )}
              title="Toggle Details (i)"
            >
              <Info className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                setFullscreenIndex(null);
                setZoomLevel(1);
              }}
              className="p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Arrows */}
          {fullscreenIndex > 0 && (
            <button 
              onClick={() => {
                setFullscreenIndex(prev => prev! - 1);
                setZoomLevel(1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/60 rounded-full transition-all z-20"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {fullscreenIndex < displayedQuestions.length - 1 && (
            <button 
              onClick={() => {
                setFullscreenIndex(prev => prev! + 1);
                setZoomLevel(1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/60 rounded-full transition-all z-20"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
          
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            <div 
              className="transition-transform duration-200 ease-out flex items-center justify-center w-full h-full p-12"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img 
                src={displayedQuestions[fullscreenIndex].imageBase64} 
                alt="Fullscreen question" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
            
            {/* Details Panel Overlay */}
            {showFullscreenDetails && (
              <div className="absolute bottom-8 left-8 max-w-sm bg-neutral-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-4">
                  <h3 className="text-white font-bold text-lg mb-1">{displayedQuestions[fullscreenIndex].chapter}</h3>
                  <p className="text-neutral-400 text-sm">{displayedQuestions[fullscreenIndex].subject}</p>
                </div>

                {displayedQuestions[fullscreenIndex].tags && displayedQuestions[fullscreenIndex].tags.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {displayedQuestions[fullscreenIndex].tags.map(t => (
                        <span key={t} className="px-2 py-1 bg-white/10 text-white rounded-md text-xs font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {displayedQuestions[fullscreenIndex].notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Notes</h4>
                    <p className="text-neutral-300 text-sm whitespace-pre-wrap bg-black/40 p-3 rounded-lg">
                      {displayedQuestions[fullscreenIndex].notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {isPracticeMode && displayedQuestions.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
          <header className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-400">Practice Mode</span>
              <span className="px-2.5 py-1 bg-neutral-800 rounded-md text-sm font-medium">
                {practiceIndex + 1} / {displayedQuestions.length}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <div className={cn(
                "flex items-center gap-2 font-mono text-xl font-bold",
                timeSpent > 180 ? "text-red-500" : "text-white"
              )}>
                <Clock className="w-5 h-5" />
                {formatTime(timeSpent)}
              </div>
              <div className="flex items-center gap-3">
                {!showConfidence ? (
                  <button
                    onClick={() => setShowConfidence(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Solved
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-neutral-800 p-1 rounded-lg">
                    <span className="text-xs text-neutral-400 px-2">Confidence:</span>
                    <button onClick={() => handleConfidenceRating('Low')} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-md text-sm font-medium transition-colors">Low</button>
                    <button onClick={() => handleConfidenceRating('Medium')} className="px-3 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 rounded-md text-sm font-medium transition-colors">Medium</button>
                    <button onClick={() => handleConfidenceRating('High')} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-md text-sm font-medium transition-colors">High</button>
                  </div>
                )}
                <button 
                  onClick={() => setIsPracticeMode(false)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>
          
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <img 
              src={displayedQuestions[practiceIndex].imageBase64} 
              alt="Practice question" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>

          <footer className="p-4 border-t border-neutral-800 bg-neutral-900 flex justify-center gap-4">
            <button
              onClick={() => {
                setTimeSpent(0);
                setShowConfidence(false);
                setPracticeIndex(prev => Math.max(0, prev - 1));
              }}
              disabled={practiceIndex === 0}
              className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handlePracticeNext}
              disabled={practiceIndex === displayedQuestions.length - 1}
              className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors"
            >
              Skip
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
