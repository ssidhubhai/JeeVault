import { auth, db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, writeBatch, limit } from 'firebase/firestore';
import { openDB, IDBPDatabase } from 'idb';

export interface PdfSession {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileData?: ArrayBuffer;
  fileType?: string;
  subject?: string;
  chapter?: string;
  boxName?: string;
  orderIndex?: number;
  deletedAt?: number;
  pageNumber: number;
  scale?: number;
  theme?: string;
  timerMinutes?: number;
  timeLeft?: number;
  lastOpened?: number;
}

export interface Question {
  id: string;
  imageBase64: string; 
  subject: string;
  chapter: string;
  timestamp: number;
  isSolved?: boolean;
  tags?: string[];
  notes?: string;
  timeTaken?: number;
  confidence?: 'High' | 'Medium' | 'Low';
  nextReviewDate?: number;
  reviewStage?: number;
  isUncategorized?: boolean;
  isDeleted?: boolean;
  deletedAt?: number;
}

// --- Local DB Setup ---
const DB_NAME = 'StudyAppLocal';
const DB_VERSION = 8; // Bumped version for pdfAnnotations

let localDb: IDBPDatabase | null = null;

const getLocalDB = async () => {
  if (localDb) return localDb;
  localDb = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('dumps')) {
        db.createObjectStore('dumps', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('recycleBin')) {
        db.createObjectStore('recycleBin', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pdfFiles')) {
        db.createObjectStore('pdfFiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('questionMetadata')) {
        db.createObjectStore('questionMetadata', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('dailyPlans')) {
        db.createObjectStore('dailyPlans', { keyPath: 'dateStr' });
      }
      if (!db.objectStoreNames.contains('syllabusProgress')) {
        db.createObjectStore('syllabusProgress', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mockTests')) {
        db.createObjectStore('mockTests', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mistakes')) {
        db.createObjectStore('mistakes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pdfAnnotations')) {
        db.createObjectStore('pdfAnnotations', { keyPath: 'pdfId' });
      }
    },
  });
  return localDb;
};

const getUserId = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
};

// Helper to convert data URL to Blob
const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) throw new Error('Invalid data URL');
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export interface SubjectStat {
  score: number;
  percentile?: number;
  correct: number;
  incorrect: number;
  skipped: number;
}

export interface QuestionStat {
  id: string; // e.g., "P1-Q1" or "M-Q12"
  subject: string; // "Physics", "Chemistry", "Mathematics"
  status: 'Correct' | 'Incorrect' | 'Skipped' | 'Unmarked';
}

export interface TestSubmission {
  id: string;
  name: string;
  timestamp: number;
  type: 'JEE Mains' | 'JEE Advanced';
  category: 'Regular Batch' | 'AITS' | 'Mock Test';
  
  score: number;
  maxScore: number;
  percentile?: number;
  rank?: number;
  testUrl?: string;
  
  physics: SubjectStat;
  chemistry: SubjectStat;
  maths: SubjectStat;
  
  questions: QuestionStat[];
  aiAnalysis?: string;
}

// --- Settings ---
export const getUserTags = async (): Promise<string[]> => {
  try {
    const uid = getUserId();
    const docRef = doc(db, `users/${uid}/settings`, 'tags');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().tags) {
      return snap.data().tags;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      return [];
    }
    console.warn("Could not fetch tags (offline):", error);
  }
  return []; // Return empty, we can fallback to QUICK_TAGS if empty in the UI
};

export const saveUserTags = async (tags: string[]) => {
  const uid = getUserId();
  const docRef = doc(db, `users/${uid}/settings`, 'tags');
  await setDoc(docRef, { tags }, { merge: true });
};

// --- Test Analysis Logic ---
export const addTestSubmission = async (test: TestSubmission) => {
  const uid = getUserId();
  const tData = { ...test, userId: uid };
  await setDoc(doc(db, `users/${uid}/tests`, test.id), tData);
};

