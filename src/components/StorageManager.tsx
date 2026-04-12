import React, { useEffect, useState } from 'react';
import { getAllQuestions, getAllPdfSessions, clearPdfSession, deleteQuestions } from '../lib/db';
import { Cloud, HardDrive, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function StorageManager() {
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalPdfs: 0,
    estimatedSize: 0, // in MB
    oldPdfs: 0,
    oldQuestions: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const questions = await getAllQuestions();
      const pdfs = await getAllPdfSessions();
      
      let size = 0;
      let oldQ = 0;
      let oldP = 0;
      
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      questions.forEach(q => {
        // Rough estimation: base64 string length * (3/4) / 1024 / 1024 = MB
        if (q.imageBase64.startsWith('data:image')) {
          size += (q.imageBase64.length * 0.75) / (1024 * 1024);
        }
        if (q.timestamp < thirtyDaysAgo) oldQ++;
      });

      pdfs.forEach(p => {
        // Assume average PDF is 2MB if we don't have exact size
        size += 2; 
        if ((p.lastOpened || 0) < thirtyDaysAgo) oldP++;
      });

      setStats({
        totalQuestions: questions.length,
        totalPdfs: pdfs.length,
        estimatedSize: Math.round(size * 10) / 10,
        oldQuestions: oldQ,
        oldPdfs: oldP
      });
    } catch (error) {
      console.error("Failed to load storage stats", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClearOldPdfs = async () => {
    if (!confirm('Are you sure you want to delete PDFs not opened in the last 30 days?')) return;
    setIsClearing(true);
    try {
      const pdfs = await getAllPdfSessions();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const old = pdfs.filter(p => (p.lastOpened || 0) < thirtyDaysAgo);
      
      for (const p of old) {
        await clearPdfSession(p.id);
      }
      toast.success(`Cleared ${old.length} old PDFs`);
      loadStats();
    } catch (e) {
      toast.error('Failed to clear PDFs');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2 flex items-center gap-3">
              <Cloud className="w-8 h-8 text-blue-500" />
              Storage Manager
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              Manage your cloud storage usage and clear old data.
            </p>
          </div>
          <button 
            onClick={loadStats}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-blue-500' : 'text-neutral-500'}`} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-blue-500">
              <HardDrive className="w-6 h-6" />
              <h3 className="font-semibold text-neutral-900 dark:text-white">Estimated Usage</h3>
            </div>
            <div className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">
              ~{stats.estimatedSize} <span className="text-xl text-neutral-500">MB</span>
            </div>
            <p className="text-sm text-neutral-500">Total cloud storage used</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-emerald-500">
              <Cloud className="w-6 h-6" />
              <h3 className="font-semibold text-neutral-900 dark:text-white">Questions</h3>
            </div>
            <div className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">
              {stats.totalQuestions}
            </div>
            <p className="text-sm text-neutral-500">{stats.oldQuestions} older than 30 days</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4 text-purple-500">
              <Cloud className="w-6 h-6" />
              <h3 className="font-semibold text-neutral-900 dark:text-white">PDF Sessions</h3>
            </div>
            <div className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">
              {stats.totalPdfs}
            </div>
            <p className="text-sm text-neutral-500">{stats.oldPdfs} older than 30 days</p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-neutral-900 dark:text-white">Cleanup Actions</h3>
          </div>
          
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-neutral-900 dark:text-white mb-1">Clear Old PDFs</h4>
                <p className="text-sm text-neutral-500">Delete PDF sessions that haven't been opened in the last 30 days. This frees up significant storage space.</p>
              </div>
              <button 
                onClick={handleClearOldPdfs}
                disabled={stats.oldPdfs === 0 || isClearing}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Clear {stats.oldPdfs} PDFs
              </button>
            </div>

            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-neutral-900 dark:text-white mb-1">Compress Images</h4>
                <p className="text-sm text-neutral-500">Image compression is now handled automatically when cropping during upload.</p>
              </div>
              <button 
                disabled
                className="shrink-0 px-4 py-2 bg-neutral-100 text-neutral-400 dark:bg-neutral-800 rounded-lg font-medium cursor-not-allowed"
              >
                Auto-managed
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
