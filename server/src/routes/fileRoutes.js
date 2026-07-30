const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const { supabase, isSupabaseConfigured, uploadToStorage, downloadFromStorage, deleteFromStorage, localDb, BUCKET_NAME } = require('../services/supabaseService');

const router = express.Router();
const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB limit

// Fast In-Memory Cache for Supabase Bucket Scanning (TTL 30 seconds)
const bucketScanCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

// Multer memory storage configuration (Max 20 files per upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per single file
    files: 20 // Max 20 files per batch
  }
});

/**
 * Detect image/media MIME type from buffer magic bytes
 */
function detectMimeFromBuffer(buffer, fallbackType = 'image/jpeg') {
  if (!buffer || buffer.length < 4) return fallbackType;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  return fallbackType;
}

/**
 * Categorize files automatically based on MIME type or extension
 */
function getCategory(mimeType, filename) {
  const mime = (mimeType || '').toLowerCase();
  const ext = path.extname(filename || '').toLowerCase();

  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    return 'Images';
  }
  if (mime.startsWith('video/') || ['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) {
    return 'Videos';
  }
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext)) {
    return 'Audio';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('excel') ||
    mime.includes('text') ||
    ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.csv', '.ppt', '.pptx'].includes(ext)
  ) {
    return 'Documents';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)
  ) {
    return 'Archives';
  }
  return 'Documents';
}

/**
 * Get real User ID by email or token ID
 */
async function getEffectiveUserId(reqUser) {
  if (!reqUser) return null;
  const userEmail = (reqUser.email || '').toLowerCase().trim();
  
  if (supabase && userEmail) {
    try {
      const { data } = await supabase.from('users').select('id').ilike('email', userEmail).limit(1);
      if (data && data.length > 0) {
        return data[0].id;
      }
    } catch (e) {}
  }
  return reqUser.id;
}

/**
 * Get current total storage used by user
 */
async function getUserStorageUsed(userId) {
  let dbUsed = 0;
  if (supabase) {
    try {
      const { data } = await supabase.from('users').select('storage_used').eq('id', userId).single();
      dbUsed = Number(data?.storage_used || 0);
    } catch (e) {}
  }
  const user = localDb.users.find(u => u.id === userId);
  const localUsed = Number(user?.storage_used || 0);

  return Math.max(dbUsed, localUsed);
}

/**
 * Update user's storage used
 */
async function updateUserStorage(userId, deltaBytes) {
  const currentUsed = await getUserStorageUsed(userId);
  const newUsed = Math.max(0, currentUsed + deltaBytes);

  if (supabase) {
    try {
      await supabase.from('users').update({ storage_used: newUsed }).eq('id', userId);
    } catch (e) {}
  }
  const idx = localDb.users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    localDb.users[idx].storage_used = newUsed;
  }
  return newUsed;
}

