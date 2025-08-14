import prisma from '../config/db.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'skillSwap'; // Must match frontend bucket name
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Log file metadata after frontend upload
export const logFileMetadata = async (req, res) => {
  try {
    const { user } = req;
    const { filename, originalName, path, mimetype, size, chatId } = req.body;
    if (!filename || !originalName || !path || !mimetype || !size) {
      return res.status(400).json({ error: 'Missing file metadata' });
    }
    const fileData = {
      filename,
      originalName,
      path,
      mimetype,
      size: Number(size),
      uploaderId: user.id,
    };
    if (chatId) fileData.chatId = chatId;
    const savedFile = await prisma.file.create({ data: fileData });
    res.status(201).json(savedFile);
  } catch (err) {
    res.status(500).json({ error: 'Metadata logging failed', details: err.message });
  }
};

// List files uploaded by user
export const listFiles = async (req, res) => {
  try {
    const { user } = req;
    const files = await prisma.file.findMany({ where: { uploaderId: user.id } });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch files', details: err.message });
  }
};

// Download file (redirect to Supabase public URL)
export const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const file = await prisma.file.findUnique({ where: { id: parseInt(id) } });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.uploaderId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: Not your file' });
    }
    return res.redirect(file.path);
  } catch (err) {
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
};

// Delete file from Supabase Storage and DB
export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const file = await prisma.file.findUnique({ where: { id: parseInt(id) } });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.uploaderId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: Not your file' });
    }
    // Remove from Supabase Storage
    await supabase.storage.from(BUCKET).remove([file.filename]);
    // Remove from DB
    await prisma.file.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
};