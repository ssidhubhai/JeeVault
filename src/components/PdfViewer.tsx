import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Moon,
  Sun,
  Coffee,
  Book,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Timer,
  X,
  Clock,
  Trash2,
  Scissors,
  Pen,
  Highlighter,
  Eraser,
  Palette,
  Circle,
  Square,
  Minus,
  ArrowRight,
  Shapes,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "../lib/utils";
import {
  savePdfSession,
  getPdfSession,
  getAllPdfSessions,
  clearPdfSession,
  PdfSession,
  addQuestion,
  getPdfAnnotations,
  savePdfAnnotations,
} from "../lib/db";
import { toast } from "react-hot-toast";
import { toCanvas } from "html-to-image";
import { PasteModal } from "./PasteModal";
import { Subject } from "../App";

// Initialize PDF.js worker using native URL resolver to enforce off-thread Web Worker execution in Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Theme = "normal" | "dark" | "sepia" | "warm";
type Tool =
  | "none"
  | "pen"
  | "highlight"
  | "eraser"
  | "circle"
  | "rectangle"
  | "line"
  | "dotted-line"
  | "arrow";

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  id: string;
  type: Tool;
  points: Point[];
  color: string;
  brushSize: number;
}

interface PdfPageWrapperProps {
  pageNum: number;
  scale: number;
  renderScale: number;
  pageWidth: number;
  pageHeight: number;
  pageSizes: { [pageNum: number]: { width: number; height: number } };
  tool: Tool;
  handlePointerDown: (e: React.PointerEvent<HTMLDivElement>, pageNum: number) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLDivElement>, pageNum: number) => void;
  handlePointerUp: (e: React.PointerEvent<HTMLDivElement>, pageNum: number) => void;
  annotations: { [page: number]: Stroke[] };
  currentStroke: Stroke | null;
  renderStroke: (stroke: Stroke) => React.ReactNode;
  setPageSizes: React.Dispatch<React.SetStateAction<{ [pageNum: number]: { width: number; height: number } }>>;
  refCallback: (el: HTMLDivElement | null) => void;
}

function PdfPageWrapper({
  pageNum,
  scale,
  renderScale,
  pageWidth,
  pageHeight,
  pageSizes,
  tool,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  annotations,
  currentStroke,
  renderStroke,
  setPageSizes,
  refCallback,
}: PdfPageWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        rootMargin: "350px 0px 350px 0px", // Pre-load pages ahead of scroll to prevent blank space
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  // Compute dimensions of original page at the target scale we are rendering right now safely
  const renderPageWidth = pageSizes[pageNum] ? pageSizes[pageNum].width * renderScale : 595 * renderScale;
  const renderPageHeight = pageSizes[pageNum] ? pageSizes[pageNum].height * renderScale : 842 * renderScale;

  return (
    <div
      ref={(el) => {
        elementRef.current = el;
        refCallback(el);
      }}
      data-page-number={pageNum}
      className="mb-8 shadow-2xl bg-black relative flex items-center justify-center overflow-hidden"
      style={{ height: pageHeight, width: pageWidth }}
    >
      {isVisible ? (
        <div
          style={{
            transform: `scale(${scale / renderScale})`,
            transformOrigin: "top left",
            width: renderPageWidth,
            height: renderPageHeight,
          }}
          className="absolute top-0 left-0 transition-transform duration-100 ease-out"
        >
          <Page
            pageNumber={pageNum}
            scale={renderScale}
            devicePixelRatio={Math.min(2, window.devicePixelRatio)}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="bg-black"
            onLoadSuccess={(page) => {
              setPageSizes((prev) => {
                if (prev[pageNum]) return prev;
                return {
                  ...prev,
                  [pageNum]: {
                    width: page.width || page.originalWidth,
                    height: page.height || page.originalHeight,
                  },
                };
              });
            }}
            loading={
              <div
                style={{ height: renderPageHeight, width: renderPageWidth }}
                className="flex flex-col items-center justify-center bg-black"
              >
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-neutral-400">Loading page...</p>
              </div>
            }
          />
        </div>
      ) : (
        <div
          style={{ height: pageHeight, width: pageWidth }}
          className="flex flex-col items-center justify-center bg-black/40 animate-pulse"
        >
          <p className="text-xs text-neutral-500 font-mono">
            Page {pageNum}
          </p>
        </div>
      )}

      {isVisible && (
        <div
          className="absolute inset-0 z-10 touch-none"
          style={{
            cursor: tool === "none" ? "auto" : "crosshair",
            pointerEvents: tool === "none" ? "none" : "auto",
          }}
          onPointerDown={(e) => handlePointerDown(e, pageNum)}
          onPointerMove={(e) => handlePointerMove(e, pageNum)}
          onPointerUp={(e) => handlePointerUp(e, pageNum)}
          onPointerCancel={(e) => handlePointerUp(e, pageNum)}
        >
          <svg
            className="w-full h-full pointer-events-none"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: `${100 / scale}%`,
              height: `${100 / scale}%`,
            }}
          >
            {(annotations[pageNum] || []).map(renderStroke)}
            {currentStroke &&
              currentStroke.points &&
              currentStroke.points.length > 0 &&
              renderStroke(currentStroke)}
          </svg>
        </div>
      )}
    </div>
  );
}