// ----------------------------------------------------
// 1. FAST DIRECT NORMAL FILE UPLOAD
// ----------------------------------------------------
router.post('/upload', authMiddleware, upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided for upload.' });
    }

    const userId = await getEffectiveUserId(req.user);
    const currentUsed = await getUserStorageUsed(userId);
    const totalNewSize = files.reduce((acc, f) => acc + f.size, 0);

    if (currentUsed + totalNewSize > STORAGE_LIMIT_BYTES) {
      const remainingMB = ((STORAGE_LIMIT_BYTES - currentUsed) / (1024 * 1024)).toFixed(2);
      return res.status(400).json({
        success: false,
        message: `Upload exceeds your 500MB storage limit. Remaining space: ${remainingMB} MB.`
      });
    }

    const uploadedRecords = [];

    for (const file of files) {
      const fileId = crypto.randomUUID();
      const originalName = file.originalname;
      const ext = path.extname(originalName) || '';
      const mimeType = file.mimetype || 'application/octet-stream';
      const category = getCategory(mimeType, originalName);
      const storagePath = `${userId}/${fileId}${ext}`;

      console.log(`📤 Direct Upload for User ID: ${userId} | File: ${originalName} (${file.size} bytes)`);

      // Store file buffer directly in Supabase Storage bucket
      await uploadToStorage(storagePath, file.buffer, mimeType);

      // Record normal file metadata
      const fileRecord = {
        id: fileId,
        user_id: userId,
        file_name: `${fileId}${ext}`,
        original_name: originalName,
        file_size: file.size,
        file_type: mimeType,
        category,
        storage_path: storagePath,
        encrypted_path: storagePath,
        created_at: new Date().toISOString()
      };

      localDb.files = localDb.files.filter(f => f.id !== fileId);
      localDb.files.push(fileRecord);

      if (supabase) {
        try {
          const { data, error } = await supabase.from('files').insert([fileRecord]).select('*').single();
          if (!error && data) {
            console.log(`✅ File recorded in Supabase DB table "files": ${originalName}`);
            uploadedRecords.push({ ...fileRecord, ...data });
          } else {
            uploadedRecords.push(fileRecord);
          }
        } catch (dbErr) {
          uploadedRecords.push(fileRecord);
        }
      } else {
        uploadedRecords.push(fileRecord);
      }
    }

    // Invalidate scan cache for fast update
    bucketScanCache.delete(userId);
    bucketScanCache.delete(req.user.id);

    const updatedStorageUsed = await updateUserStorage(userId, totalNewSize);

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedRecords.length} file(s).`,
      files: uploadedRecords,
      storage_used: updatedStorageUsed,
      storage_limit: STORAGE_LIMIT_BYTES
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error during file upload.' });
  }
});

// ----------------------------------------------------
// 2. FILE LISTING (NORMAL FILE TITLES)
// ----------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category, q } = req.query;
    const userId = await getEffectiveUserId(req.user);
    const userEmail = (req.user.email || '').toLowerCase().trim();
    const fileMap = new Map();

    if (supabase) {
      try {
        const { data, error } = await supabase.from('files').select('*');
        if (!error && data && data.length > 0) {
          for (const f of data) {
            if (f.user_id === userId || f.user_id === req.user.id) {
              const cleanName = (f.original_name || f.file_name || '').replace('Encrypted_Photo_', 'Photo_').replace('Encrypted_File_', 'File_');
              fileMap.set(f.id, { ...f, original_name: cleanName });
            }
          }
        }
      } catch (e) {}
    }

    const localUserFiles = localDb.files.filter(f => f.user_id === userId || f.user_id === req.user.id);
    for (const f of localUserFiles) {
      const cleanName = (f.original_name || f.file_name || '').replace('Encrypted_Photo_', 'Photo_').replace('Encrypted_File_', 'File_');
      fileMap.set(f.id, { ...fileMap.get(f.id), ...f, original_name: cleanName });
    }

    if (supabase && supabase.storage) {
      const userFolderIds = Array.from(new Set([userId, req.user.id].filter(Boolean)));

      for (const folderId of userFolderIds) {
        const cacheKey = folderId;
        const cached = bucketScanCache.get(cacheKey);
        let bucketFiles = null;

        if (cached && (Date.now() - cached.time < CACHE_TTL_MS)) {
          bucketFiles = cached.data;
        } else {
          try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folderId);
            if (!error && data) {
              bucketFiles = data;
              bucketScanCache.set(cacheKey, { data, time: Date.now() });
            }
          } catch (e) {}
        }

        if (bucketFiles && bucketFiles.length > 0) {
          for (const bf of bucketFiles) {
            if (!bf.name || bf.name.includes('placeholder')) continue;

            const fileId = bf.name.split('.')[0];
            if (!fileMap.has(fileId)) {
              const fileSize = Number(bf.metadata?.size || 0);
              const fileType = bf.metadata?.mimetype || 'image/jpeg';
              const createdDate = bf.created_at || new Date().toISOString();
              const fileExt = path.extname(bf.name) || '.jpg';
              const displayName = `Photo_${fileId.substring(0, 8)}${fileExt}`;

              const recoveredRecord = {
                id: fileId,
                user_id: folderId,
                file_name: bf.name,
                original_name: displayName,
                file_size: fileSize,
                file_type: fileType,
                category: getCategory(fileType, displayName),
                storage_path: `${folderId}/${bf.name}`,
                encrypted_path: `${folderId}/${bf.name}`,
                created_at: createdDate
              };

              fileMap.set(fileId, recoveredRecord);
              localDb.files.push(recoveredRecord);
            }
          }
        }
      }
    }

    let mergedFiles = Array.from(fileMap.values());

    if (category && category !== 'All') {
      mergedFiles = mergedFiles.filter(f => f.category === category);
    }

    if (q) {
      const searchTerm = q.toLowerCase();
      mergedFiles = mergedFiles.filter(f =>
        (f.original_name || '').toLowerCase().includes(searchTerm) ||
        (f.category || '').toLowerCase().includes(searchTerm)
      );
    }

    const normalizedFiles = mergedFiles.map(f => {
      const rawName = (f.original_name || f.file_name || 'Photo').replace('Encrypted_Photo_', 'Photo_').replace('Encrypted_File_', 'File_');
      return {
        id: f.id,
        user_id: f.user_id || userId,
        file_name: f.file_name || `${f.id}`,
        original_name: rawName,
        file_size: Number(f.file_size || 0),
        file_type: f.file_type || 'image/jpeg',
        category: f.category || getCategory(f.file_type || '', rawName),
        storage_path: f.encrypted_path || f.storage_path,
        encrypted_path: f.encrypted_path || f.storage_path,
        created_at: f.created_at || new Date().toISOString()
      };
    });

    normalizedFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const actualTotalBytes = normalizedFiles.reduce((sum, f) => sum + f.file_size, 0);
    const recordedUsed = await getUserStorageUsed(userId);
    const finalStorageUsed = Math.max(actualTotalBytes, recordedUsed);

    res.json({
      success: true,
      files: normalizedFiles,
      storage: {
        used: finalStorageUsed,
        limit: STORAGE_LIMIT_BYTES,
        percentage: Math.min(100, parseFloat(((finalStorageUsed / STORAGE_LIMIT_BYTES) * 100).toFixed(1)))
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving files.' });
  }
});

// ----------------------------------------------------
// 3. STREAM & VIEW NORMAL FILE / PHOTO
// ----------------------------------------------------
router.get('/:id/view', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = await getEffectiveUserId(req.user);
    let fileRecord = null;

    if (supabase) {
      try {
        const { data } = await supabase.from('files').select('*').eq('id', id).single();
        fileRecord = data;
      } catch (e) {}
    }
    if (!fileRecord) {
      fileRecord = localDb.files.find(f => f.id === id);
    }

    const storagePath = fileRecord ? (fileRecord.encrypted_path || fileRecord.storage_path) : `${userId}/${id}`;
    
    let buffer;
    try {
      buffer = await downloadFromStorage(storagePath);
    } catch (e1) {
      try {
        buffer = await downloadFromStorage(`${req.user.id}/${id}`);
      } catch (e2) {
        buffer = await downloadFromStorage(`${userId}/${id}.enc`);
      }
    }

    const detectedMime = detectMimeFromBuffer(buffer, fileRecord?.file_type || 'image/jpeg');
    const rawName = (fileRecord && fileRecord.original_name) ? fileRecord.original_name.replace('Encrypted_Photo_', 'Photo_') : 'file';

    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.setHeader('Content-Type', detectedMime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(rawName)}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve file for viewing.' });
  }
});

// ----------------------------------------------------
// 4. DOWNLOAD FILE
// ----------------------------------------------------
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = await getEffectiveUserId(req.user);
    let fileRecord = null;

    if (supabase) {
      try {
        const { data } = await supabase.from('files').select('*').eq('id', id).single();
        fileRecord = data;
      } catch (e) {}
    }
    if (!fileRecord) {
      fileRecord = localDb.files.find(f => f.id === id);
    }

    const storagePath = fileRecord ? (fileRecord.encrypted_path || fileRecord.storage_path) : `${userId}/${id}`;
    let buffer;
    try {
      buffer = await downloadFromStorage(storagePath);
    } catch (e1) {
      try {
        buffer = await downloadFromStorage(`${req.user.id}/${id}`);
      } catch (e2) {
        buffer = await downloadFromStorage(`${userId}/${id}.enc`);
      }
    }

    const rawName = (fileRecord && fileRecord.original_name) ? fileRecord.original_name.replace('Encrypted_Photo_', 'Photo_') : 'download';

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(rawName)}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ success: false, message: 'Failed to download file.' });
  }
});

// ----------------------------------------------------
// 5. DELETE FILE & PURGE FROM STORAGE
// ----------------------------------------------------
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = await getEffectiveUserId(req.user);
    let fileRecord = null;

    if (supabase) {
      try {
        const { data } = await supabase.from('files').select('*').eq('id', id).single();
        fileRecord = data;
      } catch (e) {}
    }
    if (!fileRecord) {
      fileRecord = localDb.files.find(f => f.id === id);
    }

    const storagePath = fileRecord ? (fileRecord.encrypted_path || fileRecord.storage_path) : `${userId}/${id}`;

    try {
      await deleteFromStorage(storagePath);
    } catch (e) {}

    if (supabase) {
      try {
        await supabase.from('files').delete().eq('id', id);
      } catch (e) {}
    }
    localDb.files = localDb.files.filter(f => f.id !== id);

    bucketScanCache.delete(userId);
    bucketScanCache.delete(req.user.id);

    const fileSize = fileRecord ? fileRecord.file_size : 0;
    const updatedStorageUsed = await updateUserStorage(userId, -Math.abs(fileSize));

    res.json({
      success: true,
      message: 'File permanently deleted.',
      storage_used: updatedStorageUsed
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete file.' });
  }
});

// ----------------------------------------------------
// 6. GET USER FILES LIST (MY-FILES API ROUTE)
// ----------------------------------------------------
router.get('/my-files', authMiddleware, async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    const fileMap = new Map();

    if (supabase) {
      try {
        const { data } = await supabase.from('files').select('*');
        if (data && data.length > 0) {
          for (const f of data) {
            if (f.user_id === userId || f.user_id === req.user.id) {
              const cleanName = (f.original_name || f.file_name || '').replace('Encrypted_Photo_', 'Photo_').replace('Encrypted_File_', 'File_');
              fileMap.set(f.id, { ...f, original_name: cleanName });
            }
          }
        }
      } catch (e) {}
    }

    const localUserFiles = localDb.files.filter(f => f.user_id === userId || f.user_id === req.user.id);
    for (const f of localUserFiles) {
      const cleanName = (f.original_name || f.file_name || '').replace('Encrypted_Photo_', 'Photo_').replace('Encrypted_File_', 'File_');
      fileMap.set(f.id, { ...fileMap.get(f.id), ...f, original_name: cleanName });
    }

    if (supabase && supabase.storage) {
      const userFolderIds = Array.from(new Set([userId, req.user.id].filter(Boolean)));
      for (const folderId of userFolderIds) {
        const cacheKey = folderId;
        const cached = bucketScanCache.get(cacheKey);
        let bucketFiles = null;

        if (cached && (Date.now() - cached.time < CACHE_TTL_MS)) {
          bucketFiles = cached.data;
        } else {
          try {
            const { data } = await supabase.storage.from(BUCKET_NAME).list(folderId);
            if (data) {
              bucketFiles = data;
              bucketScanCache.set(cacheKey, { data, time: Date.now() });
            }
          } catch (e) {}
        }

        if (bucketFiles && bucketFiles.length > 0) {
          for (const bf of bucketFiles) {
            if (!bf.name || bf.name.includes('placeholder')) continue;
            const fileId = bf.name.split('.')[0];
            if (!fileMap.has(fileId)) {
              const fileSize = Number(bf.metadata?.size || 0);
              const fileType = bf.metadata?.mimetype || 'image/jpeg';
              const createdDate = bf.created_at || new Date().toISOString();
              const fileExt = path.extname(bf.name) || '.jpg';
              const displayName = `Photo_${fileId.substring(0, 8)}${fileExt}`;

              fileMap.set(fileId, {
                id: fileId,
                user_id: folderId,
                file_name: bf.name,
                original_name: displayName,
                file_size: fileSize,
                file_type: fileType,
                category: getCategory(fileType, displayName),
                storage_path: `${folderId}/${bf.name}`,
                encrypted_path: `${folderId}/${bf.name}`,
                created_at: createdDate
              });
            }
          }
        }
      }
    }

    const fileList = Array.from(fileMap.values()).map(f => {
      const rawName = (f.original_name || f.file_name || 'Photo').replace('Encrypted_Photo_', 'Photo_').replace('Encrypted_File_', 'File_');
      return {
        id: f.id,
        user_id: f.user_id || userId,
        file_name: f.file_name || `${f.id}`,
        original_name: rawName,
        file_size: Number(f.file_size || 0),
        file_type: f.file_type || 'application/octet-stream',
        category: f.category || getCategory(f.file_type || '', rawName),
        storage_path: f.encrypted_path || f.storage_path,
        encrypted_path: f.encrypted_path || f.storage_path,
        created_at: f.created_at || new Date().toISOString()
      };
    });

    fileList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(fileList);
  } catch (err) {
    console.error('Error fetching /my-files:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;