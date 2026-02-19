import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validateResult = (req: Request, res: Response, next: NextFunction): Response | void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // Basic diagnostic logging (avoid printing full password)
        const safeBody = { ...req.body };
        if (safeBody.password) safeBody.password = `len:${safeBody.password.length}`;
        console.warn('[Validation] Request failed validation', {
            path: req.path,
            body: safeBody,
            errors: errors.array(),
        });
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: 'path' in err ? err.path : undefined,
                message: err.msg,
            })),
        });
    }

    next();
};
