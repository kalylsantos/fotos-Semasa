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
  data: Blob;
}

export interface TaskReport {
    taskCode: string;
    photoCount: number;
    photos?: PhotoRecord[]; // Photos are not needed for the summary list, only for export
}