export const updateTestSubmission = async (test: TestSubmission) => {
  const uid = getUserId();
  const tData = { ...test, userId: uid };
  await setDoc(doc(db, `users/${uid}/tests`, test.id), tData);
};

export const getTestSubmissions = async (): Promise<TestSubmission[]> => {
  try {
    const uid = getUserId();
    const testsRef = collection(db, `users/${uid}/tests`);
    const q = query(testsRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as TestSubmission);
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      return [];
    }
    throw error;
  }
};

export const deleteTestSubmission = async (id: string) => {
  const uid = getUserId();
  await deleteDoc(doc(db, `users/${uid}/tests`, id));
};

// --- PDF Sessions ---

export const savePdfSession = async (session: PdfSession) => {
  const uid = getUserId();
  const ldb = await getLocalDB();

  // Save the file data locally if it exists
  if (session.fileData) {
    await ldb.put('pdfFiles', {
      id: session.id,
      data: session.fileData,
      type: session.fileType,
      name: session.fileName
    });
  }

  const sessionData: any = {
    id: session.id,
    userId: uid,
    fileName: session.fileName,
    fileType: session.fileType,
    pageNumber: session.pageNumber,
    lastOpened: session.lastOpened || Date.now(),
    orderIndex: session.orderIndex || 0,
  };
  
  if (session.scale !== undefined) sessionData.scale = session.scale;
  if (session.theme !== undefined) sessionData.theme = session.theme;
  if (session.timerMinutes !== undefined) sessionData.timerMinutes = session.timerMinutes;
  if (session.timeLeft !== undefined) sessionData.timeLeft = session.timeLeft;
  if (session.subject !== undefined) sessionData.subject = session.subject;
  if (session.chapter !== undefined) sessionData.chapter = session.chapter;
  if (session.boxName !== undefined) sessionData.boxName = session.boxName;
  if (session.deletedAt !== undefined) sessionData.deletedAt = session.deletedAt;

  await setDoc(doc(db, `users/${uid}/pdf_sessions`, session.id), sessionData, { merge: true });
};

export const getPdfSession = async (id: string): Promise<PdfSession | undefined> => {
  const uid = getUserId();
  const ldb = await getLocalDB();
  
  const docSnap = await getDoc(doc(db, `users/${uid}/pdf_sessions`, id));
  if (docSnap.exists()) {
    const data = docSnap.data() as any;
    const localFile = await ldb.get('pdfFiles', id);
    
    return { 
      ...data, 
      fileData: localFile?.data 
    } as PdfSession;
  }
  return undefined;
};

