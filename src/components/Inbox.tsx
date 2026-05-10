import React, { useEffect, useState } from 'react';
import { getUncategorizedQuestions, updateQuestion, deleteQuestion, Question } from '../lib/db';
import { Subject } from '../App';
import { JEE_SYLLABUS, QUICK_TAGS } from '../lib/constants';
import { toast } from 'react-hot-toast';
import { Trash2, Tag as TagIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, compressImageBase64 } from '../lib/utils';

export function Inbox({ refreshTrigger, onRefresh, availableTags = QUICK_TAGS }: { refreshTrigger: number, onRefresh: () => void, availableTags?: string[] }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Subject>('Physics');
  const [activeGroup, setActiveGroup] = useState<'Physics' | 'Chemistry' | 'Mathematics'>('Physics');
  const [isSaving, setIsSaving] = useState(false);

  const [subject, setSubject] = useState<Subject>('Physics');
  const [classType, setClassType] = useState<'Class 11' | 'Class 12'>('Class 11');
  const [chapter, setChapter] = useState(JEE_SYLLABUS['Physics']['Class 11'][0]);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelectDump = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} dumps to recycle bin?`)) return;
    try {
      for (const id of selectedIds) {
        await deleteQuestion(id);
      }
      toast.success(`Moved ${selectedIds.size} dumps to Recycle Bin`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      onRefresh();
    } catch {
      toast.error('Failed to bulk delete');
    }
  };

  const handleBulkCategorize = () => {
    if (selectedIds.size > 0) {
      setViewMode('detail');
    }
  };

  useEffect(() => {
    const loadInbox = async () => {
      const inbox = await getUncategorizedQuestions();
      setQuestions(inbox);
      if (currentIndex >= inbox.length) {
        setCurrentIndex(Math.max(0, inbox.length - 1));
      }
    };
    loadInbox();
  }, [refreshTrigger]); // Removed currentIndex dependency to avoid infinite loop if currentIndex changes

  useEffect(() => {
    setChapter(JEE_SYLLABUS[subject][classType][0]);
  }, [subject, classType]);

  const filteredQuestions = questions.filter(q => {
    if (!q.subject) return activeTab === 'Physics';
    return q.subject === activeTab;
  });

  const handleSave = async () => {
    const qList = viewMode === 'detail' && isSelectionMode && selectedIds.size > 0 
      ? filteredQuestions.filter(q => selectedIds.has(q.id))
      : viewMode === 'detail' ? [filteredQuestions[currentIndex]] : [];
      
    if (qList.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      for (const q of qList) {
        // Clean up any old invalid schemas from local DB
        const sanitizedQ = {
          id: q.id,
          imageBase64: await compressImageBase64(q.imageBase64),
          timestamp: q.timestamp || (q as any).createdAt || Date.now(),
          subject,
          chapter,
          tags,
          notes,
          isUncategorized: false,
          reviewStage: q.reviewStage || 0,
          nextReviewDate: q.nextReviewDate || Date.now() + 24 * 60 * 60 * 1000,
        };
        await updateQuestion(sanitizedQ as any);
      }
      toast.success(qList.length > 1 ? `Categorized ${qList.length} items!` : 'Categorized & Uploaded to Cloud!');
      setTags([]);
      setNotes('');
      if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
      }
      onRefresh();
      if (filteredQuestions.length - qList.length <= 0) {
        setViewMode('grid');
      }
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    const qId = id || (viewMode === 'detail' ? filteredQuestions[currentIndex]?.id : null);
    if (!qId) return;
    
    try {
      await deleteQuestion(qId);
      toast.success('Moved to Recycle Bin');
      onRefresh();
      if (viewMode === 'detail' && filteredQuestions.length <= 1) {
        setViewMode('grid');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const currentQ = filteredQuestions[currentIndex];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <header className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Inbox (Dumps)
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                {questions.length}
              </span>
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Review and categorize your temporary dumps</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  viewMode === 'grid' 
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('detail')}
                disabled={filteredQuestions.length === 0}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  viewMode === 'detail' 
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-700 disabled:opacity-30"
                )}
              >
                Categorize
              </button>
            </div>

            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
              {(['Physics', 'Chemistry', 'Mathematics'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => {
                    setActiveGroup(g);
                    if (g === 'Chemistry') {
                      setActiveTab('Physical Chemistry');
                    } else {
                      setActiveTab(g as Subject);
                    }
                    setCurrentIndex(0);
                  }}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                    activeGroup === g 
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" 
                      : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeGroup === 'Chemistry' && (
          <div className="flex gap-2 mt-4">
            {(['Physical Chemistry', 'Inorganic Chemistry', 'Organic Chemistry'] as Subject[]).map(s => (
              <button
                key={s}
                onClick={() => {
                  setActiveTab(s);
                  setCurrentIndex(0);
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full border transition-all",
                  activeTab === s
                    ? "bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300"
                    : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-500"
                )}
              >
                {s.replace(' Chemistry', '')}
              </button>
            ))}
          </div>
        )}
        
        {viewMode === 'grid' && filteredQuestions.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={toggleSelectionMode}
              className={cn(
                "text-sm font-medium transition-colors",
                isSelectionMode ? "text-blue-600 dark:text-blue-400" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
              )}
            >
              {isSelectionMode ? 'Cancel Selection' : 'Select items'}
            </button>
            {isSelectionMode && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-xs font-bold bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Delete Selected ({selectedIds.size})
                </button>
                <button
                  onClick={handleBulkCategorize}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Categorize ({selectedIds.size})
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {filteredQuestions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400">
          <div className="text-center space-y-2">
            <div className="text-4xl mb-4">📥</div>
            <h2 className="text-lg font-medium text-neutral-600 dark:text-neutral-300">No dumps in {activeTab}</h2>
            <p className="text-sm">Categorize your quick dumps to see them in the vault.</p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredQuestions.map((q, idx) => (
              <div 
                key={q.id}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelectDump(q.id);
                  } else {
                    setCurrentIndex(idx);
                    setViewMode('detail');
                  }
                }}
                className={cn(
                  "group relative aspect-square bg-white dark:bg-neutral-900 rounded-xl border overflow-hidden cursor-pointer transition-all shadow-sm",
                  isSelectionMode && selectedIds.has(q.id) 
                    ? "border-blue-500 ring-2 ring-blue-500/50" 
                    : "border-neutral-200 dark:border-neutral-800 hover:border-blue-500 hover:shadow-md"
                )}
              >
                <img src={q.imageBase64} className="w-full h-full object-cover" alt="Dump" />
                {!isSelectionMode && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-3 py-1.5 bg-white text-neutral-900 text-xs font-bold rounded-lg shadow-lg">Categorize</span>
                  </div>
                )}
                {isSelectionMode && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full border-2 border-white shadow flex items-center justify-center"
                       style={{ background: selectedIds.has(q.id) ? '#3b82f6' : 'rgba(0,0,0,0.3)' }}>
                    {selectedIds.has(q.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                )}
                {!isSelectionMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(q.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row p-4 md:p-6 gap-4 md:gap-6">
          <div className="flex-1 flex flex-col gap-4 min-h-[50vh] md:min-h-0">
            <div className="flex-1 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-auto p-4 relative shadow-sm">
              <img 
                src={currentQ.imageBase64} 
                alt="Uncategorized" 
                className="max-w-full object-contain cursor-zoom-in active:scale-150 transition-transform origin-center"
              />
              <button
                onClick={() => handleDelete()}
                className="absolute top-4 right-4 p-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors shadow-lg backdrop-blur-sm z-10"
                title="Move to Recycle Bin"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-4">
              <button 
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-sm font-medium text-neutral-500">
                {currentIndex + 1} of {filteredQuestions.length}
              </span>
              <button 
                disabled={currentIndex === filteredQuestions.length - 1}
                onClick={() => setCurrentIndex(prev => prev + 1)}
                className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="w-full md:w-96 shrink-0 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col space-y-4 shadow-sm md:overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 dark:border-neutral-800">
              <h3 className="font-bold text-lg">Categorization</h3>
              <button onClick={() => setViewMode('grid')} className="text-xs text-blue-500 hover:underline">Back to Grid</button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as Subject)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Physics">Physics</option>
                <optgroup label="Chemistry">
                  <option value="Physical Chemistry">Physical Chemistry</option>
                  <option value="Inorganic Chemistry">Inorganic Chemistry</option>
                  <option value="Organic Chemistry">Organic Chemistry</option>
                </optgroup>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setClassType('Class 11')}
                className={cn(
                  "py-2 text-xs font-bold rounded-xl border transition-all",
                  classType === 'Class 11'
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500"
                )}
              >
                Class 11
              </button>
              <button
                onClick={() => setClassType('Class 12')}
                className={cn(
                  "py-2 text-xs font-bold rounded-xl border transition-all",
                  classType === 'Class 12'
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500"
                )}
              >
                Class 12
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Chapter</label>
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {JEE_SYLLABUS[subject][classType].map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                <TagIcon className="w-3 h-3" /> Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full transition-colors border",
                      tags.includes(tag)
                        ? "bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300"
                        : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 flex-1">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-24 px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add any context or source..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isSaving ? 'Saving...' : 'Confirm & Save to Cloud'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
