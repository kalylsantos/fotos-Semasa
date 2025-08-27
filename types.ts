export enum AppState {
  HOME,
  SCANNING,
  CAPTURE_PHOTO,
  REPORTS,
}

export interface PhotoRecord {
  id?: number;
  taskCode: string;
  filename: string;
  timestamp: string;
  data: string; // In React Native, this will be the file path, not a Blob
  latitude?: number;
  longitude?: number;
  deviceId: string;
}

export interface TaskReport {
    taskCode: string;
    photoCount: number;
}
