import React, { useState, useEffect, useRef } from 'react';
import { useVault } from '../context/VaultContext';
import {
  X,
  Download,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  MousePointer
} from 'lucide-react';
import axios from 'axios';
import ConfirmationModal from './ConfirmationModal';

// Global In-Memory Blob URL Cache for Instant Photo Preview & Instant Left/Right Navigation
const blobCache = new Map();

export default function FilePreviewModal() {
  const { previewFile, setPreviewFile, files } = useVault();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const containerRef = useRef(null);

  // Index of current preview file in vault files list
  const currentIndex = files.findIndex(f => f?.id === previewFile?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < files.length - 1;

  // Clean normal file name display
  const displayName = (previewFile?.original_name || previewFile?.file_name || 'Photo')
    .replace('Encrypted_Photo_', 'Photo_')
    .replace('Encrypted_File_', 'File_')
    .replace('Encrypted_', '');

  // Helper to load or fetch file blob URL with instant memory cache
  const fetchBlobUrl = async (file) => {
    if (!file || !file.id) return null;
    if (blobCache.has(file.id)) {
      return blobCache.get(file.id);
    }
    try {
      const res = await axios.get(`/api/files/${file.id}/view`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: file.file_type || 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      blobCache.set(file.id, url);
      return url;
    } catch (e) {
      console.warn(`Failed to fetch blob for file ${file.id}:`, e.message);
      return null;
    }
  };

  // Preload adjacent photos for INSTANT Left/Right Arrow navigation
  useEffect(() => {
    if (currentIndex === -1 || !files || files.length === 0) return;
    const preloadIndexes = [currentIndex + 1, currentIndex - 1].filter(i => i >= 0 && i < files.length);
    preloadIndexes.forEach(idx => {
      const targetFile = files[idx];
      if (targetFile && !blobCache.has(targetFile.id)) {
        fetchBlobUrl(targetFile);
      }
    });
  }, [currentIndex, files]);

  useEffect(() => {
    let isMounted = true;

    async function loadFileStream() {
      if (!previewFile) return;
      setError('');
      setZoomLevel(1);

      // INSTANT MEMORY CACHE CHECK (0ms delay)
      if (blobCache.has(previewFile.id)) {
        setBlobUrl(blobCache.get(previewFile.id));
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const url = await fetchBlobUrl(previewFile);
        if (isMounted) {
          if (url) {
            setBlobUrl(url);
          } else {
            setError('Unable to render file stream.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Unable to render file stream.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFileStream();

    return () => {
      isMounted = false;
    };
  }, [previewFile]);

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!previewFile) return;
      if (e.key === 'ArrowLeft' && hasPrev) {
        setPreviewFile(files[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext) {
        setPreviewFile(files[currentIndex + 1]);
      } else if (e.key === 'Escape') {
        setPreviewFile(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile, currentIndex, hasPrev, hasNext, files, setPreviewFile]);

  // MOUSE WHEEL SCROLLER ZOOM IN / ZOOM OUT HANDLER
  const handleWheel = (e) => {
    if (!previewFile) return;
    e.preventDefault();
    const zoomFactor = 0.15;
    if (e.deltaY < 0) {
      setZoomLevel(prev => Math.min(prev + zoomFactor, 5.0));
    } else if (e.deltaY > 0) {
      setZoomLevel(prev => Math.max(prev - zoomFactor, 0.4));
    }
  };

  if (!previewFile) return null;

  const handleConfirmedDownload = async () => {
    setShowDownloadConfirm(false);
    try {
      const res = await axios.get(`/api/files/${previewFile.id}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download file.');
    }
  };

  const handlePrev = () => {
    if (hasPrev) setPreviewFile(files[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) setPreviewFile(files[currentIndex + 1]);
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 5.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.4));
  const handleResetZoom = () => setZoomLevel(1);

  const isImage = previewFile.category === 'Images' || (previewFile.file_type && previewFile.file_type.startsWith('image/'));
  const isVideo = previewFile.category === 'Videos' || (previewFile.file_type && previewFile.file_type.startsWith('video/'));
  const isAudio = previewFile.category === 'Audio' || (previewFile.file_type && previewFile.file_type.startsWith('audio/'));
  const isPdf = (previewFile.file_type && previewFile.file_type.includes('pdf')) || (displayName && displayName.endsWith('.pdf'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in">
      
      {/* Gallery Prev Button */}
      {hasPrev && (
        <button
          onClick={handlePrev}
          className="absolute left-4 z-50 p-3.5 rounded-full bg-black/70 hover:bg-cyan-500/30 text-white hover:text-cyan-400 border border-gray-800 transition-all shadow-2xl backdrop-blur-md"
          title="Previous Photo/File (Left Arrow)"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Gallery Next Button */}
      {hasNext && (
        <button
          onClick={handleNext}
          className="absolute right-4 z-50 p-3.5 rounded-full bg-black/70 hover:bg-cyan-500/30 text-white hover:text-cyan-400 border border-gray-800 transition-all shadow-2xl backdrop-blur-md"
          title="Next Photo/File (Right Arrow)"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Fullscreen Photo Container */}
      <div className={`w-full h-full flex flex-col overflow-hidden relative ${
        isFullscreen ? 'p-0' : 'p-4 max-w-6xl max-h-[92vh] glass-panel rounded-3xl border border-gray-800'
      }`}>
        
        {/* Top Header Controls Bar */}
        <div className="p-4 px-6 border-b border-gray-800/80 flex items-center justify-between bg-gray-950/90 z-20 shrink-0">
          
          <div className="flex items-center gap-3 truncate pr-4">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isVideo && <Video className="w-5 h-5" />}
              {isAudio && <Music className="w-5 h-5" />}
              {!isImage && !isVideo && !isAudio && <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <h4 className="font-semibold text-white truncate text-sm sm:text-base">{displayName}</h4>
              <p className="text-xs text-gray-400 font-mono">
                {(previewFile.file_size / (1024 * 1024)).toFixed(2)} MB • Photo {currentIndex + 1} of {files.length}
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Mouse Scroller Zoom Bar */}
            {(isImage || isPdf) && (
              <div className="flex items-center gap-1.5 bg-gray-900/90 p-1.5 rounded-2xl border border-gray-800 mr-2 shadow-inner">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-gray-300 hover:text-cyan-400 rounded-xl transition-colors"
                  title="Zoom Out (Scroll Down)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-800/80">
                  <MousePointer className="w-3 h-3 text-cyan-400" />
                  <span className="text-[11px] font-mono text-cyan-300 font-bold min-w-[45px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                </div>

                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-gray-300 hover:text-cyan-400 rounded-xl transition-colors"
                  title="Zoom In (Scroll Up)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  onClick={handleResetZoom}
                  className="p-1.5 text-gray-400 hover:text-white rounded-xl transition-colors ml-1"
                  title="Reset Zoom (100%)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Toggle Windowed / Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 rounded-xl glass-card text-gray-300 hover:text-cyan-400 transition-all"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              onClick={() => setShowDownloadConfirm(true)}
              className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Download File"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => setPreviewFile(null)}
              className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
            >
              <X className="w-6 h-6" />
            </button>

          </div>
        </div>

        {/* FULLSCREEN PHOTO VIEWPORT WITH MOUSE WHEEL SCROLLER ZOOM */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#04060B] relative selection:bg-none cursor-grab active:cursor-grabbing"
        >
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-sm font-mono text-cyan-300">Loading Photo Stream...</p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              
              {/* IMAGE VIEWER WITH MOUSE SCROLLER ZOOM */}
              {isImage && blobUrl && (
                <div
                  className="transition-transform duration-150 ease-out flex items-center justify-center select-none"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={blobUrl}
                    alt={displayName}
                    className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-gray-800/60"
                  />
                </div>
              )}

              {/* VIDEO PLAYER */}
              {isVideo && blobUrl && (
                <video
                  controls
                  autoPlay
                  src={blobUrl}
                  className="max-h-[85vh] w-full max-w-5xl rounded-2xl border border-gray-800"
                />
              )}

              {/* AUDIO PLAYER */}
              {isAudio && blobUrl && (
                <div className="w-full max-w-md p-8 glass-card rounded-3xl text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
                    <Music className="w-10 h-10" />
                  </div>
                  <audio controls src={blobUrl} className="w-full" />
                </div>
              )}

              {/* PDF VIEWER WITH MOUSE SCROLLER ZOOM */}
              {isPdf && blobUrl && (
                <div
                  className="w-full h-[85vh] transition-transform duration-150 ease-out"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                >
                  <iframe
                    src={blobUrl}
                    title={displayName}
                    className="w-full h-full rounded-2xl border border-gray-800 bg-white"
                  />
                </div>
              )}

              {/* GENERIC FILE FALLBACK */}
              {!isImage && !isVideo && !isAudio && !isPdf && (
                <div className="text-center py-12 glass-card p-8 rounded-3xl max-w-md">
                  <FileText className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-white mb-2">{displayName}</h4>
                  <p className="text-xs text-gray-400 mb-6">
                    File buffer ready. Click below to download.
                  </p>
                  <button
                    onClick={() => setShowDownloadConfirm(true)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan"
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-3 px-6 bg-gray-950/90 border-t border-gray-800 text-xs text-gray-400 flex justify-between items-center font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> Fullscreen Media Viewer
          </span>
          <span className="hidden sm:inline text-cyan-400 font-medium">
            💡 Scroll mouse wheel UP/DOWN to zoom in/out ({Math.round(zoomLevel * 100)}%)
          </span>
          <span>{displayName}</span>
        </div>

      </div>

      {/* WARNING CONFIRMATION POPUP FOR DOWNLOAD */}
      <ConfirmationModal
        isOpen={showDownloadConfirm}
        title="Download File Confirmation"
        message={`You are downloading "${displayName}".`}
        confirmText="Confirm Download"
        isDanger={false}
        onConfirm={handleConfirmedDownload}
        onCancel={() => setShowDownloadConfirm(false)}
      />

    </div>
  );
}