interface PdfViewerProps {
  initialPdfId?: string | null;
}

export function PdfViewer({ initialPdfId }: PdfViewerProps = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [renderScale, setRenderScale] = useState<number>(1.2);

  // Debounced scale update to avoid constant heavy re-rendering during active zoom actions
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderScale(scale);
    }, 350);
    return () => clearTimeout(timer);
  }, [scale]);

  const [theme, setTheme] = useState<Theme>("normal");
  const [isDragging, setIsDragging] = useState(false);
  const [isFitToWidth, setIsFitToWidth] = useState(false);

  const handleFitToWidth = () => {
    if (!scrollContainerRef.current) return;
    // Assuming a standard A4 page is roughly 595.28 points wide
    // We get the container width, subtract some padding, and calculate the scale
    const containerWidth = scrollContainerRef.current.clientWidth;
    const padding = 64; // 32px padding on each side (p-8)
    const availableWidth = containerWidth - padding;

    // A standard PDF page width is around 600px at scale 1
    const newScale = availableWidth / 600;

    setScale(Math.min(Math.max(newScale, 0.5), 3));
    setIsFitToWidth(true);
  };

  // Reset fit to width if user manually zooms
  useEffect(() => {
    setIsFitToWidth(false);
  }, [scale]);
  const [pageInput, setPageInput] = useState<string>("1");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [recentSessions, setRecentSessions] = useState<PdfSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Lazy loading state for holding original page dimensions
  const [pageSizes, setPageSizes] = useState<{
    [pageNum: number]: { width: number; height: number };
  }>({});

  useEffect(() => {
    setPageSizes({});
  }, [file]);

  // Timer State
  const [timerMinutes, setTimerMinutes] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Drawing State
  const [tool, setTool] = useState<Tool>("none");
  const [penColor, setPenColor] = useState<string>("#ef4444");
  const [penSize, setPenSize] = useState<number>(3);
  const [highlightColor, setHighlightColor] = useState<string>("#fde047");
  const [highlightSize, setHighlightSize] = useState<number>(16);
  const [activePopover, setActivePopover] = useState<
    "pen" | "highlight" | "geometry" | null
  >(null);

  useEffect(() => {
    const handleGlobalClick = (e: PointerEvent) => {
      // Find if we clicked outside the toolbar
      const target = e.target as HTMLElement;
      if (!target.closest(".drawing-tools-container")) {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      document.addEventListener("pointerdown", handleGlobalClick);
    }
    return () => document.removeEventListener("pointerdown", handleGlobalClick);
  }, [activePopover]);

  const [annotations, setAnnotations] = useState<{ [page: number]: Stroke[] }>(
    {},
  );
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  // Snip State
  const [isSnipping, setIsSnipping] = useState(false);
  const [snipStart, setSnipStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [snipCurrent, setSnipCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [capturedSnip, setCapturedSnip] = useState<string | null>(null);
  const [isSavingSnip, setIsSavingSnip] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load session on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await getAllPdfSessions();
        // Sort descending by lastOpened
        sessions.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
        setRecentSessions(sessions);

        if (initialPdfId) {
          const sessionToLoad = sessions.find((s) => s.id === initialPdfId);
          if (sessionToLoad) {
            loadPdfSession(sessionToLoad);
          }
        }
      } catch (error) {
        console.error("Failed to load PDF sessions:", error);
      } finally {
        setIsLoadingSession(false);
      }
    };
    loadSessions();
  }, [initialPdfId]);

  const initialPageRef = useRef<number>(1);

  const loadPdfSession = async (session: PdfSession) => {
    try {
      setIsLoadingSession(true);
      const fullSession = await getPdfSession(session.id);
      if (fullSession && fullSession.fileData) {
        const blob = new Blob([fullSession.fileData], {
          type: fullSession.fileType,
        });
        const restoredFile = new File([blob], fullSession.fileName, {
          type: fullSession.fileType,
        });
        setFile(restoredFile);
        setPageNumber(fullSession.pageNumber);
        initialPageRef.current = fullSession.pageNumber;
        setPageInput(fullSession.pageNumber.toString());
        setScale(fullSession.scale || 1.2);
        setTheme((fullSession.theme as Theme) || "normal");
        setTimerMinutes(fullSession.timerMinutes || 60);
        setTimeLeft(fullSession.timeLeft || 60 * 60);
        setCurrentSessionId(fullSession.id);

        getPdfAnnotations(fullSession.id).then((ann) => {
          if (ann) setAnnotations(ann);
          else setAnnotations({});
        });
      }
    } catch (error) {
      console.error("Failed to load PDF session:", error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await clearPdfSession(id);
      setRecentSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  // Save session on changes
  useEffect(() => {
    if (!file || !currentSessionId) return;

    const saveSession = async () => {
      try {
        const existingSession = await getPdfSession(currentSessionId);
        let fileData = existingSession?.fileData;

        if (!fileData || existingSession?.fileName !== file.name) {
          fileData = await file.arrayBuffer();
        }

        const session: PdfSession = {
          ...(existingSession || {}),
          id: currentSessionId,
          fileData,
          fileName: file.name,
          fileType: file.type,
          pageNumber,
          scale,
          theme,
          timerMinutes,
          timeLeft,
          lastOpened: Date.now(),
        };
        await savePdfSession(session);
      } catch (error) {
        console.error("Failed to save PDF session:", error);
      }
    };

    const timeoutId = setTimeout(saveSession, 1000);
    return () => clearTimeout(timeoutId);
  }, [
    file,
    pageNumber,
    scale,
    theme,
    timerMinutes,
    timeLeft,
    currentSessionId,
  ]);

  useEffect(() => {
    if (!currentSessionId) return;
    getPdfAnnotations(currentSessionId).then((ann) => {
      if (ann) setAnnotations(ann);
      else setAnnotations({});
    });
  }, [currentSessionId]);

  // Save annotations on changes
  useEffect(() => {
    if (!currentSessionId) return;
    const timeoutId = setTimeout(() => {
      savePdfAnnotations(currentSessionId, annotations);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [annotations, currentSessionId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (navigator.vibrate) {
              navigator.vibrate(500);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!file) return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Pagination Keys
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setPageNumber((p) => {
          const next = Math.min(p + 1, numPages);
          setPageInput(next.toString());
          window.requestAnimationFrame(() => {
            const pageNode = pageRefs.current[next - 1];
            if (pageNode)
              pageNode.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return next;
        });
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPageNumber((p) => {
          const prev = Math.max(p - 1, 1);
          setPageInput(prev.toString());
          window.requestAnimationFrame(() => {
            const pageNode = pageRefs.current[prev - 1];
            if (pageNode)
              pageNode.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return prev;
        });
      } else if (e.key === "End") {
        e.preventDefault();
        setPageNumber(() => {
          setPageInput(numPages.toString());
          window.requestAnimationFrame(() => {
            const pageNode = pageRefs.current[numPages - 1];
            if (pageNode)
              pageNode.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return numPages;
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        setPageNumber(() => {
          setPageInput("1");
          window.requestAnimationFrame(() => {
            const pageNode = pageRefs.current[0];
            if (pageNode)
              pageNode.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return 1;
        });
      }

      // Zoom
      if (e.ctrlKey && e.key === "=") {
        e.preventDefault();
        setScale((prev) => Math.min(prev + 0.2, 3));
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        setScale((prev) => Math.max(prev - 0.2, 0.5));
      }

      // Alt + T: Toggle Timer
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setIsTimerRunning((prev) => !prev);
      }
      // Alt + R: Reset Timer
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setTimeLeft(timerMinutes * 60);
        setIsTimerRunning(false);
      }
      // Alt + D: Toggle Dark Mode
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setTheme((prev) => (prev === "dark" ? "normal" : "dark"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, timerMinutes, numPages]);

  // Ctrl + Scroll to Zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setScale((prev) => {
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          return Math.min(Math.max(prev + delta, 0.5), 3);
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [file]);

  // Intersection Observer for Page Number
  useEffect(() => {
    if (!file || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageIndex = Number(
              entry.target.getAttribute("data-page-number"),
            );
            if (pageIndex) {
              setPageNumber(pageIndex);
              setPageInput(pageIndex.toString());
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-40% 0px -40% 0px",
      },
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [file, numPages, scale]);

  const scrollToPage = (page: number) => {
    const pageNode = pageRefs.current[page - 1];
    if (pageNode && scrollContainerRef.current) {
      pageNode.scrollIntoView({ behavior: "smooth", block: "start" });
      setPageNumber(page);
      setPageInput(page.toString());
    }
  };

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      scrollToPage(page);
    } else {
      setPageInput(pageNumber.toString());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setPageNumber(1);
      setCurrentSessionId(selectedFile.name + "_" + selectedFile.size);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setPageNumber(1);
      setCurrentSessionId(droppedFile.name + "_" + droppedFile.size);
    }
  };

  const onDocumentLoadSuccess = React.useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      // Use a slight delay to ensure the container is ready for scrolling
      setTimeout(() => {
        if (initialPageRef.current > 1) {
          scrollToPage(initialPageRef.current);
        }
      }, 300);
    },
    [],
  );

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    pageNum: number,
  ) => {
    if (tool === "none") return;
    if (activePopover) {
      setActivePopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (tool === "eraser") {
      eraseStroke(pageNum, x, y);
      return;
    }

    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      type: tool,
      points: [{ x, y }],
      color: tool === "highlight" ? highlightColor : penColor,
      brushSize: tool === "highlight" ? highlightSize : penSize,
    };
    setCurrentStroke(newStroke);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    pageNum: number,
  ) => {
    if (tool === "eraser" && e.buttons === 1) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      eraseStroke(pageNum, x, y);
      return;
    }

    if (!currentStroke || tool === "none" || tool === "eraser") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setCurrentStroke((prev) => {
      if (!prev) return null;
      if (prev.type !== "pen" && prev.type !== "highlight") {
        // Keep only start point and current point
        return { ...prev, points: [prev.points[0], { x, y }] };
      }
      return { ...prev, points: [...prev.points, { x, y }] };
    });
  };

  const handlePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    pageNum: number,
  ) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!currentStroke) return;
    setAnnotations((prev) => ({
      ...prev,
      [pageNum]: [...(prev[pageNum] || []), currentStroke],
    }));
    setCurrentStroke(null);
  };

  const distSq = (v: Point, w: Point) => (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  const distToSegmentSq = (p: Point, v: Point, w: Point) => {
    const l2 = distSq(v, w);
    if (l2 === 0) return distSq(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return distSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
  };

  const isPointNearStroke = (
    x: number,
    y: number,
    stroke: Stroke,
    threshold: number,
  ) => {
    const p = { x, y };
    const threshSq = threshold * threshold;

    if (stroke.points.length < 2) {
      return stroke.points.some((pt) => distSq(pt, p) <= threshSq);
    }

    if (
      stroke.type === "pen" ||
      stroke.type === "highlight" ||
      stroke.type === "eraser"
    ) {
      for (let i = 0; i < stroke.points.length - 1; i++) {
        if (
          distToSegmentSq(p, stroke.points[i], stroke.points[i + 1]) <= threshSq
        )
          return true;
      }
      return false;
    }

    const p1 = stroke.points[0];
    const p2 = stroke.points[stroke.points.length - 1];

    if (stroke.type === "rectangle") {
      const c1 = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
      const c2 = { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
      const c3 = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
      const c4 = { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
      return (
        distToSegmentSq(p, c1, c2) <= threshSq ||
        distToSegmentSq(p, c2, c3) <= threshSq ||
        distToSegmentSq(p, c3, c4) <= threshSq ||
        distToSegmentSq(p, c4, c1) <= threshSq
      );
    }

    if (stroke.type === "circle") {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      if (rx === 0 || ry === 0) return distToSegmentSq(p, p1, p2) <= threshSq;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(1 - dist) * Math.min(rx, ry) <= threshold;
    }

    if (
      stroke.type === "line" ||
      stroke.type === "dotted-line" ||
      stroke.type === "arrow"
    ) {
      return distToSegmentSq(p, p1, p2) <= threshSq;
    }

    return false;
  };

  const eraseStroke = (pageNum: number, x: number, y: number) => {
    setAnnotations((prev) => {
      const pageStrokes = prev[pageNum] || [];
      const threshold = 10;
      const newStrokes = pageStrokes.filter((stroke) => {
        return !isPointNearStroke(x, y, stroke, threshold);
      });
      if (newStrokes.length === pageStrokes.length) return prev;
      return { ...prev, [pageNum]: newStrokes };
    });
  };

  const renderStroke = (stroke: Stroke) => {
    if (stroke.points.length === 0) return null;

    if (
      stroke.type !== "pen" &&
      stroke.type !== "highlight" &&
      stroke.type !== "eraser" &&
      stroke.points.length > 1
    ) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[stroke.points.length - 1];

      if (stroke.type === "rectangle") {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        return (
          <rect
            key={stroke.id}
            x={x}
            y={y}
            width={w}
            height={h}
            stroke={stroke.color}
            strokeWidth={stroke.brushSize}
            fill="none"
          />
        );
      }
      if (stroke.type === "circle") {
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const rx = Math.abs(p2.x - p1.x) / 2;
        const ry = Math.abs(p2.y - p1.y) / 2;
        return (
          <ellipse
            key={stroke.id}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            stroke={stroke.color}
            strokeWidth={stroke.brushSize}
            fill="none"
          />
        );
      }
      if (
        stroke.type === "line" ||
        stroke.type === "dotted-line" ||
        stroke.type === "arrow"
      ) {
        return (
          <g key={stroke.id}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={stroke.color}
              strokeWidth={stroke.brushSize}
              strokeDasharray={stroke.type === "dotted-line" ? "5,5" : "none"}
            />
            {stroke.type === "arrow" && (
              <polygon
                points={`0,-${stroke.brushSize * 1.5} ${stroke.brushSize * 3},0 0,${stroke.brushSize * 1.5}`}
                fill={stroke.color}
                transform={`translate(${p2.x}, ${p2.y}) rotate(${(Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI})`}
              />
            )}
          </g>
        );
      }
    }

    let pathData = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
    if (stroke.points.length === 1) {
      pathData += ` L ${stroke.points[0].x} ${stroke.points[0].y}`;
    } else {
      pathData +=
        " " +
        stroke.points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ");
    }

    return (
      <path
        key={stroke.id}
        d={pathData}
        stroke={stroke.color}
        strokeWidth={stroke.brushSize}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={stroke.type === "highlight" ? 0.4 : 1}
        className={
          stroke.type === "highlight"
            ? "mix-blend-multiply dark:mix-blend-screen"
            : ""
        }
      />
    );
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getThemeFilter = () => {
    switch (theme) {
      case "dark":
        return "invert(1) hue-rotate(180deg) contrast(100%) brightness(100%)";
      case "sepia":
        return "sepia(1) brightness(0.9) contrast(0.9)";
      case "warm":
        return "sepia(0.4) hue-rotate(-15deg) brightness(0.95)";
      default:
        return "none";
    }
  };

  const setPresetTimer = (minutes: number) => {
    setTimerMinutes(minutes);
    setTimeLeft(minutes * 60);
    setIsSettingsOpen(false);
    setIsTimerRunning(false);
  };

  const renderPdfContent = () => (
    <Document
      file={file}
      onLoadSuccess={onDocumentLoadSuccess}
      loading={
        <div className="flex items-center justify-center h-64 text-neutral-400">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p>Loading PDF...</p>
          </div>
        </div>
      }
      error={
        <div className="flex items-center justify-center h-64 text-red-400 bg-red-950/20 px-8 rounded-xl border border-red-900/50">
          Failed to load PDF. Please try another file.
        </div>
      }
    >
      {Array.from(new Array(numPages), (el, index) => {
        const pageNum = index + 1;

        // Compute dynamic height and width using registered loaded pages, or fallback
        const pageHeight = (() => {
          if (pageSizes[pageNum]) return pageSizes[pageNum].height * scale;
          const loadedKeys = Object.keys(pageSizes);
          if (loadedKeys.length > 0) {
            return pageSizes[Number(loadedKeys[0])].height * scale;
          }
          return 842 * scale; // Standard A4 height
        })();

        const pageWidth = (() => {
          if (pageSizes[pageNum]) return pageSizes[pageNum].width * scale;
          const loadedKeys = Object.keys(pageSizes);
          if (loadedKeys.length > 0) {
            return pageSizes[Number(loadedKeys[0])].width * scale;
          }
          return 595 * scale; // Standard A4 width
        })();

        return (
          <PdfPageWrapper
            key={`page_${pageNum}`}
            pageNum={pageNum}
            scale={scale}
            renderScale={renderScale}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            pageSizes={pageSizes}
            tool={tool}
            handlePointerDown={handlePointerDown}
            handlePointerMove={handlePointerMove}
            handlePointerUp={handlePointerUp}
            annotations={annotations}
            currentStroke={currentStroke}
            renderStroke={renderStroke}
            setPageSizes={setPageSizes}
            refCallback={(el) => (pageRefs.current[index] = el)}
          />
        );
      })}
    </Document>
  );

  if (isLoadingSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-neutral-400 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p>Loading recent PDFs...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 p-6 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Book className="w-6 h-6 text-blue-500" />
            Focus PDF Reader
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Eye-friendly PDF viewer with built-in timer. No more Chrome blocks.
          </p>
        </header>

        <div className="max-w-4xl mx-auto w-full flex flex-col gap-8">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 py-16",
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/50",
            )}
          >
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Drop your PDF here</h3>
            <p className="text-neutral-500 text-sm mb-6">
              or click to browse files
            </p>

            <div className="flex gap-4 text-xs text-neutral-400">
              <span className="flex items-center gap-1">
                <Moon className="w-3 h-3" /> Dark Mode
              </span>
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" /> Pomodoro Timer
              </span>
            </div>

            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          {recentSessions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-neutral-400" />
                Recent PDFs
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer flex flex-col"
                    onClick={() => loadPdfSession(session)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Book className="w-5 h-5 text-blue-500 shrink-0" />
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition-all rounded"
                        title="Remove from history"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4
                      className="font-medium text-sm line-clamp-2 mb-1"
                      title={session.fileName}
                    >
                      {session.fileName}
                    </h4>
                    <div className="mt-auto pt-3 flex items-center justify-between text-xs text-neutral-500">
                      <span>Page {session.pageNumber}</span>
                      {session.lastOpened && (
                        <span>
                          {new Date(session.lastOpened).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-neutral-900 relative overflow-hidden transition-all duration-300 flex-1 h-full">
      {/* Top Toolbar */}
      <div className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-2 sm:px-4 shrink-0 relative z-50 shadow-md">
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          {/* Snip Action */}
          <button
            onClick={() => {
              setIsSnipping(true);
              setSnipStart(null);
              setSnipCurrent(null);
            }}
            className="p-1.5 text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-1.5 border border-blue-900/50"
            title="Snip screen"
          >
            <Scissors className="w-4 h-4" />
            <span className="text-xs font-bold px-1 hidden sm:inline">
              Snip
            </span>
          </button>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          {/* Theme Controls */}
          <div className="hidden md:flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() =>
                setTheme((prev) =>
                  prev === "normal"
                    ? "dark"
                    : prev === "dark"
                      ? "sepia"
                      : prev === "sepia"
                        ? "warm"
                        : "normal",
                )
              }
              className="p-1.5 rounded-md transition-colors text-neutral-400 hover:text-white"
              title="Toggle Theme"
            >
              {theme === "normal" ? (
                <Sun className="w-4 h-4" />
              ) : theme === "dark" ? (
                <Moon className="w-4 h-4" />
              ) : theme === "sepia" ? (
                <Coffee className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4 text-orange-400" />
              )}
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          {/* Drawing Tools */}
          <div className="drawing-tools-container relative flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => {
                if (tool === "pen")
                  setActivePopover(activePopover === "pen" ? null : "pen");
                else {
                  setTool("pen");
                  setActivePopover(null);
                }
              }}
              className={cn(
                "p-1.5 flex-shrink-0 rounded-md transition-colors relative",
                tool === "pen"
                  ? "bg-red-500/20 text-red-500 border border-red-500/50"
                  : "text-neutral-400 hover:text-white",
              )}
              title="Pen Tool"
            >
              <Pen className="w-4 h-4" />
              {tool === "pen" && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
              )}
            </button>
            <button
              onClick={() => {
                if (tool === "highlight")
                  setActivePopover(
                    activePopover === "highlight" ? null : "highlight",
                  );
                else {
                  setTool("highlight");
                  setActivePopover(null);
                }
              }}
              className={cn(
                "p-1.5 flex-shrink-0 rounded-md transition-colors relative",
                tool === "highlight"
                  ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50"
                  : "text-neutral-400 hover:text-white",
              )}
              title="Highlighter"
            >
              <Highlighter className="w-4 h-4" />
              {tool === "highlight" && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-500" />
              )}
            </button>
            <button
              onClick={() => {
                if (
                  [
                    "circle",
                    "rectangle",
                    "line",
                    "dotted-line",
                    "arrow",
                  ].includes(tool)
                ) {
                  setActivePopover(
                    activePopover === "geometry" ? null : "geometry",
                  );
                } else {
                  setTool("circle");
                  setActivePopover(null);
                }
              }}
              className={cn(
                "p-1.5 flex-shrink-0 rounded-md transition-colors relative",
                [
                  "circle",
                  "rectangle",
                  "line",
                  "dotted-line",
                  "arrow",
                ].includes(tool)
                  ? "bg-blue-500/20 text-blue-500 border border-blue-500/50"
                  : "text-neutral-400 hover:text-white",
              )}
              title="Geometry Tool"
            >
              <Shapes className="w-4 h-4" />
              {["circle", "rectangle", "line", "dotted-line", "arrow"].includes(
                tool,
              ) && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
            <button
              onClick={() => {
                setTool(tool === "eraser" ? "none" : "eraser");
                setActivePopover(null);
              }}
              className={cn(
                "p-1.5 flex-shrink-0 rounded-md transition-colors",
                tool === "eraser"
                  ? "bg-white text-black"
                  : "text-neutral-400 hover:text-white",
              )}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>

            {/* Config Popover */}
            {activePopover && activePopover !== "geometry" && (
              <div className="absolute top-[120%] left-0 z-50 bg-neutral-900 border border-neutral-700 p-3 rounded-lg shadow-xl shadow-black/50 flex flex-col gap-3 min-w-[200px] sm:min-w-[280px]">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 font-medium">
                    Size
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={activePopover === "pen" ? penSize : highlightSize}
                    onChange={(e) =>
                      activePopover === "pen"
                        ? setPenSize(Number(e.target.value))
                        : setHighlightSize(Number(e.target.value))
                    }
                    className="flex-1 accent-white"
                  />
                  <span className="text-xs text-neutral-400 font-medium w-4 text-right">
                    {activePopover === "pen" ? penSize : highlightSize}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    "#ef4444",
                    "#3b82f6",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ec4899",
                    "#06b6d4",
                    "#84cc16",
                    "#ffffff",
                    "#a3a3a3",
                    "#525252",
                    "#000000",
                  ].map((c) => {
                    const isSelected =
                      activePopover === "pen"
                        ? penColor === c
                        : highlightColor === c;
                    return (
                      <button
                        key={c}
                        onClick={() =>
                          activePopover === "pen"
                            ? setPenColor(c)
                            : setHighlightColor(c)
                        }
                        className="w-10 h-10 flex items-center justify-center p-0 m-0 relative"
                        title={c}
                      >
                        <div
                          className={cn(
                            "w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-transform hover:scale-110 border border-white/10",
                            isSelected
                              ? "scale-125 ring-2 ring-white shadow-lg"
                              : "",
                          )}
                          style={{
                            backgroundColor:
                              c === "#000000" && theme === "dark"
                                ? "#000000"
                                : c,
                          }}
                        >
                          {c === "#000000" && (
                            <div className="w-full h-full bg-neutral-900/50 rounded-full" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Geometry Popover */}
            {activePopover === "geometry" && (
              <div className="absolute top-[120%] left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-700 p-2 rounded-lg shadow-xl shadow-black/50 grid grid-cols-5 gap-1">
                {[
                  { t: "circle", icon: <Circle className="w-4 h-4" /> },
                  { t: "rectangle", icon: <Square className="w-4 h-4" /> },
                  { t: "line", icon: <Minus className="w-4 h-4 -rotate-45" /> },
                  {
                    t: "dotted-line",
                    icon: (
                      <div className="w-4 h-0 border-b-2 border-dotted border-current -rotate-45" />
                    ),
                  },
                  {
                    t: "arrow",
                    icon: <ArrowRight className="w-4 h-4 -rotate-45" />,
                  },
                ].map((shape) => (
                  <button
                    key={shape.t}
                    onClick={() => {
                      setTool(shape.t as Tool);
                      setActivePopover(null);
                    }}
                    className={cn(
                      "p-2 rounded-md hover:bg-neutral-800 transition-colors flex items-center justify-center",
                      tool === shape.t
                        ? "bg-blue-500/20 text-blue-500"
                        : "text-neutral-400",
                    )}
                    title={shape.t}
                  >
                    {shape.icon}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Pagination Controls */}
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => scrollToPage(Math.max(pageNumber - 1, 1))}
              disabled={pageNumber <= 1}
              className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <form onSubmit={handlePageSubmit} className="flex items-center">
              <input
                type="text"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageSubmit}
                className="w-8 sm:w-10 bg-neutral-950 border border-neutral-700 rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs font-medium text-neutral-400 ml-1 min-w-[2rem]">
                / {numPages || "-"}
              </span>
            </form>
            <button
              onClick={() => scrollToPage(Math.min(pageNumber + 1, numPages))}
              disabled={pageNumber >= numPages}
              className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Zoom, Timer & Zen Mode */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end relative">
          {/* Zoom Controls */}
          <div className="hidden lg:flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.5))}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-neutral-400 w-9 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((prev) => Math.min(prev + 0.2, 3))}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-neutral-800 mx-1" />
            <button
              onClick={handleFitToWidth}
              className={cn(
                "p-1.5 rounded transition-colors text-xs font-medium",
                isFitToWidth
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-white",
              )}
              title="Fit to Width"
            >
              Fit
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <div
              className={cn(
                "px-2 sm:px-3 py-1 font-mono text-sm sm:text-lg font-bold tracking-wider",
                timeLeft < 300 ? "text-red-500" : "text-white",
              )}
            >
              {formatTime(timeLeft)}
            </div>
            <div className="w-px h-4 bg-neutral-800 mx-0.5 sm:mx-1" />
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
              title="Play/Pause (Alt+T)"
            >
              {isTimerRunning ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={cn(
                "p-1.5 transition-colors hidden sm:block",
                isSettingsOpen
                  ? "text-white bg-neutral-800 rounded"
                  : "text-neutral-400 hover:text-white",
              )}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Settings Panel */}
          {isSettingsOpen && (
            <div className="absolute top-12 right-0 z-50 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <h3 className="text-sm font-bold text-white">
                  Viewer Settings
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">
                    Default Zoom
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="10"
                      value={scale * 100}
                      onChange={(e) => setScale(parseInt(e.target.value) / 100)}
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-xs text-neutral-300 w-8">
                      {Math.round(scale * 100)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">
                    Theme
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as Theme)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="normal">Normal (White)</option>
                    <option value="dark">Dark Mode</option>
                    <option value="sepia">Sepia</option>
                    <option value="warm">Warm</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-neutral-400 block mb-1">
                    Timer Duration (min)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setPresetTimer(25)}
                      className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                    >
                      25m
                    </button>
                    <button
                      onClick={() => setPresetTimer(50)}
                      className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                    >
                      50m
                    </button>
                    <button
                      onClick={() => setPresetTimer(60)}
                      className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                    >
                      60m
                    </button>
                  </div>
                  <input
                    type="number"
                    value={timerMinutes}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setTimerMinutes(val);
                      setTimeLeft(val * 60);
                      setIsTimerRunning(false);
                    }}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 relative bg-black overflow-y-auto flex flex-col items-center p-8"
      >
        <div
          className="transition-all duration-300"
          style={{ filter: getThemeFilter() }}
        >
          {renderPdfContent()}
        </div>
      </div>

      {/* Snipping Overlay */}
      {isSnipping && (
        <div
          className="fixed inset-0 z-[100] cursor-crosshair bg-black/10"
          onMouseDown={(e) => {
            setSnipStart({ x: e.clientX, y: e.clientY });
            setSnipCurrent({ x: e.clientX, y: e.clientY });
          }}
          onMouseMove={(e) => {
            if (snipStart) {
              setSnipCurrent({ x: e.clientX, y: e.clientY });
            }
          }}
          onMouseUp={async () => {
            if (!snipStart || !snipCurrent) {
              setIsSnipping(false);
              return;
            }
            const x = Math.min(snipStart.x, snipCurrent.x);
            const y = Math.min(snipStart.y, snipCurrent.y);
            const w = Math.abs(snipStart.x - snipCurrent.x);
            const h = Math.abs(snipStart.y - snipCurrent.y);

            setSnipStart(null);
            setSnipCurrent(null);
            setIsSnipping(false);

            if (w > 10 && h > 10) {
              try {
                toast.loading("Capturing snip...", { id: "snip" });

                // Ensure a minimum DPR of 2 for high quality, but avoid absurdly large values
                const dpr = Math.max(2, window.devicePixelRatio || 1);

                const cropCanvas = document.createElement("canvas");
                cropCanvas.width = w * dpr;
                cropCanvas.height = h * dpr;
                const ctx = cropCanvas.getContext("2d");

                if (ctx) {
                  // White background default
                  ctx.fillStyle = theme === "normal" ? "#ffffff" : "#1e1e1e";
                  ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

                  // Apply current theme filter so the snip matches what the user sees
                  const filter = getThemeFilter();
                  if (filter !== "none") {
                    ctx.filter = filter;
                  }

                  const canvases =
                    scrollContainerRef.current?.querySelectorAll("canvas") ||
                    [];
                  canvases.forEach((canvas) => {
                    const rect = canvas.getBoundingClientRect();
                    const cropRect = {
                      left: x,
                      top: y,
                      right: x + w,
                      bottom: y + h,
                    };

                    const intersection = {
                      left: Math.max(rect.left, cropRect.left),
                      top: Math.max(rect.top, cropRect.top),
                      right: Math.min(rect.right, cropRect.right),
                      bottom: Math.min(rect.bottom, cropRect.bottom),
                    };

                    if (
                      intersection.left < intersection.right &&
                      intersection.top < intersection.bottom
                    ) {
                      const srcX =
                        (intersection.left - rect.left) *
                        (canvas.width / rect.width);
                      const srcY =
                        (intersection.top - rect.top) *
                        (canvas.height / rect.height);
                      const srcW =
                        (intersection.right - intersection.left) *
                        (canvas.width / rect.width);
                      const srcH =
                        (intersection.bottom - intersection.top) *
                        (canvas.height / rect.height);

                      const destX = (intersection.left - cropRect.left) * dpr;
                      const destY = (intersection.top - cropRect.top) * dpr;
                      const destW =
                        (intersection.right - intersection.left) * dpr;
                      const destH =
                        (intersection.bottom - intersection.top) * dpr;

                      ctx.drawImage(
                        canvas,
                        srcX,
                        srcY,
                        srcW,
                        srcH,
                        destX,
                        destY,
                        destW,
                        destH,
                      );
                    }
                  });

                  // Rest of the data URL processing
                  let dataUrl = cropCanvas.toDataURL("image/png");

                  // Firestore limits documents to 1MB. Base64 is ~33% larger than binary.
                  // 1MB * 1.33 ≈ 1.38M chars. We use 1.3M as the absolute safety threshold.
                  if (dataUrl.length > 1300000) {
                    // Fallback to high-quality JPEG if PNG is too large
                    dataUrl = cropCanvas.toDataURL("image/jpeg", 0.9);
                  }
                  if (dataUrl.length > 1300000) {
                    // Fallback to lower-quality JPEG if still too large
                    dataUrl = cropCanvas.toDataURL("image/jpeg", 0.75);
                  }

                  setCapturedSnip(dataUrl);
                  toast.success("Area captured!", { id: "snip" });
                } else {
                  throw new Error("Could not get canvas context");
                }
              } catch (e) {
                console.error(e);
                toast.error("Failed to capture snip", { id: "snip" });
              }
            } else {
              toast.error("Selection too small", { id: "snip" });
            }
          }}
        >
          {snipStart && snipCurrent && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/20"
              style={{
                left: Math.min(snipStart.x, snipCurrent.x),
                top: Math.min(snipStart.y, snipCurrent.y),
                width: Math.abs(snipStart.x - snipCurrent.x),
                height: Math.abs(snipStart.y - snipCurrent.y),
              }}
            />
          )}
        </div>
      )}

      {/* Captured Snip Modal */}
      {capturedSnip && (
        <PasteModal
          imageUrl={capturedSnip}
          onClose={() => setCapturedSnip(null)}
          onSave={async (
            subject,
            chapter,
            tags,
            notes,
            isUncategorized,
            croppedImageUrl,
          ) => {
            setIsSavingSnip(true);
            try {
              await addQuestion({
                id: crypto.randomUUID(),
                imageBase64: croppedImageUrl || capturedSnip,
                subject: (subject as Subject) || "",
                chapter: chapter,
                timestamp: Date.now(),
                tags: tags,
                notes: notes,
                isUncategorized: isUncategorized || false,
                reviewStage: 0,
                nextReviewDate: Date.now() + 24 * 60 * 60 * 1000,
              });
              toast.success(
                isUncategorized ? "Saved to Inbox!" : "Saved successfully!",
              );
              setCapturedSnip(null);
            } catch (e) {
              toast.error("Failed to save");
            } finally {
              setIsSavingSnip(false);
            }
          }}
        />
      )}
    </div>
  );
}
