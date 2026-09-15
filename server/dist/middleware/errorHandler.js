"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.notFoundHandler = notFoundHandler;
exports.globalErrorHandler = globalErrorHandler;
const zod_1 = require("zod");
const env_1 = require("../config/env");
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
    });
}
function globalErrorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.flatten().fieldErrors,
        });
        return;
    }
    // Known operational errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
        return;
    }
    // Prisma unique constraint violation
    if (err.code === 'P2002') {
        res.status(409).json({
            success: false,
            message: 'A record with this value already exists.',
        });
        return;
    }
    // Prisma record not found
    if (err.code === 'P2025') {
        res.status(404).json({
            success: false,
            message: 'Record not found.',
        });
        return;
    }
    // Multer file size error
    if (err.message === 'File too large') {
        res.status(413).json({
            success: false,
            message: 'File size exceeds the maximum allowed limit.',
        });
        return;
    }
    // Unknown errors — hide details in production
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'An internal server error occurred.',
        ...(env_1.env.isDevelopment && { error: err.message, stack: err.stack }),
    });
}
//# sourceMappingURL=errorHandler.js.map