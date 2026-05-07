import React, { useState, useEffect, useRef } from 'react';
import { X, Tag, Zap, Crop as CropIcon } from 'lucide-react';
import { Subject } from '../App';
import { JEE_SYLLABUS, QUICK_TAGS } from '../lib/constants';
import { cn } from '../lib/utils';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface PasteModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (subject: Subject | '', chapter: string, tags: string[], notes: string, isUncategorized?: boolean, croppedImageUrl?: string) => void;
  initialSubject?: Subject | null;
  initialChapter?: string | null;
  availableTags?: string[];
}

export function PasteModal({ imageUrl, onClose, onSave, initialSubject, initialChapter, availableTags = QUICK_TAGS }: PasteModalProps) {
  const [subject, setSubject] = useState<Subject>(initialSubject || 'Physics');
  const [classType, setClassType] = useState<'Class 11' | 'Class 12'>(() => {
    if (initialSubject && initialChapter) {
      if (JEE_SYLLABUS[initialSubject]['Class 12'].includes(initialChapter)) {
        return 'Class 12';
      }
    }
    return 'Class 11';
  });
  const [chapter, setChapter] = useState(() => {
    if (initialSubject && initialChapter && 
        (JEE_SYLLABUS[initialSubject]['Class 11'].includes(initialChapter) || 
         JEE_SYLLABUS[initialSubject]['Class 12'].includes(initialChapter))) {
      return initialChapter;
    }
    return JEE_SYLLABUS[initialSubject || 'Physics']['Class 11'][0];
  });
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isCropping, setIsCropping] = useState(false);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setChapter(JEE_SYLLABUS[subject][classType][0]);
  }, [subject, classType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '1' && e.altKey) {
        setSubject('Physics');
      } else if (e.key === '2' && e.altKey) {
        setSubject('Chemistry');
      } else if (e.key === '3' && e.altKey) {
        setSubject('Mathematics');
      } else if (e.key === 'd' && e.altKey) {
        handleQuickDump();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        handleSubmit(e as any);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [subject, chapter, tags, notes, completedCrop, classType]);

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const compressImage = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // Limit max dimension to 1600px for better quality text
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // 0.85 quality for better text sharpness
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapter.trim() || isSavingRef.current) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
        try {
          finalImageUrl = await getCroppedImg(imgRef.current, completedCrop);
        } catch (e) {
          console.error("Failed to crop image", e);
        }
      } else {
        // Even if not cropping, compress the original image
        try {
          finalImageUrl = await compressImage(imageUrl);
        } catch (e) {
          console.error("Failed to compress image", e);
        }
      }
      
      await onSave(subject, chapter.trim(), tags, notes.trim(), false, finalImageUrl);
    } catch (error) {
      console.error("Failed to save", error);
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleQuickDump = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current) {
        try {
          finalImageUrl = await getCroppedImg(imgRef.current, completedCrop);
        } catch (e) {
          console.error("Failed to crop image", e);
        }
      } else {
        // Even if not cropping, compress the original image
        try {
          finalImageUrl = await compressImage(imageUrl);
        } catch (e) {
          console.error("Failed to compress image", e);
        }
      }
      await onSave('', '', tags, notes.trim(), true, finalImageUrl);
    } catch (error) {
      console.error("Failed to quick dump", error);
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Save Question
            <button 
              onClick={() => setIsCropping(!isCropping)}
              className={cn(
                "ml-4 px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors",
                isCropping ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              <CropIcon className="w-3 h-3" />
              {isCropping ? "Cropping Active" : "Crop Image"}
            </button>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickDump}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
              title="Save without categorizing (Alt+D)"
            >
              <Zap className={cn("w-4 h-4", isSaving && "animate-pulse")} />
              {isSaving ? "Saving..." : "Quick Dump"}
            </button>
            <button 
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-6">
          <div className="flex-1 bg-neutral-100 dark:bg-neutral-950 rounded-lg flex items-center justify-center overflow-hidden min-h-[200px] relative">
            {isCropping ? (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-w-full max-h-[600px]"
              >
                <img 
                  ref={imgRef}
                  src={imageUrl} 
                  alt="Pasted question" 
                  className="max-w-full max-h-[600px] object-contain"
                />
              </ReactCrop>
            ) : (
              <img 
                ref={imgRef}
                src={imageUrl} 
                alt="Pasted question" 
                className="max-w-full max-h-[600px] object-contain"
              />
            )}
          </div>

          <form onSubmit={handleSubmit} className="w-full md:w-80 space-y-4 flex flex-col">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Subject <span className="text-xs text-neutral-400 font-normal ml-1">(Alt+1/2/3)</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as Subject)}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                type="button"
                onClick={() => setClassType('Class 11')}
                className={cn(
                  "py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                  classType === 'Class 11'
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                    : "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500"
                )}
              >
                CLASS 11
              </button>
              <button
                type="button"
                onClick={() => setClassType('Class 12')}
                className={cn(
                  "py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                  classType === 'Class 12'
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                    : "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-500"
                )}
              >
                CLASS 12
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Chapter</label>
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {JEE_SYLLABUS[subject][classType].map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
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
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Mistakes / New Concepts Learnt / Source</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Calculation mistake in step 2. Formula to remember: v² - u² = 2as. Source: HC Verma"
                className="w-full h-24 px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!chapter.trim() || isSaving}
                className="flex-1 px-4 py-2 text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                title="Ctrl+Enter to save"
              >
                {isSaving && <div className="w-4 h-4 border-2 border-white dark:border-neutral-900 border-t-transparent rounded-full animate-spin" />}
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
