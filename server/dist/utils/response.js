"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.getPagination = getPagination;
function sendSuccess(res, data, message, statusCode = 200, pagination) {
    const response = {
        success: true,
        data,
        ...(message && { message }),
        ...(pagination && { pagination }),
    };
    return res.status(statusCode).json(response);
}
function sendError(res, message, statusCode = 500, error) {
    const response = {
        success: false,
        message,
        ...(error && { error }),
    };
    return res.status(statusCode).json(response);
}
function getPagination(page, limit) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;
    return { page: pageNum, limit: limitNum, skip };
}
//# sourceMappingURL=response.js.map