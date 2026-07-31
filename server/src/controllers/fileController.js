const path = require('path');
const crypto = require('crypto');
const { supabase, isSupabaseConfigured, uploadToStorage, downloadFromStorage, deleteFromStorage, localDb, BUCKET_NAME } = require('../services/supabaseService');

const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB limit

// Fast In-Memory Cache for Supabase Bucket Scanning (TTL 30 seconds)
const bucketScanCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

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
  const user = localDb.users.find(u => u.id === userId);
  if (user) {
    user.storage_used = newUsed;
  }
}

/**
 * LIST FILES (Supports Category, Search Query, and Pagination)
 */
const listFiles = async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    const { category, search, page = 1, limit = 50 } = req.query;

    let files = [];

    // 1. Fetch from Supabase metadata table if configured
    if (supabase) {
      try {
        let query = supabase.from('files').select('*').eq('user_id', userId);
        if (category && category !== 'All') {
          query = query.eq('category', category);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) {
          files = data;
        }
      } catch (e) {}
    }

    // 2. Scan Supabase bucket files directly if empty metadata
    if (files.length === 0 && isSupabaseConfigured()) {
      try {
        const cacheKey = `bucket_files_${userId}`;
        const cached = bucketScanCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
          files = cached.data;
        } else {
          const userPrefix = `${userId}/`;
          const { data: storageObjects, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(userPrefix, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

          if (!error && storageObjects) {
            files = storageObjects
              .filter(obj => obj.name && !obj.name.endsWith('.emptyFolderPlaceholder'))
              .map(obj => {
                const parts = obj.name.split('_');
                let originalName = obj.name;
                if (parts.length > 2) {
                  originalName = parts.slice(2).join('_');
                }
                const mimeType = obj.metadata?.mimetype || 'application/octet-stream';
                return {
                  id: obj.id || obj.name,
                  user_id: userId,
                  filename: originalName,
                  storage_path: `${userPrefix}${obj.name}`,
                  mime_type: mimeType,
                  size_bytes: obj.metadata?.size || obj.size || 0,
                  category: getCategory(mimeType, originalName),
                  created_at: obj.created_at || new Date().toISOString()
                };
              });

            bucketScanCache.set(cacheKey, { timestamp: Date.now(), data: files });
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to local memory DB
    if (files.length === 0) {
      files = localDb.files.filter(f => f.user_id === userId || f.userId === userId);
    }

    // Apply Filter & Search
    if (category && category !== 'All') {
      files = files.filter(f => (f.category || '').toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      files = files.filter(f => (f.filename || '').toLowerCase().includes(q));
    }

    // Apply Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const totalFiles = files.length;
    const totalPages = Math.ceil(totalFiles / limitNum);
    const paginatedFiles = files.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const totalStorageUsed = await getUserStorageUsed(userId);

    return res.json({
      success: true,
      files: paginatedFiles,
      pagination: {
        totalFiles,
        totalPages,
        currentPage: pageNum,
        limit: limitNum
      },
      storage: {
        used: totalStorageUsed,
        limit: STORAGE_LIMIT_BYTES,
        usedPercentage: Math.min(100, Math.round((totalStorageUsed / STORAGE_LIMIT_BYTES) * 100))
      }
    });
  } catch (error) {
    console.error('List Files Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve files.' });
  }
};

/**
 * UPLOAD FILES (Zero-Knowledge encrypted file batch)
 */
const uploadFiles = async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const currentUsed = await getUserStorageUsed(userId);
    const newFilesTotalSize = req.files.reduce((sum, f) => sum + f.size, 0);

    if (currentUsed + newFilesTotalSize > STORAGE_LIMIT_BYTES) {
      return res.status(400).json({
        success: false,
        message: 'Storage limit exceeded (500 MB limit).'
      });
    }

    const uploadedRecords = [];

    for (const file of req.files) {
      const fileId = crypto.randomUUID();
      const filename = req.body.originalName || file.originalname || 'encrypted_file.bin';
      const category = getCategory(file.mimetype, filename);
      const isEncrypted = req.body.isEncrypted === 'true' || true;
      const storagePath = `${userId}/${fileId}_${filename}`;

      // Upload to Supabase Storage or Local Storage
      const storageResult = await uploadToStorage(storagePath, file.buffer, file.mimetype);

      const record = {
        id: fileId,
        user_id: userId,
        filename,
        storage_path: storagePath,
        mime_type: file.mimetype || 'application/octet-stream',
        size_bytes: file.size,
        category,
        is_encrypted: isEncrypted,
        encryption_iv: req.body.iv || null,
        local_url: storageResult.localUrl || null,
        created_at: new Date().toISOString()
      };

      // Save to Supabase DB table if available
      if (supabase) {
        try {
          await supabase.from('files').insert([record]);
        } catch (e) {}
      }

      localDb.files.push(record);
      uploadedRecords.push(record);
    }

    await updateUserStorage(userId, newFilesTotalSize);
    bucketScanCache.delete(`bucket_files_${userId}`);

    return res.status(201).json({
      success: true,
      message: `${uploadedRecords.length} file(s) uploaded successfully.`,
      files: uploadedRecords
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ success: false, message: 'File upload failed.' });
  }
};

/**
 * DOWNLOAD ENCRYPTED FILE CONTROLLER
 */
const downloadFile = async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    const fileId = req.params.id;

    let fileRecord = localDb.files.find(f => (f.id === fileId || f.storage_path?.includes(fileId)) && (f.user_id === userId || f.userId === userId));

    if (!fileRecord && supabase) {
      try {
        const { data } = await supabase.from('files').select('*').eq('id', fileId).single();
        if (data) fileRecord = data;
      } catch (e) {}
    }

    const storagePath = fileRecord ? fileRecord.storage_path : `${userId}/${fileId}`;
    const fileBuffer = await downloadFromStorage(storagePath);

    if (!fileBuffer) {
      return res.status(404).json({ success: false, message: 'File payload not found in vault storage.' });
    }

    res.setHeader('Content-Type', fileRecord?.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord?.filename || 'vault_file'}"`);
    return res.send(fileBuffer);
  } catch (error) {
    console.error('Download Error:', error);
    return res.status(500).json({ success: false, message: 'Download failed.' });
  }
};

