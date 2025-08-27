import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { PhotoRecord, TaskReport } from '../types';

const DB_NAME = 'TaskPhotoDB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

interface TaskPhotoDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: PhotoRecord;
    indexes: { 'timestamp': string; 'taskCode': string };
  };
}

let dbPromise: Promise<IDBPDatabase<TaskPhotoDB>> | null = null;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<TaskPhotoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('taskCode', 'taskCode');
      },
    });
  }
  return dbPromise;
}

export async function addPhoto(photo: PhotoRecord) {
  const db = await initDB();
  return db.add(STORE_NAME, photo);
}

const getDailyPhotoRange = (date: string) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return IDBKeyRange.bound(startOfDay.toISOString(), endOfDay.toISOString());
}

export async function getPhotosForReport(date: string): Promise<PhotoRecord[]> {
    const db = await initDB();
    const range = getDailyPhotoRange(date);
    return db.getAllFromIndex(STORE_NAME, 'timestamp', range);
}


export async function getDailyReport(date: string): Promise<TaskReport[]> {
  const allPhotos = await getPhotosForReport(date);

  const tasks: { [key: string]: { taskCode: string; photoCount: number } } = {};

  for (const photo of allPhotos) {
    if (!tasks[photo.taskCode]) {
      tasks[photo.taskCode] = {
        taskCode: photo.taskCode,
        photoCount: 0,
      };
    }
    tasks[photo.taskCode].photoCount++;
  }
  
  // Sort by task code for consistent ordering
  const sortedReports = Object.values(tasks).sort((a, b) => a.taskCode.localeCompare(b.taskCode));
  return sortedReports.map(task => ({...task, photos: []})); // photos array is not needed for summary view
}
