import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const VaultContext = createContext();

export function VaultProvider({ children }) {
  const { token, isUnlocked } = useAuth();
  const [files, setFiles] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [storage, setStorage] = useState({ used: 0, limit: 500 * 1024 * 1024, percentage: 0 });
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Fetch files from server
  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setLoadingFiles(true);
    try {
      const res = await axios.get('/api/files', {
        params: {
          category: activeCategory,
          q: searchQuery
        }
      });
      if (res.data.success) {
        setFiles(res.data.files);
        if (res.data.storage) {
          setStorage(res.data.storage);
        }
      }
    } catch (err) {
      console.error('Error fetching vault files:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [token, activeCategory, searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Upload files with real-time upload progress tracking
  const uploadFiles = async (fileList, onProgress) => {
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < Math.min(fileList.length, 20); i++) {
      formData.append('files', fileList[i]);
    }

    try {
      const res = await axios.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (onProgress) onProgress(percentCompleted);
        }
      });

      if (res.data.success) {
        await fetchFiles();
        return { success: true, count: res.data.files.length };
      }
    } catch (err) {
      console.error('Upload failed:', err);
      return {
        success: false,
        message: err.response?.data?.message || 'File upload failed.'
      };
    }
  };

  // Delete file
  const deleteFile = async (fileId) => {
    try {
      const res = await axios.delete(`/api/files/${fileId}`);
      if (res.data.success) {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        if (res.data.storage_used !== undefined) {
          setStorage(prev => ({
            ...prev,
            used: res.data.storage_used,
            percentage: Number(((res.data.storage_used / prev.limit) * 100).toFixed(1))
          }));
        }
        if (previewFile?.id === fileId) {
          setPreviewFile(null);
        }
        return { success: true };
      }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed.' };
    }
  };

  return (
    <VaultContext.Provider
      value={{
        files,
        activeCategory,
        setActiveCategory,
        searchQuery,
        setSearchQuery,
        storage,
        loadingFiles,
        previewFile,
        setPreviewFile,
        isUploadOpen,
        setIsUploadOpen,
        fetchFiles,
        uploadFiles,
        deleteFile
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  return useContext(VaultContext);
}