export const getAllPdfSessions = async (): Promise<PdfSession[]> => {
  const uid = getUserId();
  const q = query(collection(db, `users/${uid}/pdf_sessions`), orderBy('lastOpened', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as PdfSession);
};

export const clearPdfSession = async (id: string) => {
  const uid = getUserId();
  const ldb = await getLocalDB();
  
  await deleteDoc(doc(db, `users/${uid}/pdf_sessions`, id));
  await ldb.delete('pdfFiles', id);
};

export interface ChapterBox {
  id: string;
  name: string;
  orderIndex: number;
}

export const getChapterBoxes = async (subject: string, chapter: string): Promise<ChapterBox[]> => {
  try {
    const uid = getUserId();
    const safeDocId = encodeURIComponent(`${subject}_${chapter}`);
    const docSnap = await getDoc(doc(db, `users/${uid}/chapter_boxes`, safeDocId));
    if (docSnap.exists()) {
      return (docSnap.data().boxes || []) as ChapterBox[];
    }
  } catch (e) {
    console.error('Failed to get chapter boxes', e);
  }
  return [];
};

export const saveChapterBoxes = async (subject: string, chapter: string, boxes: ChapterBox[]) => {
  try {
    const uid = getUserId();
    const safeDocId = encodeURIComponent(`${subject}_${chapter}`);
    await setDoc(doc(db, `users/${uid}/chapter_boxes`, safeDocId), { boxes }, { merge: true });
  } catch (e) {
    console.error('Failed to save chapter boxes', e);
  }
};

export const getPdfRecycleBin = async (): Promise<PdfSession[]> => {
  const uid = getUserId();
  const q = query(collection(db, `users/${uid}/pdf_sessions`), where('deletedAt', '!=', null));
  const querySnapshot = await getDocs(q);
  // because firestore handles '!=' with ordering on the same field, sorting might need to be done in memory
  const docs = querySnapshot.docs.map(doc => doc.data() as PdfSession);
  return docs.filter(d => d.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}

export const restorePdfSession = async (id: string) => {
  const uid = getUserId();
  await setDoc(doc(db, `users/${uid}/pdf_sessions`, id), { deletedAt: null }, { merge: true });
}

export const emptyPdfRecycleBin = async () => {
  const uid = getUserId();
  const q = query(collection(db, `users/${uid}/pdf_sessions`), where('deletedAt', '!=', null));
  const querySnapshot = await getDocs(q);
  const ldb = await getLocalDB();
  
  const batch = writeBatch(db);
  for (const docSnap of querySnapshot.docs) {
    batch.delete(docSnap.ref);
    await ldb.delete('pdfFiles', docSnap.id);
  }
  await batch.commit();
}

export const deleteMultiplePdfsFromRecycleBin = async (ids: string[]) => {
  const uid = getUserId();
  const ldb = await getLocalDB();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.delete(doc(db, `users/${uid}/pdf_sessions`, id));
    await ldb.delete('pdfFiles', id);
  }
  await batch.commit();
}

export const restoreMultiplePdfs = async (ids: string[]) => {
  const uid = getUserId();
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, `users/${uid}/pdf_sessions`, id), { deletedAt: null });
  }
  await batch.commit();
}
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
};

// --- Questions ---

export const addQuestion = async (question: Question) => {
  const uid = getUserId();
  const ldb = await getLocalDB();
  
  const { imageBase64, ...metadata } = question;

  if (question.isUncategorized) {
    // Save locally for quick dump
    await ldb.put('dumps', { ...question, userId: uid });
    return;
  }

  // Save metadata locally for fast counts
  await ldb.put('questionMetadata', { ...metadata, userId: uid });

  const qData = { ...question, userId: uid };
  await setDoc(doc(db, `users/${uid}/questions`, question.id), qData);
};

export const updateQuestion = async (question: Question) => {
  const uid = getUserId();
  const ldb = await getLocalDB();
  
  const { imageBase64, ...metadata } = question;

  // If we are categorizing a local dump
  if (!question.isUncategorized) {
    const localDump = await ldb.get('dumps', question.id);
    if (localDump) {
      // Move to cloud
      await addQuestion(question);
      await ldb.delete('dumps', question.id);
      return;
    }
  }

  // Update metadata locally
  if (!question.isUncategorized) {
    await ldb.put('questionMetadata', { ...metadata, userId: uid });
  }

  const qData = { ...question, userId: uid };
  await setDoc(doc(db, `users/${uid}/questions`, question.id), qData);
};

export const getQuestionsByChapter = async (chapter: string): Promise<Question[]> => {
  const uid = getUserId();
  const q = query(collection(db, `users/${uid}/questions`), where('chapter', '==', chapter));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Question);
};

export const getAllQuestions = async (limitCount?: number): Promise<Question[]> => {
  const uid = getUserId();
  // Cloud questions
  let q = query(collection(db, `users/${uid}/questions`), orderBy('timestamp', 'desc'));
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  const querySnapshot = await getDocs(q);
  const cloudQuestions = querySnapshot.docs.map(doc => doc.data() as Question);

  // Local dumps
  const ldb = await getLocalDB();
  const localDumps = await ldb.getAll('dumps');

  const all = [...localDumps, ...cloudQuestions].sort((a, b) => b.timestamp - a.timestamp);
  return limitCount ? all.slice(0, limitCount) : all;
};

