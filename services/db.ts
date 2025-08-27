import { PhotoRecord, TaskReport } from '../types';

// =================================================================================
// IMPORTANT: This is a placeholder file.
// IndexedDB is a browser API and does not exist in React Native.
// You must replace this implementation with a proper native database solution.
// Recommended libraries: WatermelonDB (for complex relational data) or Realm.
// =================================================================================

export function initDB() {
  console.warn("Database not implemented. Using mock data.");
  // In a real app, you would initialize your WatermelonDB or Realm connection here.
}

export async function addPhoto(photo: PhotoRecord): Promise<void> {
  console.log('Mock DB: Adding photo', photo.filename);
  // In a real app:
  // const db = getDB();
  // await db.write(async () => {
  //   await db.collections.get('photos').create(p => {
  //     p.taskCode = photo.taskCode;
  //     p.filename = photo.filename;
  //     p.timestamp = photo.timestamp;
  //     p.path = photo.data; // Store path, not blob
  //     p.deviceId = photo.deviceId;
  //     p.latitude = photo.latitude;
  //     p.longitude = photo.longitude;
  //   });
  // });
  return Promise.resolve();
}

export async function getPhotosForReport(date: string): Promise<PhotoRecord[]> {
    console.warn("getPhotosForReport is not implemented. Returning empty array.");
    // In a real app, you would query your database for records within the date range.
    return Promise.resolve([]);
}

export async function getDailyReport(date: string): Promise<TaskReport[]> {
  console.warn("getDailyReport is not implemented. Returning empty array.");
  // In a real app, you would perform an aggregation query on your database.
  return Promise.resolve([]);
}
