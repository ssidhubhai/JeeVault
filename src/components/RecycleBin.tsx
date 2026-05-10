import React, { useEffect, useState } from 'react';
import { getRecycleBin, restoreQuestion, emptyRecycleBin, deleteFromRecycleBin, deleteMultipleFromRecycleBin, Question, PdfSession, getPdfRecycleBin, restorePdfSession, emptyPdfRecycleBin, deleteMultiplePdfsFromRecycleBin, restoreMultiplePdfs } from '../lib/db';
import { toast } from 'react-hot-toast';
import { Trash2, RotateCcw, AlertTriangle, CheckSquare, Square, X, Info, History, Clock, File } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  isDestructive?: boolean;
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', isDestructive = true }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-md overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-500">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-95",
              isDestructive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
            )}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function RecycleBin({ refreshTrigger, onRefresh }: { refreshTrigger: number, onRefresh: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pdfs, setPdfs] = useState<PdfSession[]>([]);
  const [activeTab, setActiveTab] = useState<'questions' | 'pdfs'>('questions');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const loadRecycleBin = async () => {
      const items = await getRecycleBin();
      setQuestions(items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)));
      
      const pdfItems = await getPdfRecycleBin();
      setPdfs(pdfItems);
    };
    loadRecycleBin();
  }, [refreshTrigger]);

  const handleRestore = async (id: string) => {
    const loadingToast = toast.loading('Restoring...');
    try {
      if (activeTab === 'questions') {
        await restoreQuestion(id);
      } else {
        await restorePdfSession(id);
      }
      toast.dismiss(loadingToast);
      toast.success('Restored successfully!');
      onRefresh();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to restore');
      console.error('Restore error:', error);
    }
  };

  const handleSingleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Permanently?',
      message: 'This action cannot be undone. The item will be permanently removed from your storage.',
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          if (activeTab === 'questions') {
            await deleteFromRecycleBin(id);
          } else {
            await deleteMultiplePdfsFromRecycleBin([id]);
          }
          toast.success('Deleted permanently');
          onRefresh();
        } catch (error) {
          toast.error('Failed to delete');
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: `Delete ${selectedIds.size} Items?`,
      message: `You are about to permanently delete ${selectedIds.size} items. This action is irreversible.`,
      confirmText: 'Delete All Selected',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const loadingToast = toast.loading('Deleting items...');
        try {
          if (activeTab === 'questions') {
            await deleteMultipleFromRecycleBin(Array.from(selectedIds));
          } else {
            await deleteMultiplePdfsFromRecycleBin(Array.from(selectedIds));
          }
          toast.dismiss(loadingToast);
          toast.success('Items deleted permanently');
          setSelectedIds(new Set());
          setIsSelectionMode(false);
          onRefresh();
        } catch (error) {
          toast.dismiss(loadingToast);
          toast.error('Failed to delete items');
        }
      }
    });
  };

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return;
    const loadingToast = toast.loading(`Restoring ${selectedIds.size} items...`);
    try {
      if (activeTab === 'questions') {
        await Promise.all(Array.from(selectedIds).map((id: string) => restoreQuestion(id)));
      } else {
        await restoreMultiplePdfs(Array.from(selectedIds));
      }
      toast.dismiss(loadingToast);
      toast.success('Items restored');
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      onRefresh();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to restore items');
    }
  };

  const handleEmptyBin = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Empty Recycle Bin?',
      message: `Are you sure you want to permanently delete all ${activeTab} in the recycle bin? This cannot be undone.`,
      confirmText: 'Empty Bin Now',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsDeletingAll(true);
        const loadingToast = toast.loading('Emptying bin...');
        try {
          if (activeTab === 'questions') {
            await emptyRecycleBin();
          } else {
            await emptyPdfRecycleBin();
          }
          toast.dismiss(loadingToast);
          toast.success('Recycle bin cleared');
          onRefresh();
        } catch (error) {
          toast.dismiss(loadingToast);
          toast.error('Failed to clear bin');
        } finally {
          setIsDeletingAll(false);
        }
      }
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const list = activeTab === 'questions' ? questions : pdfs;
    if (selectedIds.size === list.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map(q => q.id)));
    }
  };

  const currentList = activeTab === 'questions' ? questions : pdfs;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <AnimatePresence>
        {confirmModal.isOpen && (
          <ConfirmModal 
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          />
        )}
      </AnimatePresence>

      <header className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <History className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Recycle Bin</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {currentList.length} {currentList.length === 1 ? 'item' : 'items'} waiting to be restored
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isSelectionMode ? (
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 text-xs font-bold hover:bg-white dark:hover:bg-neutral-700 rounded-xl transition-all"
                >
                  {selectedIds.size === currentList.length && currentList.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />
                <span className="text-xs font-bold px-2">{selectedIds.size} Selected</span>
                <button
                  onClick={handleBulkRestore}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  Restore
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
                <button
                  onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                  className="p-1.5 text-neutral-500 hover:bg-white dark:hover:bg-neutral-700 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setIsSelectionMode(true)}
                  disabled={currentList.length === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select Items
                </button>
                <button
                  onClick={handleEmptyBin}
                  disabled={isDeletingAll || currentList.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Empty Bin
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Tabs for Questions vs PDFs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 -mb-4 -mx-6 px-6 mt-2">
          <button
            onClick={() => { setActiveTab('questions'); setIsSelectionMode(false); setSelectedIds(new Set()); }}
            className={cn(
              "px-4 py-3 text-sm font-bold border-b-2 transition-colors",
              activeTab === 'questions' ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            Questions
          </button>
          <button
            onClick={() => { setActiveTab('pdfs'); setIsSelectionMode(false); setSelectedIds(new Set()); }}
            className={cn(
              "px-4 py-3 text-sm font-bold border-b-2 transition-colors",
              activeTab === 'pdfs' ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            Resources
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {currentList.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400 h-full min-h-[400px]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 max-w-xs"
            >
              <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-10 h-10 text-neutral-300 dark:text-neutral-700" />
              </div>
              <h2 className="text-xl font-bold text-neutral-600 dark:text-neutral-300">Recycle Bin is Empty</h2>
              <p className="text-sm text-neutral-500">Deleted items will appear here for 30 days before being permanently removed.</p>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {activeTab === 'questions' ? questions.map((q, index) => {
                const isSelected = selectedIds.has(q.id);
                return (
                  <motion.div 
                    key={q.id} 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "group bg-white dark:bg-neutral-900 rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col relative",
                  isSelected ? "border-blue-500 ring-4 ring-blue-500/10" : "border-neutral-200 dark:border-neutral-800"
                )}
              >
                <div className="aspect-video relative bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center overflow-hidden">
                  <img 
                    src={q.imageBase64} 
                    alt="Deleted item" 
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                  />
                  
                  {/* Overlay Controls */}
                  <div className={cn(
                    "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all flex items-center justify-center gap-4",
                    isSelectionMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {isSelectionMode ? (
                      <button
                        onClick={() => toggleSelection(q.id)}
                        className="p-4 text-white hover:scale-110 transition-transform"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-12 h-12 text-blue-400" />
                        ) : (
                          <Square className="w-12 h-12 text-white/50" />
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestore(q.id); }}
                          className="p-4 bg-white text-neutral-900 rounded-full hover:scale-110 transition-transform shadow-2xl"
                          title="Restore"
                        >
                          <RotateCcw className="w-6 h-6" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSingleDelete(q.id); }}
                          className="p-4 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-2xl"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      {q.subject || 'Uncategorized'}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                      <Clock className="w-3 h-3" />
                      {new Date(q.deletedAt || 0).toLocaleDateString()}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 line-clamp-1">
                    {q.chapter || 'No chapter assigned'}
                  </h3>
                </div>
              </motion.div>
            );
          }) : pdfs.map((p, index) => {
            const isSelected = selectedIds.has(p.id);
            return (
              <motion.div 
                key={p.id} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "group bg-white dark:bg-neutral-900 rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col relative p-6",
                  isSelected ? "border-blue-500 ring-4 ring-blue-500/10" : "border-neutral-200 dark:border-neutral-800"
                )}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0">
                    <File className="w-6 h-6 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate" title={p.fileName}>
                      {p.fileName}
                    </h3>
                    <p className="text-xs text-neutral-500 truncate">{p.boxName} • {p.subject}</p>
                  </div>
                </div>
                
                <div className="mt-auto flex items-center justify-between text-[10px] text-neutral-400">
                  <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg font-bold uppercase tracking-wider">{p.chapter || 'Unknown'}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(p.deletedAt || 0).toLocaleDateString()}
                  </div>
                </div>

                <div className={cn(
                  "absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all flex items-center justify-center gap-4",
                  isSelectionMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                  {isSelectionMode ? (
                    <button
                      onClick={() => toggleSelection(p.id)}
                      className="p-4 text-white hover:scale-110 transition-transform"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-12 h-12 text-blue-400" />
                      ) : (
                        <Square className="w-12 h-12 text-white/50" />
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(p.id); }}
                        className="p-3 bg-white text-neutral-900 rounded-full hover:scale-110 transition-transform shadow-2xl"
                        title="Restore"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSingleDelete(p.id); }}
                        className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-2xl"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      <div className="p-4 bg-neutral-100 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-4 text-neutral-500 text-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          <p>Items are stored locally. Emptying the bin is permanent.</p>
        </div>
        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700" />
        <p>Auto-delete after 30 days (coming soon)</p>
      </div>
    </div>
  );
}
