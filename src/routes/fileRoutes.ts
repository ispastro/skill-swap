import express, { Router } from 'express';
import { logFileMetadata, listFiles, downloadFile, deleteFile } from '../controllers/fileController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router: Router = express.Router();

// Log file metadata after frontend upload
router.post('/upload', authMiddleware, logFileMetadata);

// List user's files
router.get('/', authMiddleware, listFiles);

// Download a file by id
router.get('/:id/download', authMiddleware, downloadFile);

// Delete a file by id
router.delete('/:id', authMiddleware, deleteFile);

export default router;
