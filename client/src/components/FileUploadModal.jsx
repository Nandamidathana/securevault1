import React, { useState, useRef } from 'react';
import { useVault } from '../context/VaultContext';
import { UploadCloud, X, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function FileUploadModal() {
  const { isUploadOpen, setIsUploadOpen, uploadFiles, storage } = useVault();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isUploadOpen) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files) => {
    setError('');
    if (selectedFiles.length + files.length > 20) {
      setError('You can select a maximum of 20 files per upload batch.');
      return;
    }

    const totalBatchBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (storage.used + totalBatchBytes > storage.limit) {
      setError('Selected files exceed your remaining 500MB storage limit.');
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setProgress(0);
    setError('');

    const res = await uploadFiles(selectedFiles, (percent) => {
      setProgress(percent);
    });

    setIsUploading(false);

    if (res?.success) {
      setSelectedFiles([]);
      setIsUploadOpen(false);
    } else {
      setError(res?.message || 'Failed to upload files.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl glass-panel p-6 rounded-3xl shadow-2xl border border-gray-800 relative">
        
        {/* Close Button */}
        <button
          onClick={() => !isUploading && setIsUploadOpen(false)}
          className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Encrypt & Upload Files</h3>
            <p className="text-xs text-gray-400">Files will be encrypted using AES-256-GCM before storage</p>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-cyan-400 bg-cyan-500/10' : 'border-gray-800 hover:border-cyan-500/50 bg-gray-900/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
          />
          <UploadCloud className="w-12 h-12 text-cyan-400 mx-auto mb-3 animate-bounce" />
          <p className="text-sm font-medium text-gray-200">
            Drag & Drop your files here, or <span className="text-cyan-400 underline">browse</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Max 20 files per upload • Up to 100MB per file
          </p>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mt-6 space-y-2 max-h-48 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex justify-between">
              <span>Selected Files ({selectedFiles.length}/20)</span>
              <span>Total: {(selectedFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(2)} MB</span>
            </div>

            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800/60 text-xs">
                <div className="flex items-center gap-2 truncate pr-2">
                  <File className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-gray-200 truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-500 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  {!isUploading && (
                    <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="text-gray-500 hover:text-rose-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real-time Progress Bar */}
        {isUploading && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-cyan-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" /> Encrypting & Uploading to Supabase...
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-800">
          <button
            onClick={() => setIsUploadOpen(false)}
            disabled={isUploading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUploadSubmit}
            disabled={isUploading || selectedFiles.length === 0}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-cyan hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isUploading ? 'Encrypting...' : `Upload ${selectedFiles.length} File(s)`}
          </button>
        </div>

      </div>
    </div>
  );
}
