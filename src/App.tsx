/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { PasteModal } from './components/PasteModal';
import { Flashcards } from './components/Flashcards';
import { ReviseToday } from './components/ReviseToday';
import { Inbox } from './components/Inbox';
import { MockTest } from './components/MockTest';
import { Dashboard } from './components/Dashboard';
import { PdfViewer } from './components/PdfViewer';
import { StorageManager } from './components/StorageManager';
import { RecycleBin } from './components/RecycleBin';
import { addQuestion, Question } from './lib/db';

export type Subject = 'Physics' | 'Physical Chemistry' | 'Inorganic Chemistry' | 'Organic Chemistry' | 'Mathematics';
export type ViewState = 'dashboard' | 'vault' | 'flashcards' | 'revise' | 'inbox' | 'mocktest' | 'pdf' | 'storage' | 'recycle-bin';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPastedImage(event.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleSaveQuestion = async (subject: Subject | '', chapter: string, tags: string[], notes: string, isUncategorized?: boolean, croppedImageUrl?: string) => {
    if (!pastedImage) return;

    const newQuestion: Question = {
      id: crypto.randomUUID(),
      imageBase64: croppedImageUrl || pastedImage,
      subject,
      chapter,
      timestamp: Date.now(),
      isSolved: false,
      tags,
      notes,
      isUncategorized: !!isUncategorized,
      reviewStage: 0,
      nextReviewDate: Date.now() + 24 * 60 * 60 * 1000 // 1 day default
    };

    try {
      await addQuestion(newQuestion);
      toast.success(isUncategorized ? 'Saved to Inbox!' : 'Image Saved!');
      setPastedImage(null);
      setRefreshTrigger(prev => prev + 1);
      
      if (isUncategorized) {
        setCurrentView('inbox');
      } else if (!selectedChapter || selectedChapter !== chapter) {
        setSelectedSubject(subject as Subject);
        setSelectedChapter(chapter);
        setCurrentView('vault');
      }
    } catch (error) {
      toast.error('Failed to save image');
      console.error(error);
      throw error;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 font-sans">
      <Toaster position="bottom-right" />
      
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        selectedSubject={selectedSubject}
        selectedChapter={selectedChapter}
        onSelectSubject={setSelectedSubject}
        onSelectChapter={setSelectedChapter}
        refreshTrigger={refreshTrigger}
      />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {currentView === 'dashboard' && (
          <Dashboard 
            onViewChange={setCurrentView} 
            refreshTrigger={refreshTrigger} 
            onSelectSubject={setSelectedSubject}
            onSelectChapter={setSelectedChapter}
          />
        )}
        {currentView === 'vault' && (
          <MainContent 
            selectedSubject={selectedSubject}
            selectedChapter={selectedChapter}
            refreshTrigger={refreshTrigger}
            onRefresh={() => setRefreshTrigger(prev => prev + 1)}
          />
        )}
        {currentView === 'flashcards' && <Flashcards />}
        {currentView === 'revise' && <ReviseToday />}
        {currentView === 'inbox' && <Inbox refreshTrigger={refreshTrigger} onRefresh={() => setRefreshTrigger(prev => prev + 1)} />}
        {currentView === 'mocktest' && <MockTest />}
        {currentView === 'pdf' && <PdfViewer />}
        {currentView === 'storage' && <StorageManager />}
        {currentView === 'recycle-bin' && <RecycleBin refreshTrigger={refreshTrigger} onRefresh={() => setRefreshTrigger(prev => prev + 1)} />}
      </main>

      {pastedImage && (
        <PasteModal 
          imageUrl={pastedImage} 
          onClose={() => setPastedImage(null)} 
          onSave={handleSaveQuestion} 
          initialSubject={selectedSubject}
          initialChapter={selectedChapter}
        />
      )}
    </div>
  );
}
