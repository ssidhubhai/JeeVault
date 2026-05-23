import React, { useState, useRef } from 'react';
import { Camera, FileText, Sparkles, X, UploadCloud, Loader2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GoogleGenAI } from '@google/genai';

interface AIAnalysisUploadProps {
  onAnalyzeComplete: (data: any) => void;
}

export function AIAnalysisUpload({ onAnalyzeComplete }: AIAnalysisUploadProps) {
  const [files, setFiles] = useState<{ file: File; dataUrl: string; type: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const newFiles: { file: File; dataUrl: string; type: string }[] = [];
      let itemsProcessed = 0;
      let totalImageItems = Array.from(items).filter(item => item.type.startsWith('image/')).length;
      
      if (totalImageItems === 0) return;

      Array.from(items).forEach(item => {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                newFiles.push({
                  file,
                  dataUrl: event.target.result as string,
                  type: file.type
                });
              }
              itemsProcessed++;
              if (itemsProcessed === totalImageItems) {
                setFiles(prev => [...prev, ...newFiles]);
              }
            };
            reader.readAsDataURL(file);
          } else {
             itemsProcessed++;
          }
        }
      });
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setFiles(prev => [...prev, {
              file,
              dataUrl: event.target!.result as string,
              type: file.type
            }]);
          }
        };
        reader.readAsDataURL(file);
      });
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    
    setIsAnalyzing(true);
    let parsingToast = toast.loading('AI is analyzing your test... This will take some time, please wait!');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts = files.map(f => {
        // extract base64 data without prefix format
        const base64Data = f.dataUrl.split(',')[1];
        return {
          inlineData: {
            data: base64Data,
            mimeType: f.type
          }
        };
      });

      const prompt = `You are a strict, no-sugarcoating academic mentor giving a detailed analysis of a student's JEE test performance. 
      I have provided screenshots of their test results (containing correct/incorrect/skipped questions lists) and possibly the question paper as a PDF/Images.
      
      Extract the following data into JSON format accurately:
      1. Overall Score, Max Score, Rank (if visible), Percentile (if visible).
      2. Subject-wise stats for Physics, Chemistry, Mathematics: Score, Correct, Incorrect, Skipped, and Percentile if visible. 
         *CRITICAL INSTRUCTION*: If you don't see the exact numbers or scores written out, YOU MUST count the questions yourself from the screenshots for each subject (e.g., count the green for correct, red for incorrect, grey for skipped). Then calculate the scores (for JEE Mains: +4 for correct, -1 for incorrect) and fill in ALL fields. Do NOT leave them missing.
         *IF* the image only shows a grid of question numbers (e.g. 1 to 90) without explicitly labeling the subjects, YOU MUST ASSUME: Questions 1-30 = Physics, 31-60 = Chemistry, 61-90 = Mathematics. Count them accordingly!
      3. A list of all questions (Question 1 to N, infer N from the images) and their status ('Correct', 'Incorrect', 'Skipped', 'Unmarked'). If you see images with green borders/dots or marks, they are correct. Red borders/dots are incorrect. Grey/white borders/dots are skipped or unmarked.
      4. A comprehensive, brutally honest detailed analysis markdown string (in the \`aiAnalysis\` field) that dissects their performance based on the question paper difficulty (if provided) and their results. Tell them exactly where they failed, what is decent, and what they need to improve. Ensure the analysis is at least 3-4 paragraphs.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [
          { role: 'user', parts: [{ text: prompt }, ...parts] }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT" as any,
            properties: {
              overallScore: { type: "NUMBER" as any, nullable: true },
              maxScore: { type: "NUMBER" as any, nullable: true },
              rank: { type: "NUMBER" as any, nullable: true },
              percentile: { type: "NUMBER" as any, nullable: true },
              physics: { 
                type: "OBJECT" as any, 
                properties: { score: { type: "NUMBER" as any, nullable: true }, correct: { type: "NUMBER" as any, nullable: true }, incorrect: { type: "NUMBER" as any, nullable: true }, skipped: { type: "NUMBER" as any, nullable: true }, percentile: { type: "NUMBER" as any, nullable: true } }
              },
              chemistry: { 
                type: "OBJECT" as any, 
                properties: { score: { type: "NUMBER" as any, nullable: true }, correct: { type: "NUMBER" as any, nullable: true }, incorrect: { type: "NUMBER" as any, nullable: true }, skipped: { type: "NUMBER" as any, nullable: true }, percentile: { type: "NUMBER" as any, nullable: true } }
              },
              maths: { 
                type: "OBJECT" as any, 
                properties: { score: { type: "NUMBER" as any, nullable: true }, correct: { type: "NUMBER" as any, nullable: true }, incorrect: { type: "NUMBER" as any, nullable: true }, skipped: { type: "NUMBER" as any, nullable: true }, percentile: { type: "NUMBER" as any, nullable: true } }
              },
              questions: {
                type: "ARRAY" as any,
                items: {
                  type: "OBJECT" as any,
                  properties: {
                    id: { type: "STRING" as any },
                    subject: { type: "STRING" as any },
                    status: { type: "STRING" as any }
                  }
                }
              },
              aiAnalysis: { type: "STRING" as any, nullable: true }
            }
          }
        }
      });

      const text = response.text || '';
      let jsonStr = text;
      // remove markdown codeblocks if any
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const result = JSON.parse(jsonStr);
      toast.dismiss(parsingToast);
      onAnalyzeComplete(result);
      toast.success('AI Analysis completed successfully!');
    } catch (e) {
      console.error(e);
      toast.dismiss(parsingToast);
      toast.error('AI failed to parse the test. Please check the files and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div id="ai-analysis-upload-container" className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6 mb-8 text-indigo-950 dark:text-indigo-100">
      <div className="flex flex-col md:flex-row items-start gap-4">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1">AI Test Analysis Mentor</h3>
          <p className="text-sm opacity-80 mb-4">
            Upload screenshots of your test results (showing correct/incorrect question status) and optionally the question paper (PDF or images). Our AI mentor will auto-fill your scores and provide a brutally honest, no-sugarcoating performance breakdown!
          </p>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {files.map((f, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-neutral-900 flex items-center justify-center w-20 h-20">
                  {f.type.includes('image') ? (
                    <img src={f.dataUrl} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <FileText className="w-8 h-8 text-neutral-400" />
                  )}
                  <button 
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full md:inset-0 md:bg-red-500/80 md:rounded-none opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <X className="w-4 h-4 md:w-6 md:h-6" />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 shrink-0 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-700 flex flex-col items-center justify-center text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                disabled={isAnalyzing}
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium uppercase text-center leading-tight">Add PDF / Image</span>
              </button>
              
              <input 
                ref={fileInputRef}
                type="file" 
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {files.length > 0 && (
              <button 
                onClick={handleAnalyze} disabled={isAnalyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isAnalyzing ? 'Analyzing Test... (This will take a minute)' : 'Analyze with AI'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
