import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Tag, Save, GripVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getUserTags, saveUserTags } from '../lib/db';
import { QUICK_TAGS } from '../lib/constants';
import { Reorder } from 'motion/react';

export function Settings({ onTagsChange }: { onTagsChange?: (tags: string[]) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadTags = async () => {
      const userTags = await getUserTags();
      if (userTags.length === 0) {
        setTags([...QUICK_TAGS]);
      } else {
        setTags(userTags);
      }
      setIsLoading(false);
    };
    loadTags();
  }, []);

  const handleAddTag = (tagToAdd: string = newTag) => {
    if (!tagToAdd.trim()) return;
    if (tags.includes(tagToAdd.trim())) {
      toast.error('Tag already exists');
      return;
    }
    setTags([...tags, tagToAdd.trim()]);
    setNewTag('');
    setShowSuggestions(false);
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setTags(tags.filter(t => t !== tagToDelete));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveUserTags(tags);
      toast.success('Tags saved successfully');
      if (onTagsChange) onTagsChange(tags);
    } catch (e) {
      toast.error('Failed to save tags');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate suggestions based on what is typed
  const allSuggestions = Array.from(new Set([...tags, ...QUICK_TAGS]));
  const filteredSuggestions = allSuggestions.filter(
    (t) => t.toLowerCase().includes(newTag.toLowerCase()) && !tags.includes(t)
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-y-auto">
      <header className="px-6 py-8 md:py-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Settings</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Manage your custom tags, preferences, and profile.</p>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-4xl mx-auto w-full space-y-8 pb-32">
        <section className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Custom Tags</h2>
              <p className="text-sm text-neutral-500">Manage tags you can apply to questions in the vault. Drag to reorder.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                ref={inputRef}
                type="text" 
                value={newTag}
                onChange={(e) => {
                  setNewTag(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={(e) => {
                  // Small delay to allow clicking suggestions
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="E.g. Good Question, Silly Mistake..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {showSuggestions && newTag.length > 0 && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl">
                  {filteredSuggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      onMouseDown={(e) => e.preventDefault()} // Keep focus on input
                      onClick={() => handleAddTag(suggestion)}
                      className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer"
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={() => handleAddTag()}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <Reorder.Group 
            axis="y" 
            values={tags} 
            onReorder={setTags} 
            className="flex flex-col gap-2 mb-8"
          >
            {tags.map((tag) => (
              <Reorder.Item 
                key={tag} 
                value={tag}
                className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-800 cursor-grab active:cursor-grabbing hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-neutral-400" />
                  {tag}
                </div>
                <button 
                  onClick={() => handleDeleteTag(tag)}
                  className="text-neutral-400 hover:text-red-500 hover:bg-white dark:hover:bg-neutral-800 rounded p-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Reorder.Item>
            ))}
            {tags.length === 0 && (
              <div className="text-sm text-neutral-500 italic py-2">No tags configured. Add tags above to categorize questions easily.</div>
            )}
          </Reorder.Group>

          <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
