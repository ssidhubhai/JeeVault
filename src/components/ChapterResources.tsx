import React, { useState, useEffect } from 'react';
import { Folder, Plus, File, Trash2, ExternalLink, ChevronRight, UploadCloud, Edit2, Check, X, GripVertical } from 'lucide-react';
import { getAllPdfSessions, savePdfSession, clearPdfSession, PdfSession, getChapterBoxes, saveChapterBoxes, ChapterBox } from '../lib/db';
import { cn } from '../lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ChapterResourcesProps {
  subject: string;
  chapter: string;
  onOpenPdf: (pdfId: string) => void;
}

export function ChapterResources({ subject, chapter, onOpenPdf }: ChapterResourcesProps) {
  const [resources, setResources] = useState<PdfSession[]>([]);
  const [boxes, setBoxes] = useState<ChapterBox[]>([]);
  const [activeBox, setActiveBox] = useState<ChapterBox | null>(null);
  
  const [newBoxName, setNewBoxName] = useState('');
  const [isAddingBox, setIsAddingBox] = useState(false);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editBoxName, setEditBoxName] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadData = async () => {
    const allPdfs = await getAllPdfSessions();
    const chapterPdfs = allPdfs.filter(pdf => pdf.subject === subject && pdf.chapter === chapter && !pdf.deletedAt);
    setResources(chapterPdfs);

    const chapterBoxes = await getChapterBoxes(subject, chapter);
    if (chapterBoxes.length === 0) {
      // Auto-create defaults if it's the very first time
      const defaults: ChapterBox[] = [
        { id: crypto.randomUUID(), name: 'PYQ', orderIndex: 0 },
        { id: crypto.randomUUID(), name: 'Module', orderIndex: 1 },
        { id: crypto.randomUUID(), name: 'Class Notes', orderIndex: 2 }
      ];
      setBoxes(defaults);
      await saveChapterBoxes(subject, chapter, defaults);
    } else {
      setBoxes(chapterBoxes.sort((a, b) => a.orderIndex - b.orderIndex));
    }
  };

  useEffect(() => {
    loadData();
  }, [subject, chapter]);

  const handleAddBox = async () => {
    if (newBoxName.trim()) {
      const newBox: ChapterBox = {
        id: crypto.randomUUID(),
        name: newBoxName.trim(),
        orderIndex: boxes.length
      };
      const newBoxes = [...boxes, newBox];
      setBoxes(newBoxes);
      await saveChapterBoxes(subject, chapter, newBoxes);
    }
    setNewBoxName('');
    setIsAddingBox(false);
  };

  const handleRenameBox = async (boxId: string) => {
    if (editBoxName.trim()) {
      const newBoxes = boxes.map(b => b.id === boxId ? { ...b, name: editBoxName.trim() } : b);
      setBoxes(newBoxes);
      await saveChapterBoxes(subject, chapter, newBoxes);
      if (activeBox?.id === boxId) {
        setActiveBox(newBoxes.find(b => b.id === boxId) || null);
      }
    }
    setEditingBoxId(null);
  };

  const handleDeleteBox = async (boxId: string, boxName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Folder?',
      message: 'Are you sure you want to delete this folder? All PDFs inside will be moved to the recycle bin.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const newBoxes = boxes.filter(b => b.id !== boxId);
        setBoxes(newBoxes);
        await saveChapterBoxes(subject, chapter, newBoxes);
        
        const boxPdfs = resources.filter(r => r.boxName === boxName);
        for (const pdf of boxPdfs) {
          await savePdfSession({ ...pdf, deletedAt: Date.now() });
        }
        setActiveBox(null);
        loadData();
      }
    });
  };

  const handleFileUpload = async (files: FileList | null, boxName: string) => {
    if (!files) return;
    
    // Sort existing to find max order
    const boxPdfs = resources.filter(r => r.boxName === boxName).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    let baseOrder = boxPdfs.length > 0 ? (boxPdfs[boxPdfs.length - 1].orderIndex || 0) + 1 : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') continue;

      const arrayBuffer = await file.arrayBuffer();
      const newPdf: PdfSession = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileData: arrayBuffer,
        fileType: file.type,
        pageNumber: 1,
        subject,
        chapter,
        boxName,
        orderIndex: baseOrder + i,
        lastOpened: Date.now()
      };

      await savePdfSession(newPdf);
    }
    loadData();
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, boxName: string) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files, boxName);
    }
  };

  const handleDeletePdf = async (pdf: PdfSession) => {
    // Send to recycle bin
    await savePdfSession({ ...pdf, deletedAt: Date.now() });
    loadData();
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !activeBox) return;

    const boxPdfs = resources.filter(r => r.boxName === activeBox.name).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const items: PdfSession[] = [...boxPdfs];
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update frontend state immediately
    const updatedResources = [...resources.filter(r => r.boxName !== activeBox.name), ...items];
    setResources(updatedResources);

    // Save orders
    for (let i = 0; i < items.length; i++) {
      if (items[i].orderIndex !== i) {
        items[i].orderIndex = i;
        await savePdfSession(items[i]);
      }
    }
  };

  if (activeBox) {
    const boxPdfs = resources.filter(r => r.boxName === activeBox.name).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 h-full flex flex-col relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveBox(null)}
              className="p-2 -ml-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            {editingBoxId === activeBox.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={editBoxName}
                  onChange={(e) => setEditBoxName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameBox(activeBox.id)}
                  className="px-2 py-1 text-xl font-bold bg-transparent border-b border-blue-500 focus:outline-none"
                />
                <button onClick={() => handleRenameBox(activeBox.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4"/></button>
                <button onClick={() => setEditingBoxId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
              </div>
            ) : (
              <h3 className="text-xl font-bold flex items-center gap-2">
                {activeBox.name}
                <button
                  onClick={() => { setEditingBoxId(activeBox.id); setEditBoxName(activeBox.name); }}
                  className="text-neutral-400 hover:text-blue-500 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              id={`upload-box-corner`}
              onChange={(e) => handleFileUpload(e.target.files, activeBox.name)}
            />
            <label
              htmlFor={`upload-box-corner`}
              className="p-2 text-neutral-600 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400 cursor-pointer rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Upload PDF"
            >
              <Plus className="w-5 h-5" />
            </label>
            <button
              onClick={() => handleDeleteBox(activeBox.id, activeBox.name)}
              className="p-2 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Delete Box"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div 
          className={cn(
            "flex-1 border-2 rounded-xl border-dashed transition-colors relative overflow-hidden",
            isDraggingOver ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : "border-transparent",
            boxPdfs.length === 0 ? "border-neutral-200 dark:border-neutral-800" : ""
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => handleFileDrop(e, activeBox.name)}
        >
          {boxPdfs.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <UploadCloud className="w-16 h-16 text-blue-500/50 mb-4" />
              <h4 className="text-lg font-bold text-neutral-700 dark:text-neutral-300 mb-2">Upload or Drag & Drop PDFs</h4>
              <p className="text-sm text-neutral-500 max-w-sm mb-6">Drop your PDF resources here, or click the button below to browse.</p>
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                id={`upload-box-empty`}
                onChange={(e) => handleFileUpload(e.target.files, activeBox.name)}
              />
              <label
                htmlFor={`upload-box-empty`}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                Browse Files
              </label>
            </div>
          ) : (
            <div className="p-4 h-full overflow-y-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="pdfs">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                      {boxPdfs.map((pdf, index) => (
                        // @ts-ignore - React 18 key prop typing issue with handle-pangea
                        <Draggable key={pdf.id} draggableId={pdf.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "flex items-center justify-between p-3 lg:p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl group transition-all",
                                snapshot.isDragging ? "shadow-xl border-blue-500/50 rotate-1 z-50" : "hover:border-neutral-300 dark:hover:border-neutral-700"
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div 
                                  {...provided.dragHandleProps}
                                  className="p-1 cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600"
                                >
                                  <GripVertical className="w-5 h-5" />
                                </div>
                                <button
                                  onClick={() => onOpenPdf(pdf.id)}
                                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                >
                                  <File className="w-5 h-5 text-rose-500 shrink-0" />
                                  <span className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">{pdf.fileName}</span>
                                </button>
                              </div>
                              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onOpenPdf(pdf.id)}
                                  className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Open PDF"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePdf(pdf)}
                                  className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Delete PDF"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}
        </div>

        {/* Box Deletion Confirm Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-neutral-200 dark:border-neutral-800">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-neutral-500 mb-6">{confirmModal.message}</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30 transition-all active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Resources</h3>
        {!isAddingBox ? (
          <button
            onClick={() => setIsAddingBox(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Folder
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newBoxName}
              onChange={(e) => setNewBoxName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBox()}
              placeholder="Folder name"
              className="px-4 py-2 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button onClick={handleAddBox} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">Save</button>
            <button onClick={() => setIsAddingBox(false)} className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-neutral-700">Cancel</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {boxes.map((box, index) => {
          const count = resources.filter(r => r.boxName === box.name).length;
          return (
            <div 
              key={box.id}
              onClick={() => setActiveBox(box)}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-blue-500/30 transition-all cursor-pointer flex flex-col group h-32"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md tracking-wider">
                  RE - {String(index + 1).padStart(2, '0')}
                </span>
                <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">{box.name}</h4>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">{count} {count === 1 ? 'Notes' : 'Notes'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
