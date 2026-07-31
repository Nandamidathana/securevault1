const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const {
  listFiles,
  uploadFiles,
  downloadFile,
  getThumbnail,
  deleteFile,
  purgeAll
} = require('../controllers/fileController');

const router = express.Router();

// Multer memory storage configuration (Max 20 files per upload batch)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
    files: 20 // Max 20 files per batch
  }
});

// All file routes require authentication
router.use(authMiddleware);

// Routes definition
router.get('/', listFiles);
router.post('/upload', upload.array('files', 20), uploadFiles);
router.get('/:id/download', downloadFile);
router.get('/:id/thumbnail', getThumbnail);
router.delete('/:id', deleteFile);
router.delete('/purge/all', purgeAll);

module.exports = router;