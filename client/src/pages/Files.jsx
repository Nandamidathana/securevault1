import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, HardDrive, Download, Eye, Shield, RefreshCw } from 'lucide-react';

export default function Files() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('securevault_token') || localStorage.getItem('token');
      const res = await axios.get('/api/files/my-files', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (Array.isArray(res.data)) {
        setFiles(res.data);
      } else if (res.data.files && Array.isArray(res.data.files)) {
        setFiles(res.data.files);
      } else {
        setFiles([]);
      }
    } catch (err) {
      console.error('Error fetching /my-files:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Error loading files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between glass-panel p-5 rounded-3xl border border-gray-800 shadow-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-all border border-gray-700/50"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-200 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <Shield className="w-6 h-6 text-cyan-400 inline" /> My Encrypted Files
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Zero-Knowledge AES-256-GCM Storage Registry ({files.length} items)
              </p>
            </div>
          </div>

          <button
            onClick={fetchFiles}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Files Table / Content Panel */}
        <div className="glass-panel rounded-3xl border border-gray-800/80 p-6 shadow-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-sm text-gray-400 font-mono">Decrypting file registry...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <HardDrive className="w-12 h-12 text-gray-600 mx-auto" />
              <h3 className="text-lg font-bold text-gray-300">No Files Uploaded</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Your vault is empty. Upload files from the main dashboard to store them with zero-knowledge AES-256 encryption.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all shadow-glow-cyan"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                    <th className="py-3.5 px-4">File Name</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Uploaded Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-sm">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-800/40 transition-colors group">
                      <td className="py-4 px-4 font-medium text-gray-200 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="truncate max-w-xs">{file.original_name}</span>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-cyan-400">
                        {formatSize(file.file_size)}
                      </td>
                      <td className="py-4 px-4 text-xs text-gray-400">
                        <span className="bg-gray-800/80 px-2.5 py-1 rounded-lg border border-gray-700/60 font-mono">
                          {file.file_type}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-gray-400 font-mono">
                        {new Date(file.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/files/${file.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-gray-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-400 transition-all border border-gray-700/50"
                            title="View File"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <a
                            href={`/api/files/${file.id}/download`}
                            download
                            className="p-2 rounded-xl bg-gray-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-400 transition-all border border-gray-700/50"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
