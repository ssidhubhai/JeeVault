import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { PasteModal } from './components/PasteModal';
import { Flashcards } from './components/Flashcards';
import { ReviseToday } from './components/ReviseToday';
import { Inbox } from './components/Inbox';
import { MockTest } from './components/MockTest';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { PdfViewer } from './components/PdfViewer';
import { StorageManager } from './components/StorageManager';
import { RecycleBin } from './components/RecycleBin';
import { AnalyticsView } from './components/AnalyticsView';
import { SyllabusTracker } from './components/SyllabusTracker';
import { MistakeBook } from './components/MistakeBook';
import { Settings } from './components/Settings';
import { addQuestion, Question, getUserTags } from './lib/db';
import { Menu, X, Camera } from 'lucide-react';
import { cn } from './lib/utils';
import { QUICK_TAGS } from './lib/constants';

export type Subject = 'Physics' | 'Physical Chemistry' | 'Inorganic Chemistry' | 'Organic Chemistry' | 'Mathematics';
export type ViewState = 'dashboard' | 'planner' | 'vault' | 'syllabus' | 'flashcards' | 'revise' | 'inbox' | 'mocktest' | 'pdf' | 'storage' | 'recycle-bin' | 'analytics' | 'mistakes' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [userTags, setUserTags] = useState<string[]>(QUICK_TAGS);

  useEffect(() => {
    getUserTags().then(tags => {
      if (tags.length > 0) setUserTags(tags);
    });
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPastedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    // If the active element is an input or textarea, let it handle the paste natively
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }
    
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

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 font-sans relative overflow-hidden">
      <Toaster position="bottom-right" />
      
      {/* Hidden File Input for Image Upload */}
      <input 
        type="file" 
        id="global-image-upload" 
        accept="image/*" 
        className="hidden" 
        onChange={handleImageUpload} 
      />

      {/* Mobile FAB for Upload */}
      <button 
        onClick={() => document.getElementById('global-image-upload')?.click()}
        className="fixed bottom-20 right-4 w-12 h-12 bg-rose-500 hover:bg-rose-600 rounded-full text-white shadow-[0_4px_20px_rgb(0,0,0,0.15)] flex items-center justify-center md:hidden z-40 transition-all active:scale-95"
      >
        <Camera className="w-6 h-6" />
      </button>
      
      {/* Mobile Menu Overlay (Full screen for "More") */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-neutral-950 flex flex-col md:hidden">
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xl font-bold">More Tools</h2>
            <button onClick={closeMobileMenu} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto w-full">
            <Sidebar 
              currentView={currentView}
              onViewChange={(view) => {
                setCurrentView(view);
                closeMobileMenu();
              }}
              selectedSubject={selectedSubject}
              selectedChapter={selectedChapter}
              onSelectSubject={setSelectedSubject}
              onSelectChapter={(chapter) => {
                setSelectedChapter(chapter);
                closeMobileMenu();
              }}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      {isDesktopSidebarOpen && (
        <div className="hidden md:block relative z-10 w-72 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800 transition-all">
          <Sidebar 
            currentView={currentView}
            onViewChange={setCurrentView}
            selectedSubject={selectedSubject}
            selectedChapter={selectedChapter}
            onSelectSubject={setSelectedSubject}
            onSelectChapter={setSelectedChapter}
            refreshTrigger={refreshTrigger}
            onCloseDesktop={() => setIsDesktopSidebarOpen(false)}
          />
        </div>
      )}
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative w-full pb-[64px] md:pb-0">
        {/* Desktop Sidebar Toggle Button (floating when closed) */}
        {!isDesktopSidebarOpen && (
          <button 
            onClick={() => setIsDesktopSidebarOpen(true)}
            className="hidden md:flex absolute top-4 left-4 z-50 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            title="Open Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 z-10 relative shadow-sm">
          <h1 className="text-lg font-bold tracking-tight bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1 rounded uppercase">JEE Vault</h1>
        </header>

        <div className="flex-1 overflow-auto">
          {currentView === 'dashboard' && (
            <Dashboard 
              onViewChange={setCurrentView} 
              refreshTrigger={refreshTrigger} 
              onSelectSubject={setSelectedSubject}
              onSelectChapter={setSelectedChapter}
            />
          )}
          {currentView === 'planner' && <Planner />}
          {currentView === 'vault' && (
            <MainContent 
              selectedSubject={selectedSubject}
              selectedChapter={selectedChapter}
              refreshTrigger={refreshTrigger}
              onRefresh={() => setRefreshTrigger(prev => prev + 1)}
              availableTags={userTags}
            />
          )}
          {currentView === 'flashcards' && <Flashcards />}
          {currentView === 'revise' && <ReviseToday />}
          {currentView === 'inbox' && <Inbox refreshTrigger={refreshTrigger} onRefresh={() => setRefreshTrigger(prev => prev + 1)} availableTags={userTags} />}
          {currentView === 'mocktest' && <MockTest />}
          {currentView === 'pdf' && <PdfViewer />}
          {currentView === 'storage' && <StorageManager />}
          {currentView === 'recycle-bin' && <RecycleBin refreshTrigger={refreshTrigger} onRefresh={() => setRefreshTrigger(prev => prev + 1)} />}
          {currentView === 'syllabus' && <SyllabusTracker />}
          {currentView === 'analytics' && <AnalyticsView />}
          {currentView === 'mistakes' && <MistakeBook />}
          {currentView === 'settings' && <Settings onTagsChange={setUserTags} />}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex max-h-[64px]">
        {[
          { id: 'dashboard', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>, label: 'Home' },
          { id: 'planner', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>, label: 'Plan' },
          { id: 'vault', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, label: 'Vault' },
          { id: 'revise', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>, label: 'Revise' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id as ViewState)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-2 transition-colors",
              currentView === item.id 
                ? "text-blue-600 dark:text-blue-400" 
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300"
            )}
          >
            {item.icon}
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex-1 flex flex-col items-center justify-center p-2 transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300"
        >
          <Menu className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-medium">More</span>
        </button>
      </nav>

      {pastedImage && (
        <PasteModal 
          imageUrl={pastedImage} 
          onClose={() => setPastedImage(null)} 
          onSave={handleSaveQuestion} 
          initialSubject={selectedSubject}
          initialChapter={selectedChapter}
          availableTags={userTags}
        />
      )}
    </div>
  );
}
