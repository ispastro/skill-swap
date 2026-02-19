import { Request, Response } from 'express';
import prisma from '../config/db.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'skillSwap';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(' Supabase env vars not set — file operations will be unavailable');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

export const logFileMetadata = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.user!.id;
        const { filename, originalName, path, mimetype, size, chatId } = req.body;
        if (!filename || !originalName || !path || !mimetype || !size) {
            return res.status(400).json({ error: 'Missing file metadata' });
        }

        const fileData: {
            filename: string;
            originalName: string;
            path: string;
            mimetype: string;
            size: number;
            uploaderId: string;
            chatId?: string;
        } = {
            filename,
            originalName,
            path,
            mimetype,
            size: Number(size),
            uploaderId: userId,
        };
        if (chatId) fileData.chatId = chatId;

        const savedFile = await prisma.file.create({ data: fileData });
        return res.status(201).json(savedFile);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        return res.status(500).json({ error: 'Metadata logging failed', details: errMsg });
    }
};

export const listFiles = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.user!.id;
        const files = await prisma.file.findMany({ where: { uploaderId: userId } });
        return res.json(files);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        return res.status(500).json({ error: 'Failed to fetch files', details: errMsg });
    }
};

export const downloadFile = async (req: Request, res: Response): Promise<Response | void> => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.id;
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.uploaderId !== userId) {
            return res.status(403).json({ error: 'Forbidden: Not your file' });
        }
        return res.redirect(file.path);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        return res.status(500).json({ error: 'Download failed', details: errMsg });
    }
};

export const deleteFile = async (req: Request, res: Response): Promise<Response> => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.id;
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.uploaderId !== userId) {
            return res.status(403).json({ error: 'Forbidden: Not your file' });
        }
        if (supabase) {
            await supabase.storage.from(BUCKET).remove([file.filename]);
        }
        await prisma.file.delete({ where: { id } });
        return res.json({ message: 'File deleted' });
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        return res.status(500).json({ error: 'Delete failed', details: errMsg });
    }
};