export const getQuestionsCount = async (): Promise<{ total: number, solved: number, inbox: number }> => {
  const uid = getUserId();
  const all = await getAllQuestions(); // This is still slow, but we'll use it for now. 
  // In a real app, we'd use Firestore aggregation queries.
  let total = 0;
  let solved = 0;
  let inbox = 0;
  all.forEach(q => {
    if (q.isUncategorized) inbox++;
    else {
      total++;
      if (q.isSolved) solved++;
    }
  });
  return { total, solved, inbox };
};

export const deleteQuestion = async (id: string, permanent = false) => {
  const uid = getUserId();
  const ldb = await getLocalDB();

  // Remove from metadata cache
  await ldb.delete('questionMetadata', id);

  // Check if it's in dumps
  const dump = await ldb.get('dumps', id);
  if (dump) {
    if (permanent) {
      await ldb.delete('dumps', id);
    } else {
      await ldb.put('recycleBin', { ...dump, isDeleted: true, deletedAt: Date.now() });
      await ldb.delete('dumps', id);
    }
    return;
  }

  // Check if it's in cloud
  const docRef = doc(db, `users/${uid}/questions`, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as Question;
    if (permanent) {
      await deleteDoc(docRef);
    } else {
      await ldb.put('recycleBin', { ...data, isDeleted: true, deletedAt: Date.now() });
      await deleteDoc(docRef);
    }
  }
};

export const restoreQuestion = async (id: string) => {
  const ldb = await getLocalDB();
  try {
    const item = await ldb.get('recycleBin', id);
    if (!item) {
      console.warn(`Item ${id} not found in recycle bin`);
      return;
    }
    
    const { isDeleted, deletedAt, ...question } = item;
    // Restore to main storage
    await addQuestion(question as Question);
    // Remove from recycle bin only after successful restoration
    await ldb.delete('recycleBin', id);
    console.log(`Successfully restored item ${id}`);
  } catch (error) {
    console.error(`Failed to restore item ${id}:`, error);
    throw error;
  }
};

export const getRecycleBin = async (): Promise<Question[]> => {
  const ldb = await getLocalDB();
  return ldb.getAll('recycleBin');
};

export const emptyRecycleBin = async () => {
  const ldb = await getLocalDB();
  try {
    await ldb.clear('recycleBin');
    console.log('Recycle bin cleared successfully');
  } catch (error) {
    console.error('Failed to clear recycle bin:', error);
    throw error;
  }
};

export const deleteFromRecycleBin = async (id: string) => {
  const ldb = await getLocalDB();
  try {
    await ldb.delete('recycleBin', id);
    console.log(`Permanently deleted item ${id} from recycle bin`);
  } catch (error) {
    console.error(`Failed to delete item ${id} from recycle bin:`, error);
    throw error;
  }
};

