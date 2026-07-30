import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import {
  Shield,
  Upload,
  Search,
  HardDrive,
  Grid,
  List,
  Lock,
  LogOut,
  Trash2,
  Eye,
  Download,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  Folder,
  Key,
  ShieldCheck,
  RefreshCw,
  Plus,
  User
} from 'lucide-react';
import FileUploadModal from './FileUploadModal';
import FilePreviewModal from './FilePreviewModal';
import PinModal from './PinModal';
import ProfileModal from './ProfileModal';
import ConfirmationModal from './ConfirmationModal';
import axios from 'axios';

export default function VaultDashboard() {
  const { user, logout, setIsUnlocked } = useAuth();
  const {
    files,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    storage,
    loadingFiles,
    setPreviewFile,
    setIsUploadOpen,
    deleteFile,
    fetchFiles
  } = useVault();

  const [viewMode, setViewMode] = useState('grid');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Warning Popup states for Delete & Download
  const [pendingDeleteFile, setPendingDeleteFile] = useState(null);
  const [pendingDownloadFile, setPendingDownloadFile] = useState(null);

  const categories = [
    { name: 'All', icon: Folder },
    { name: 'Images', icon: ImageIcon },
    { name: 'Videos', icon: Video },
    { name: 'Audio', icon: Music },
    { name: 'Documents', icon: FileText },
    { name: 'Archives', icon: Archive }
  ];

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Images': return <ImageIcon className="w-6 h-6 text-cyan-400" />;
      case 'Videos': return <Video className="w-6 h-6 text-blue-400" />;
      case 'Audio': return <Music className="w-6 h-6 text-purple-400" />;
      case 'Archives': return <Archive className="w-6 h-6 text-amber-400" />;
      default: return <FileText className="w-6 h-6 text-emerald-400" />;
    }
  };

  // Download logic after warning confirmation
  const handleConfirmedDownload = async () => {
    if (!pendingDownloadFile) return;
    const targetFile = pendingDownloadFile;
    setPendingDownloadFile(null);

    try {
      const res = await axios.get(`/api/files/${targetFile.id}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = targetFile.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download file.');
    }
  };

  // Delete logic after warning confirmation
  const handleConfirmedDelete = async () => {
    if (!pendingDeleteFile) return;
    const fileId = pendingDeleteFile.id;
    setPendingDeleteFile(null);
    await deleteFile(fileId);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      
      {/* Top Glass Header Navbar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-gray-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  SecureVault <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Zero-Knowledge</span>
                </h1>
                <p className="text-xs text-gray-400 font-mono">Encrypted Cloud Storage</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <button onClick={() => setIsProfileOpen(true)} className="p-2 rounded-xl bg-gray-800 text-gray-300">
                <User className="w-4 h-4" />
              </button>
              <button onClick={() => setIsUnlocked(false)} className="p-2 rounded-xl bg-gray-800 text-gray-300">
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search bar */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search encrypted files..."
                className="w-full glass-input pl-10 pr-4 py-2 text-xs rounded-xl text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            {/* Upload Action */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-xs shadow-glow-cyan hover:opacity-95 transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Upload
            </button>

            {/* Profile Button */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="p-2 rounded-xl glass-card text-gray-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-xs flex items-center gap-1.5 shrink-0"
              title="User Profile & Settings"
            >
              <User className="w-4 h-4" />
              <span className="hidden lg:inline text-xs">{user?.email?.split('@')[0]}</span>
            </button>

            {/* Change Smart PIN button */}
            <button
              onClick={() => setIsPinModalOpen(true)}
              className="p-2 rounded-xl glass-card text-gray-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-xs flex items-center gap-1 shrink-0"
              title="Smart PIN Settings"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Lock / Logout */}
            <button
              onClick={() => setIsUnlocked(false)}
              className="p-2 rounded-xl glass-card text-rose-400 hover:bg-rose-500/10 transition-all text-xs hidden md:flex items-center gap-1 shrink-0"
              title="Lock Vault"
            >
              <Lock className="w-4 h-4" />
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-xl glass-card text-gray-400 hover:text-white transition-all text-xs hidden md:flex items-center gap-1 shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Storage Bar & Quick Stats */}
        <div className="glass-panel p-6 rounded-3xl border border-gray-800/80 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-gray-800/80 border border-gray-700 flex items-center justify-center text-cyan-400 shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Storage Usage</h3>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  500 MB Limit
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Used {formatBytes(storage.used)} of {formatBytes(storage.limit)} ({storage.percentage}%)
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full md:w-72 space-y-1.5">
            <div className="w-full h-3 rounded-full bg-gray-900 overflow-hidden border border-gray-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(storage.percentage, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 font-mono">
              <span>0 MB</span>
              <span>{Math.max(0, 500 - (storage.used / (1024 * 1024))).toFixed(1)} MB Free</span>
            </div>
          </div>

          {/* Profile & Refresh */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-gray-800 pt-4 md:pt-0">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="text-xs text-gray-400 hover:text-cyan-400 font-mono truncate max-w-[150px] transition-colors"
              title="Open Profile"
            >
              {user?.email}
            </button>
            <button
              onClick={fetchFiles}
              className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-cyan-400 transition-all"
              title="Refresh Vault Files"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
            </button>
          </div>

        </div>

        {/* Categories Bar & View Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const IconComp = cat.icon;
              const isActive = activeCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-cyan'
                      : 'glass-card text-gray-400 hover:text-white'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-gray-900/80 p-1 rounded-2xl border border-gray-800 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Files Display Container */}
        {loadingFiles ? (
          <div className="py-20 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-xs font-mono">Decrypting Vault File Metadata...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="py-20 text-center glass-panel rounded-3xl border border-gray-800/80 p-8">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Encrypted Files Stored</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">
              Your SecureVault is empty. Upload files to encrypt them in-memory with AES-256-GCM before saving to Supabase Storage.
            </p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-glow-cyan hover:opacity-95 transition-all inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Upload Files Now
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="glass-panel p-4 rounded-2xl border border-gray-800/80 hover:border-cyan-500/40 transition-all duration-300 group flex flex-col justify-between relative shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800">
                      {getCategoryIcon(file.category)}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      AES-256
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-gray-100 truncate mb-1" title={file.original_name}>
                    {file.original_name}
                  </h4>
                  <p className="text-[11px] text-gray-500 font-mono mb-4">
                    {formatBytes(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800/60">
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="p-2 rounded-xl text-cyan-400 hover:bg-cyan-500/10 transition-all text-xs flex items-center gap-1"
                    title="Decrypt & Stream Preview"
                  >
                    <Eye className="w-4 h-4" /> <span className="text-[11px]">View</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPendingDownloadFile(file)}
                      className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                      title="Download File"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteFile(file)}
                      className="p-2 rounded-xl text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Delete File"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        ) : (

          /* LIST VIEW */
          <div className="glass-panel rounded-3xl border border-gray-800/80 overflow-hidden shadow-xl">
            <div className="divide-y divide-gray-800/60">
              {files.map((file) => (
                <div key={file.id} className="p-4 flex items-center justify-between hover:bg-gray-900/40 transition-colors">
                  <div className="flex items-center gap-3 truncate pr-4">
                    <div className="p-2 rounded-xl bg-gray-900 border border-gray-800 shrink-0">
                      {getCategoryIcon(file.category)}
                    </div>
                    <div className="truncate">
                      <h4 className="font-semibold text-sm text-gray-100 truncate">{file.original_name}</h4>
                      <p className="text-[11px] text-gray-500 font-mono">
                        {formatBytes(file.file_size)} • {file.category} • {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all text-xs flex items-center gap-1 font-medium"
                    >
                      <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button
                      onClick={() => setPendingDownloadFile(file)}
                      className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteFile(file)}
                      className="p-2 rounded-xl text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        )}

      </main>

      {/* Modals */}
      <FileUploadModal />
      <FilePreviewModal />
      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* WARNING CONFIRMATION POPUP FOR DELETE FILE */}
      <ConfirmationModal
        isOpen={Boolean(pendingDeleteFile)}
        title="Delete Encrypted File Confirmation"
        message={`Are you sure you want to delete "${pendingDeleteFile?.original_name}"? This file will be permanently erased from Supabase Storage.`}
        confirmText="Confirm Delete"
        isDanger={true}
        onConfirm={handleConfirmedDelete}
        onCancel={() => setPendingDeleteFile(null)}
      />

      {/* WARNING CONFIRMATION POPUP FOR DOWNLOAD FILE */}
      <ConfirmationModal
        isOpen={Boolean(pendingDownloadFile)}
        title="Download Encrypted File Confirmation"
        message={`You are about to decrypt and download "${pendingDownloadFile?.original_name}".`}
        confirmText="Confirm Download"
        isDanger={false}
        onConfirm={handleConfirmedDownload}
        onCancel={() => setPendingDownloadFile(null)}
      />

    </div>
  );
}