/**
 * THUMBNAIL / MEDIA PREVIEW CONTROLLER
 */
const getThumbnail = async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    const fileId = req.params.id;

    let fileRecord = localDb.files.find(f => (f.id === fileId || f.storage_path?.includes(fileId)) && (f.user_id === userId || f.userId === userId));
    const storagePath = fileRecord ? fileRecord.storage_path : `${userId}/${fileId}`;

    const fileBuffer = await downloadFromStorage(storagePath);
    if (!fileBuffer) {
      return res.status(404).send('Not found');
    }

    const detectedMime = detectMimeFromBuffer(fileBuffer, fileRecord?.mime_type || 'image/jpeg');
    res.setHeader('Content-Type', detectedMime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(fileBuffer);
  } catch (error) {
    return res.status(500).send('Error loading preview');
  }
};

/**
 * DELETE SINGLE FILE CONTROLLER
 */
const deleteFile = async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    const fileId = req.params.id;

    let fileRecord = localDb.files.find(f => (f.id === fileId || f.storage_path?.includes(fileId)) && (f.user_id === userId || f.userId === userId));

    if (!fileRecord && supabase) {
      try {
        const { data } = await supabase.from('files').select('*').eq('id', fileId).single();
        if (data) fileRecord = data;
      } catch (e) {}
    }

    const storagePath = fileRecord ? fileRecord.storage_path : `${userId}/${fileId}`;
    const fileSize = fileRecord?.size_bytes || 0;

    await deleteFromStorage(storagePath);

    if (supabase) {
      try {
        await supabase.from('files').delete().eq('id', fileId);
      } catch (e) {}
    }

    localDb.files = localDb.files.filter(f => f.id !== fileId && f.storage_path !== storagePath);

    await updateUserStorage(userId, -fileSize);
    bucketScanCache.delete(`bucket_files_${userId}`);

    return res.json({ success: true, message: 'File deleted from vault.' });
  } catch (error) {
    console.error('Delete Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete file.' });
  }
};

/**
 * PURGE ALL USER DATA & FILES
 */
const purgeAll = async (req, res) => {
  try {
    const userId = await getEffectiveUserId(req.user);
    const userFiles = localDb.files.filter(f => f.user_id === userId || f.userId === userId);

    for (const f of userFiles) {
      await deleteFromStorage(f.storage_path);
    }

    localDb.files = localDb.files.filter(f => f.user_id !== userId && f.userId !== userId);
    await updateUserStorage(userId, -999999999999);
    bucketScanCache.delete(`bucket_files_${userId}`);

    return res.json({ success: true, message: 'All files purged successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to purge files.' });
  }
};

module.exports = {
  listFiles,
  uploadFiles,
  downloadFile,
  getThumbnail,
  deleteFile,
  purgeAll
};