export const deleteMultipleFromRecycleBin = async (ids: string[]) => {
  const ldb = await getLocalDB();
  const tx = ldb.transaction('recycleBin', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
};

export const deleteQuestions = async (ids: string[]) => {
  for (const id of ids) {
    await deleteQuestion(id);
  }
};

export const getUncategorizedQuestions = async (): Promise<Question[]> => {
  const uid = getUserId();
  // Local dumps are always uncategorized
  const ldb = await getLocalDB();
  const localDumps = await ldb.getAll('dumps');
  
  // Cloud might have some if they were synced but not categorized (rare in current flow but good for safety)
  const q = query(collection(db, `users/${uid}/questions`), where('isUncategorized', '==', true));
  const querySnapshot = await getDocs(q);
  const cloudUncategorized = querySnapshot.docs.map(doc => doc.data() as Question);
  
  return [...localDumps, ...cloudUncategorized].sort((a, b) => b.timestamp - a.timestamp);
};

export const getAllQuestionsMetadata = async (): Promise<Partial<Question>[]> => {
  const ldb = await getLocalDB();
  const localMetadata = await ldb.getAll('questionMetadata');
  const localDumps = await ldb.getAll('dumps');
  
  return [...localDumps, ...localMetadata].sort((a, b) => b.timestamp - a.timestamp);
};

export const syncMetadata = async () => {
  const uid = getUserId();
  const ldb = await getLocalDB();
  
  const q = query(collection(db, `users/${uid}/questions`));
  const querySnapshot = await getDocs(q);
  
  const tx = ldb.transaction('questionMetadata', 'readwrite');
  await tx.store.clear();
  
  for (const doc of querySnapshot.docs) {
    const { imageBase64, ...metadata } = doc.data() as Question;
    await tx.store.put({ ...metadata, userId: uid });
  }
  await tx.done;
};

export const getUniqueChaptersBySubject = async (subject: string): Promise<string[]> => {
  const uid = getUserId();
  const q = query(collection(db, `users/${uid}/questions`), where('subject', '==', subject));
  const querySnapshot = await getDocs(q);
  const chapters = new Set(querySnapshot.docs.map(doc => doc.data().chapter));
  return Array.from(chapters).sort();
};

export interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
  missedReason?: string;
  missedNotes?: string;
  reminderTime?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export interface DailyPlan {
  dateStr: string; // 'YYYY-MM-DD' or 'tomorrow'
  tasks: DailyTask[];
  hoursStudied?: number;
  studyGoalHours?: number;
  notes?: string;
  locked: boolean;
}

export const getDailyPlan = async (dateStr: string): Promise<DailyPlan | undefined> => {
  const ldb = await getLocalDB();
  return ldb.get('dailyPlans', dateStr);
};

export const saveDailyPlan = async (plan: DailyPlan): Promise<void> => {
  const ldb = await getLocalDB();
  await ldb.put('dailyPlans', plan);
};

export const getAllDailyPlans = async (): Promise<DailyPlan[]> => {
  const ldb = await getLocalDB();
  const plans = await ldb.getAll('dailyPlans');
  return plans;
};

export interface ChapterProgress {
  id: string; // "Subject_Chapter"
  subject: string;
  chapter: string;
  lectures: boolean;
  module: boolean;
  mains: boolean;
  adv: boolean;
  notes: boolean;
  revision: boolean;
}

export const getSyllabusProgress = async (): Promise<ChapterProgress[]> => {
  const ldb = await getLocalDB();
  return ldb.getAll('syllabusProgress');
};

export const saveChapterProgress = async (progress: ChapterProgress): Promise<void> => {
  const ldb = await getLocalDB();
  await ldb.put('syllabusProgress', progress);
};

export interface MockTestRecord {
  id: string;
  dateStr: string;
  testName: string;
  totalMarks: number;
  positiveMarks: number;
  negativeMarks: number;
}

export const getMockTests = async (): Promise<MockTestRecord[]> => {
  const ldb = await getLocalDB();
  const tests = await ldb.getAll('mockTests');
  return tests.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
};

export const saveMockTest = async (test: MockTestRecord): Promise<void> => {
  const ldb = await getLocalDB();
  await ldb.put('mockTests', test);
};

export interface MistakeRecord {
  id: string;
  source: string;
  subject: string;
  chapter: string;
  mistakeText: string;
  errorTypes: string[];
  actionItem: string;
  resolved: boolean;
  timestamp: number;
}

export const getMistakes = async (): Promise<MistakeRecord[]> => {
  const ldb = await getLocalDB();
  const mistakes = await ldb.getAll('mistakes');
  return mistakes.sort((a, b) => b.timestamp - a.timestamp);
};

export const saveMistake = async (mistake: MistakeRecord): Promise<void> => {
  const ldb = await getLocalDB();
  await ldb.put('mistakes', mistake);
};

export const deleteMistake = async (id: string): Promise<void> => {
  const ldb = await getLocalDB();
  await ldb.delete('mistakes', id);
};

export const savePdfAnnotations = async (pdfId: string, annotations: any): Promise<void> => {
  const ldb = await getLocalDB();
  await ldb.put('pdfAnnotations', { pdfId, annotations });
};

export const getPdfAnnotations = async (pdfId: string): Promise<any | null> => {
  const ldb = await getLocalDB();
  const record = await ldb.get('pdfAnnotations', pdfId);
  return record ? record.annotations : null;
};

