import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Alert,
  ActivityIndicator,
  FlatList,
  Animated,
  Easing,
} from 'react-native';
// FIX: Changed to default import for CameraKitCamera as it is a default export.
import CameraKitCamera from 'react-native-camera-kit';
import Geolocation from '@react-native-community/geolocation';
import ImageEditor from 'react-native-image-editor';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';

// Note: DB logic needs to be replaced with a native solution like WatermelonDB or Realm.
// This is a placeholder for the logic.
import { addPhoto, getDailyReport, getPhotosForReport } from './services/db';
import { AppState, PhotoRecord, TaskReport } from './types';
import { BarcodeScannerIcon, CameraIcon, ChevronLeftIcon, DocumentTextIcon, PencilSquareIcon, XMarkIcon } from './components/Icons';

// --- HELPERS ---
const getDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem('device-id');
  if (!deviceId) {
    deviceId = `device_${uuidv4()}`;
    await AsyncStorage.setItem('device-id', deviceId);
  }
  return deviceId;
};

const requestLocationPermission = async () => {
  if (Platform.OS === 'ios') {
    // FIX: `requestAuthorization` does not take arguments. The permission type is configured in Info.plist.
    Geolocation.requestAuthorization();
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs access to your location to geotag photos.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [taskCode, setTaskCode] = useState<string>('');
  const [photos, setPhotos] = useState<PhotoRecord[]>([]); // We use the path for native
  const [error, setError] = useState<string>('');
  const [report, setReport] = useState<TaskReport[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isManualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualTaskCode, setManualTaskCode] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const cameraRef = useRef<any>(null); // Ref for CameraKitCamera
  const deviceIdRef = useRef<string>('');
  const scannerAnimation = useRef(new Animated.Value(0)).current;


  // Initial setup effect
  useEffect(() => {
    const setup = async () => {
      deviceIdRef.current = await getDeviceId();
      const cameraPermission = await CameraKitCamera.requestDeviceCameraPermissions();
      setHasCameraPermission(cameraPermission);
      if (!cameraPermission) {
        setError('Camera permission is required to use this app.');
      }
      await requestLocationPermission();
    };
    setup();
  }, []);
  
  // Scanner animation effect
  useEffect(() => {
    if (appState === AppState.SCANNING) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scannerAnimation, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scannerAnimation, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [appState, scannerAnimation]);


  const handleStartScan = () => {
    if (hasCameraPermission) {
      setAppState(AppState.SCANNING);
      setError('');
    } else {
      Alert.alert("Permission Denied", "Cannot start scanner without camera permission.");
    }
  };

  const onBarcodeScan = (event: { nativeEvent: { codeStringValue: string } }) => {
    if (appState === AppState.SCANNING) {
      const code = event.nativeEvent.codeStringValue;
      console.log('Barcode scanned:', code);
      setTaskCode(code);
      setPhotos([]);
      setAppState(AppState.CAPTURE_PHOTO);
    }
  };
  
  const handleManualSubmit = (code: string) => {
    if (code.trim()) {
      setTaskCode(code.trim());
      setPhotos([]);
      setManualEntryOpen(false);
      setManualTaskCode('');
      setAppState(AppState.CAPTURE_PHOTO);
    }
  };

  const handleTakePhoto = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      try {
        const image = await cameraRef.current.capture();
        const imagePath = Platform.OS === 'android' ? `file://${image.uri}` : image.uri;
        
        let location: { latitude: number; longitude: number } | null = null;
        try {
          location = await getCurrentLocation();
        } catch (geoError) {
          console.warn('Could not get geolocation:', geoError);
        }
        
        const now = new Date();
        const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        const deviceId = deviceIdRef.current;
        
        const locationLine = location ? `Lat: ${location.latitude.toFixed(5)}, Lon: ${location.longitude.toFixed(5)}` : 'Location: N/A';
        const timeLine = `Time: ${timestamp}`;
        const infoLine = `Task: ${taskCode} | Device: ${deviceId}`;
        
        const textStyle = { color: '#FFFFFFCC', fontName: 'Arial', fontSize: 40 };
        const position = { X: 40, Y: 'bottom-20' };

        const watermarkedImagePath = await ImageEditor.addText(imagePath, [
            { text: infoLine, style: textStyle, position: { ...position, Y: 'bottom-120'} },
            { text: timeLine, style: textStyle, position: { ...position, Y: 'bottom-70'} },
            { text: locationLine, style: textStyle, position: position },
        ]);

        const photoIndex = photos.length + 1;
        const filename = `${taskCode}_(${photoIndex}).jpg`;
        const newPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

        await RNFS.moveFile(watermarkedImagePath, newPath);

        const newRecord: PhotoRecord = {
          taskCode,
          filename,
          timestamp: now.toISOString(),
          data: newPath,
          deviceId,
          latitude: location?.latitude,
          longitude: location?.longitude
        };
        await addPhoto(newRecord);
        setPhotos(prevPhotos => [...prevPhotos, newRecord]);

      } catch (e) {
        console.error('Failed to take photo', e);
        setError('Could not capture image.');
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const handleFinishSession = () => {
    setTaskCode('');
    setPhotos([]);
    setAppState(AppState.HOME);
  };

  const handleViewReports = async () => {
    setAppState(AppState.REPORTS);
    const dailyReport = await getDailyReport(reportDate);
    setReport(dailyReport);
  };
  
  const handleExportReport = async () => {
    if (report.length === 0 || isExporting) return;
    setIsExporting(true);
    
    try {
        const allPhotosForDay = await getPhotosForReport(reportDate);
        if (allPhotosForDay.length === 0) {
            Alert.alert("No Photos", "There are no photos to export for the selected date.");
            return;
        }

        const tempDir = `${RNFS.CachesDirectoryPath}/export_${reportDate}`;
        await RNFS.mkdir(tempDir);

        for (const photo of allPhotosForDay) {
            const taskFolder = `${tempDir}/${photo.taskCode}`;
            if (!(await RNFS.exists(taskFolder))) {
              await RNFS.mkdir(taskFolder);
            }
            await RNFS.copyFile(photo.data, `${taskFolder}/${photo.filename}`);
        }
        
        const zipPath = `${RNFS.DocumentDirectoryPath}/report_${reportDate}.zip`;
        if (await RNFS.exists(zipPath)) {
            await RNFS.unlink(zipPath);
        }
        await zip(tempDir, zipPath);
        await RNFS.unlink(tempDir);

        await Share.open({
            url: `file://${zipPath}`,
            title: 'Share Report',
            message: `Task photo report for ${reportDate}`,
            type: 'application/zip'
        });

    } catch (e) {
        console.error("Export failed:", e);
        Alert.alert("Export Error", "Could not generate or share the report zip file.");
    } finally {
        setIsExporting(false);
    }
  };

  const renderScreen = () => {
    switch (appState) {
      case AppState.SCANNING:
        const scannerLineStyle = {
          transform: [
            {
              translateY: scannerAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [-height * 0.15, height * 0.15],
              }),
            },
          ],
        };
        return (
          <View style={styles.fullScreen}>
            <CameraKitCamera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              scanBarcode={true}
              onReadCode={onBarcodeScan}
              cameraOptions={{ flashMode: 'auto', focusMode: 'on', zoomMode: 'on' }}
            />
            <View style={styles.scannerOverlay}>
              <Text style={styles.scannerText}>Position barcode inside the frame</Text>
              <View style={styles.scannerBox}>
                  <View style={[styles.scannerCorner, styles.topLeft]} />
                  <View style={[styles.scannerCorner, styles.topRight]} />
                  <View style={[styles.scannerCorner, styles.bottomLeft]} />
                  <View style={[styles.scannerCorner, styles.bottomRight]} />
                  <Animated.View style={[styles.scannerLine, scannerLineStyle]} />
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setAppState(AppState.HOME)}>
              <XMarkIcon size={24} color="#E5E7EB" />
            </TouchableOpacity>
          </View>
        );
      case AppState.CAPTURE_PHOTO:
        return (
          <View style={styles.fullScreen}>
            <CameraKitCamera ref={cameraRef} style={StyleSheet.absoluteFill} />
            {isCapturing && <View style={styles.flashEffect} />}
            <View style={styles.captureOverlay}>
              <View style={styles.topBar}>
                <View style={styles.taskCodePill}>
                    <Text style={styles.taskCodeText}>{taskCode}</Text>
                </View>
              </View>
              <View style={styles.bottomBar}>
                <TouchableOpacity style={styles.utilityButton} onPress={handleFinishSession}>
                   <XMarkIcon size={24} color="#E5E7EB" />
                   <Text style={styles.utilityButtonText}>Finish</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto} disabled={isCapturing} />
                <View style={styles.photoCountContainer}>
                  <Text style={styles.photoCount}>{photos.length}</Text>
                  <Text style={styles.photoCountLabel}>photos</Text>
                </View>
              </View>
            </View>
          </View>
        );
      case AppState.REPORTS:
        return (
           <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setAppState(AppState.HOME)}>
                        <ChevronLeftIcon size={24} color="#E5E7EB" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Daily Report</Text>
                    <View style={{width: 40}} />
                </View>
                <Text style={styles.dateLabel}>Report for: {reportDate}</Text>
                {/* Note: A proper date picker component should be used here */}
                <FlatList
                    data={report}
                    keyExtractor={item => item.taskCode}
                    renderItem={({ item }) => (
                        <View style={styles.reportCard}>
                            <DocumentTextIcon size={32} color="#818CF8" />
                            <View style={styles.reportCardContent}>
                                <Text style={styles.reportCardTitle}>Task Code</Text>
                                <Text style={styles.reportCardValue}>{item.taskCode}</Text>
                            </View>
                            <View style={styles.reportCardCount}>
                                <Text style={styles.reportCardValue}>{item.photoCount}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyText}>No tasks recorded for this day.</Text>}
                    contentContainerStyle={{paddingBottom: 100}}
                />
                <TouchableOpacity 
                    style={[styles.fab, report.length === 0 && styles.fabDisabled]} 
                    onPress={handleExportReport} 
                    disabled={isExporting || report.length === 0}
                >
                    {isExporting ? <ActivityIndicator color="#111827" /> : <Text style={styles.fabText}>Export</Text>}
                </TouchableOpacity>
            </View>
        );
      default: // HOME
        return (
          <View style={styles.container}>
            <View style={styles.homeHeader}>
                <CameraIcon size={48} color="#818CF8" />
                <Text style={styles.mainTitle}>Field Scan Pro</Text>
                <Text style={styles.tagline}>Capture. Watermark. Report.</Text>
            </View>
            
            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.homeActions}>
                <TouchableOpacity style={styles.actionCardPrimary} onPress={handleStartScan}>
                    <BarcodeScannerIcon color="#111827" size={32} />
                    <Text style={styles.actionCardTitlePrimary}>Scan Task Code</Text>
                    <Text style={styles.actionCardSubtitle}>Use camera to scan a barcode</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCardSecondary} onPress={() => setManualEntryOpen(true)}>
                    <PencilSquareIcon color="#E5E7EB" size={24} />
                    <Text style={styles.actionCardTitleSecondary}>Enter Manually</Text>
                </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.reportsLink} onPress={handleViewReports}>
              <DocumentTextIcon color="#818CF8" size={20}/>
              <Text style={styles.reportsLinkText}>View Daily Reports</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={styles.safeArea.backgroundColor} />
        {renderScreen()}
        <Modal
          visible={isManualEntryOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setManualEntryOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Enter Task Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., TSK-12345"
                placeholderTextColor="#9CA3AF"
                autoFocus
                value={manualTaskCode}
                onChangeText={setManualTaskCode}
                onSubmitEditing={() => handleManualSubmit(manualTaskCode)}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setManualEntryOpen(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={styles.modalButtonPrimary} onPress={() => handleManualSubmit(manualTaskCode)}>
                  <Text style={styles.modalButtonPrimaryText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');
const accentColor = '#22D3EE';
const primaryBackgroundColor = '#111827';
const componentBackgroundColor = '#1F293B';
const textColor = '#E5E7EB';
const secondaryTextColor = '#9CA3AF';
const secondaryAccentColor = '#818CF8';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: primaryBackgroundColor },
  fullScreen: { flex: 1 },
  container: { flex: 1, padding: 16, justifyContent: 'space-between' },

  // --- Home Screen ---
  homeHeader: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  mainTitle: { fontSize: 36, fontWeight: 'bold', color: textColor, textAlign: 'center', marginTop: 16 },
  tagline: { fontSize: 18, color: secondaryTextColor, marginTop: 8, textAlign: 'center' },
  homeActions: { width: '100%', paddingBottom: 20 },
  actionCardPrimary: { backgroundColor: accentColor, padding: 24, borderRadius: 16, alignItems: 'center', elevation: 8, shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 10 },
  actionCardTitlePrimary: { color: primaryBackgroundColor, fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  actionCardSubtitle: { color: '#0891B2', fontSize: 14, marginTop: 4 },
  actionCardSecondary: { backgroundColor: componentBackgroundColor, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 12},
  actionCardTitleSecondary: { color: textColor, fontSize: 18, fontWeight: '600' },
  reportsLink: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 16 },
  reportsLinkText: { color: secondaryAccentColor, fontSize: 16, fontWeight: '600' },
  errorText: { backgroundColor: 'rgba(153, 27, 27, 0.5)', color: '#FCA5A5', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  
  // --- Scanner Screen ---
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  scannerText: { color: textColor, fontSize: 16, marginBottom: 24, paddingHorizontal: 40, textAlign: 'center' },
  scannerBox: { width: width * 0.75, height: height * 0.25, justifyContent: 'center', alignItems: 'center' },
  scannerCorner: { position: 'absolute', width: 30, height: 30, borderColor: accentColor, borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scannerLine: { width: '100%', height: 2, backgroundColor: accentColor, elevation: 1, shadowColor: accentColor, shadowOpacity: 1, shadowRadius: 10 },
  closeButton: { position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  
  // --- Capture Screen ---
  flashEffect: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', opacity: 0 }, // Handled by animation
  captureOverlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'center', paddingTop: 40 },
  taskCodePill: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  taskCodeText: { color: textColor, fontSize: 16, fontWeight: 'bold' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20 },
  utilityButton: { alignItems: 'center', width: 80, gap: 4 },
  utilityButtonText: { color: textColor, fontSize: 14, fontWeight: '500' },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', borderWidth: 5, borderColor: accentColor },
  photoCountContainer: { alignItems: 'center', width: 80 },
  photoCount: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  photoCountLabel: { color: '#D1D5DB', fontSize: 14 },
  
  // --- Reports Screen ---
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 0 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: textColor },
  dateLabel: { color: secondaryTextColor, marginBottom: 16, fontSize: 16, textAlign: 'center' },
  reportCard: { backgroundColor: componentBackgroundColor, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  reportCardContent: { flex: 1 },
  reportCardTitle: { color: secondaryTextColor, fontSize: 14 },
  reportCardValue: { color: textColor, fontSize: 18, fontWeight: '600' },
  reportCardCount: { backgroundColor: 'rgba(0,0,0,0.2)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: secondaryTextColor, textAlign: 'center', marginTop: 40, fontSize: 16 },
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: accentColor, width: 120, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: accentColor, shadowOpacity: 0.4, shadowRadius: 8 },
  fabDisabled: { backgroundColor: '#374151' },
  fabText: { color: primaryBackgroundColor, fontSize: 18, fontWeight: 'bold' },

  // --- Modal ---
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContainer: { backgroundColor: componentBackgroundColor, padding: 24, borderRadius: 16, width: '90%', maxWidth: 400 },
  modalTitle: { color: textColor, fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#374151', color: textColor, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: '#4B5563' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalButtonSecondary: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonText: { color: secondaryTextColor, fontSize: 16, fontWeight: '600' },
  modalButtonPrimary: { backgroundColor: accentColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonPrimaryText: { color: primaryBackgroundColor, fontSize: 16, fontWeight: '600' },
});

export default App;
