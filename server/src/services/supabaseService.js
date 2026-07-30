const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'vault-storage';

// Check if valid Supabase URL is configured
const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  !SUPABASE_URL.includes('your-supabase-project') &&
  SUPABASE_SERVICE_ROLE_KEY &&
  !SUPABASE_SERVICE_ROLE_KEY.includes('your-supabase')
);

let supabase = null;
if (isSupabaseConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log('✅ Supabase Client Initialized with URL:', SUPABASE_URL);
} else {
  console.log('⚠️ Supabase credentials not provided or placeholder. Using local storage fallback mode for immediate operation.');
}

// In-Memory & Local Storage Fallback Directory if Supabase credentials are not live yet
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../.local_storage');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

// Local In-Memory DB state if Supabase DB is offline
const localDb = {
  users: [],
  otps: [],
  files: []
};

/**
 * Upload encrypted buffer to Supabase bucket or local fallback
 */
async function uploadToStorage(storagePath, buffer, mimeType = 'application/octet-stream') {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Supabase Storage Upload Error:', error);
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
    return data.path;
  } else {
    const localFilePath = path.join(LOCAL_STORAGE_DIR, storagePath.replace(/\//g, '_'));
    fs.writeFileSync(localFilePath, buffer);
    return storagePath;
  }
}

/**
 * Download encrypted buffer from Supabase bucket or local fallback
 */
async function downloadFromStorage(storagePath) {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      console.error('Supabase Storage Download Error:', error);
      throw new Error(`Supabase Storage download failed: ${error.message}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    const localFilePath = path.join(LOCAL_STORAGE_DIR, storagePath.replace(/\//g, '_'));
    if (!fs.existsSync(localFilePath)) {
      throw new Error('File not found in local storage fallback');
    }
    return fs.readFileSync(localFilePath);
  }
}

/**
 * Delete file from Supabase bucket or local fallback
 */
async function deleteFromStorage(storagePath) {
  if (supabase) {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error('Supabase Storage Delete Error:', error);
    }
  } else {
    const localFilePath = path.join(LOCAL_STORAGE_DIR, storagePath.replace(/\//g, '_'));
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (e) {
        console.warn('Local file unlink notice:', e.message);
      }
    }
  }
}

/**
 * Permanently Purge User Account and All Associated Files/Data from Database and Memory
 */
async function purgeUserAccount(userId, userEmail) {
  const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';

  console.log(`🔥 Executing permanent purgeUserAccount for userId: ${userId}, email: ${cleanEmail}`);

  // 1. Delete from Supabase Database
  if (supabase) {
    try {
      await supabase.from('files').delete().eq('user_id', userId);
      if (cleanEmail) await supabase.from('otps').delete().eq('email', cleanEmail);
      
      const { error: err1 } = await supabase.from('users').delete().eq('id', userId);
      if (err1 && cleanEmail) {
        await supabase.from('users').delete().eq('email', cleanEmail);
      }
      if (cleanEmail) {
        await supabase.from('users').delete().eq('email', cleanEmail);
      }
    } catch (dbErr) {
      console.error('Supabase DB purge error:', dbErr.message);
    }
  }

  // 2. In-Place Array Mutation Purge for localDb (removes from memory completely)
  for (let i = localDb.users.length - 1; i >= 0; i--) {
    const u = localDb.users[i];
    if (u.id === userId || (cleanEmail && u.email.toLowerCase().trim() === cleanEmail)) {
      console.log(`🗑️ Removing user from localDb array at index ${i}:`, u.email);
      localDb.users.splice(i, 1);
    }
  }

  for (let i = localDb.files.length - 1; i >= 0; i--) {
    if (localDb.files[i].user_id === userId) {
      localDb.files.splice(i, 1);
    }
  }

  if (cleanEmail) {
    for (let i = localDb.otps.length - 1; i >= 0; i--) {
      if (localDb.otps[i].email.toLowerCase().trim() === cleanEmail) {
        localDb.otps.splice(i, 1);
      }
    }
  }

  console.log('✅ purgeUserAccount finished. Remaining users count:', localDb.users.length);
}

module.exports = {
  supabase,
  isSupabaseConfigured,
  uploadToStorage,
  downloadFromStorage,
  deleteFromStorage,
  purgeUserAccount,
  localDb,
  BUCKET_NAME
};
