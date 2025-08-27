
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, PhotoRecord, TaskReport } from './types';
import { initDB, addPhoto, getDailyReport, getPhotosForReport } from './services/db';
// Fix: Removed NotFoundException as it is not exported from @zxing/browser.
// Will use error name check instead.
import { BrowserMultiFormatReader } from '@zxing/browser';
import JSZip from 'jszip';
import { CameraIcon, BarcodeScannerIcon, PencilSquareIcon, DocumentTextIcon, XMarkIcon } from './components/Icons';

// Initialize the database when the app loads
initDB();

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [taskCode, setTaskCode] = useState<string>('');
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [error, setError] = useState<string>('');
  const [report, setReport] = useState<TaskReport[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isManualEntryOpen, setManualEntryOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReader = useRef(new BrowserMultiFormatReader());
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Fix: Cast to 'any' to bypass a potential TypeScript typing issue where 'reset' is not found.
    // The method is expected to exist at runtime for cleaning up the scanner state.
    (codeReader.current as any).reset();
  }, []);
  
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    if (streamRef.current) return streamRef.current; // Don't restart if already running
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
        });
        videoElement.srcObject = stream;
        streamRef.current = stream;
        await videoElement.play();
        return stream;
    } catch (err) {
        console.error("Camera access error:", err);
        setError("Could not access camera. Please check permissions.");
        setAppState(AppState.HOME);
        return null;
    }
  }, []);


  const handleStartScan = useCallback(async () => {
    setAppState(AppState.SCANNING);
    setError('');
    if (videoRef.current) {
      const stream = await startCamera(videoRef.current);
      if (stream) {
        try {
            // No need to await, decodeFromStream handles the loop
            codeReader.current.decodeFromStream(stream, videoRef.current, (result, err) => {
              // Fix: Refactored logic on successful scan.
              // Instead of calling reset() directly which caused a frozen camera,
              // we now call stopCamera() for proper cleanup before transitioning state.
              if (result) {
                stopCamera();
                setTaskCode(result.getText());
                setPhotos([]);
                setAppState(AppState.CAPTURE_PHOTO);
              }
              // Fix: Check error by its name property as NotFoundException class is not available for import.
              if (err && err.name !== 'NotFoundException') {
                 console.error(err);
              }
            });
        } catch (err) {
            console.error('Scan error:', err);
            if (appState === AppState.SCANNING) { // Only set error if we are still in scanning mode
              setError('Failed to start scanner.');
              setAppState(AppState.HOME);
              stopCamera();
            }
        }
      }
    }
  }, [startCamera, stopCamera, appState]);
  
  const handleManualSubmit = (code: string) => {
      if(code.trim()) {
        setTaskCode(code.trim());
        setPhotos([]);
        setManualEntryOpen(false);
        setAppState(AppState.CAPTURE_PHOTO);
      }
  };


  const handleTakePhoto = useCallback(async () => {
    if (videoRef.current && canvasRef.current && !isCapturing) {
      setIsCapturing(true);
      // Haptic feedback for modern Android devices
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const now = new Date();
        const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        const watermarkText = `${taskCode} | ${timestamp}`;
        
        const fontSize = Math.max(24, Math.floor(canvas.width / 40));
        context.font = `bold ${fontSize}px Inter, sans-serif`;
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        context.lineWidth = 4;
        const x = 20;
        const y = canvas.height - 20;
        context.strokeText(watermarkText, x, y);
        context.fillText(watermarkText, x, y);

        canvas.toBlob(async (blob) => {
          if (blob) {
            const photoIndex = photos.length + 1;
            const filename = `${taskCode}_(${photoIndex}).jpg`;
            const newRecord: PhotoRecord = { taskCode, filename, timestamp: now.toISOString(), data: blob };
            await addPhoto(newRecord);
            setPhotos(prevPhotos => [...prevPhotos, newRecord]);
          }
        }, 'image/jpeg', 0.9);
      }
      setTimeout(() => setIsCapturing(false), 200); // Reset after flash effect
    }
  }, [taskCode, photos, isCapturing]);

  const handleViewReports = useCallback(async () => {
    setAppState(AppState.REPORTS);
    const dailyReport = await getDailyReport(reportDate);
    setReport(dailyReport);
  }, [reportDate]);

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setReportDate(newDate);
    const dailyReport = await getDailyReport(newDate);
    setReport(dailyReport);
  };
  
  const handleExportReport = async () => {
      if (report.length === 0 || isExporting) return;
      setIsExporting(true);
      
      const zip = new JSZip();
      const allPhotosForDay = await getPhotosForReport(reportDate);
      
      const photosByTask: { [taskCode: string]: PhotoRecord[] } = {};
      allPhotosForDay.forEach(photo => {
        if (!photosByTask[photo.taskCode]) {
            photosByTask[photo.taskCode] = [];
        }
        photosByTask[photo.taskCode].push(photo);
      });

      Object.keys(photosByTask).forEach(code => {
          const folder = zip.folder(code);
          photosByTask[code].forEach(photo => {
              folder.file(photo.filename, photo.data);
          });
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const filename = `report_${reportDate}.zip`;

      // Use Web Share API for a native Android experience
      if (navigator.share && navigator.canShare({ files: [new File([zipBlob], filename)] })) {
          try {
              const fileToShare = new File([zipBlob], filename, { type: 'application/zip' });
              await navigator.share({
                  title: `Task Report ${reportDate}`,
                  text: `Attached is the task photo report for ${reportDate}.`,
                  files: [fileToShare],
              });
          } catch (error) {
              console.error('Sharing failed:', error);
          }
      } else {
          // Fallback for browsers/devices that don't support Web Share
          const a = document.createElement('a');
          const url = URL.createObjectURL(zipBlob);
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      }
      setIsExporting(false);
  };

  useEffect(() => {
    if ((appState === AppState.SCANNING || appState === AppState.CAPTURE_PHOTO) && videoRef.current) {
        startCamera(videoRef.current);
    } else {
        stopCamera();
    }
    // Cleanup on unmount
    return () => stopCamera();
  }, [appState, startCamera, stopCamera]);

  const renderScreen = () => {
    switch (appState) {
      case AppState.SCANNING:
        return (
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">Scan Task Barcode</h2>
            <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700">
                <video ref={videoRef} playsInline className="w-full h-full object-cover"></video>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-1/2 border-4 border-dashed border-cyan-400 rounded-lg opacity-75 animate-pulse"></div>
                </div>
            </div>
            <button onClick={() => setAppState(AppState.HOME)} className="mt-4 bg-slate-600 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 mx-auto">
              <XMarkIcon className="w-6 h-6"/> Cancel
            </button>
          </div>
        );
      case AppState.CAPTURE_PHOTO:
        return (
          <div className="flex flex-col h-[80vh] md:h-auto">
            <h2 className="text-xl font-semibold mb-2 text-center flex-shrink-0">Task Code: <span className="text-cyan-400">{taskCode}</span></h2>
            <div className="relative flex-grow aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 mb-4">
                <video ref={videoRef} playsInline className="w-full h-full object-cover"></video>
                {/* Shutter flash effect */}
                <div className={`absolute inset-0 bg-white transition-opacity duration-200 ${isCapturing ? 'opacity-70' : 'opacity-0'}`}></div>
            </div>
            <div className="flex-shrink-0 flex justify-around items-center gap-4">
                <button onClick={() => { setTaskCode(''); setPhotos([]); setAppState(AppState.HOME); }} className="bg-slate-600 text-white font-semibold px-4 py-3 rounded-lg flex items-center gap-2">
                    <XMarkIcon className="w-6 h-6"/> Finish
                </button>
                <button onClick={handleTakePhoto} className="bg-cyan-600 text-white font-bold p-4 rounded-full flex items-center gap-3 text-lg ring-4 ring-cyan-600/50 hover:bg-cyan-500 transition-colors">
                    <CameraIcon className="w-8 h-8"/>
                </button>
                 <div className="text-center font-mono text-lg bg-slate-700/50 rounded-lg px-4 py-2 w-24">
                    <span className="text-slate-400 block text-xs">Photos</span>
                    <span className="text-2xl font-bold">{photos.length}</span>
                 </div>
            </div>
          </div>
        );
      case AppState.REPORTS:
        return (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Daily Report</h2>
                <button onClick={() => setAppState(AppState.HOME)} className="bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <XMarkIcon className="w-5 h-5"/> Close
                </button>
            </div>
            <div className="mb-4">
                <label htmlFor="reportDate" className="block text-sm font-medium text-slate-300 mb-1">Select Date:</label>
                <input type="date" id="reportDate" value={reportDate} onChange={handleDateChange} className="bg-slate-700 border border-slate-600 rounded-lg p-2 w-full max-w-xs" />
            </div>
            {report.length > 0 ? (
                <div className="bg-slate-800 rounded-lg p-4">
                    <ul>
                        {report.map(task => (
                            <li key={task.taskCode} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-b-0">
                                <span className="font-medium">Task Code: <span className="text-cyan-400">{task.taskCode}</span></span>
                                <span className="text-slate-400">{task.photoCount} photo(s)</span>
                            </li>
                        ))}
                    </ul>
                    <button onClick={handleExportReport} disabled={isExporting} className="mt-6 w-full bg-teal-500 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 disabled:bg-teal-800 disabled:cursor-not-allowed">
                        {isExporting ? 'Exporting...' : 'Export & Share Report'}
                    </button>
                </div>
            ) : (
                <p className="text-center text-slate-400 py-8">No tasks recorded for this day.</p>
            )}
          </div>
        );
      default: // HOME
        return (
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight">Task Photo Logger</h1>
            <p className="text-slate-400 mt-2 text-lg mb-8">Log completed tasks with watermarked photos.</p>
            {error && <p className="bg-red-900/50 text-red-300 border border-red-700 rounded-lg p-3 mb-6">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={handleStartScan} className="bg-cyan-600 text-white font-semibold px-6 py-4 rounded-lg flex items-center justify-center gap-3 text-lg">
                    <BarcodeScannerIcon className="w-7 h-7"/> Scan Task Code
                </button>
                <button onClick={() => setManualEntryOpen(true)} className="bg-slate-600 text-white font-semibold px-6 py-4 rounded-lg flex items-center justify-center gap-3 text-lg">
                    <PencilSquareIcon className="w-7 h-7"/> Enter Code Manually
                </button>
            </div>
             <button onClick={handleViewReports} className="mt-6 text-cyan-400 hover:text-cyan-300 font-semibold flex items-center justify-center gap-2 mx-auto">
                <DocumentTextIcon className="w-6 h-6"/> View Daily Reports
            </button>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 lg:p-8 font-sans">
      <div className="w-full max-w-2xl mx-auto bg-slate-800/50 rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-700 backdrop-blur-sm">
        {renderScreen()}
      </div>
      {isManualEntryOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-sm">
                <h3 className="text-xl font-semibold mb-4">Enter Task Code</h3>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const code = (e.target as HTMLFormElement).elements.namedItem('taskCodeInput') as HTMLInputElement;
                    handleManualSubmit(code.value);
                }}>
                    <input name="taskCodeInput" type="text" autoFocus className="bg-slate-700 border border-slate-600 rounded-lg p-2 w-full mb-4" placeholder="e.g., TSK-12345"/>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setManualEntryOpen(false)} className="bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-cyan-600 text-white font-semibold px-4 py-2 rounded-lg">Submit</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </main>
  );
};

export default App;
