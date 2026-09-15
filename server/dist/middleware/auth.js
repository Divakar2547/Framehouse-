"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
exports.requireTeamOrAdmin = requireTeamOrAdmin;
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
const prisma_1 = __importDefault(require("../config/prisma"));
async function authenticate(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const payload = (0, jwt_1.verifyToken)(token);
        // Verify user still exists and is active
        const user = await prisma_1.default.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, name: true, role: true, isActive: true },
        });
        if (!user || !user.isActive) {
            (0, response_1.sendError)(res, 'Account not found or deactivated', 401);
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
        next();
    }
    catch {
        (0, response_1.sendError)(res, 'Invalid or expired token', 401);
    }
}
function requireAdmin(req, res, next) {
    if (!req.user) {
        (0, response_1.sendError)(res, 'Authentication required', 401);
        return;
    }
    if (req.user.role !== 'ADMIN') {
        (0, response_1.sendError)(res, 'Admin access required', 403);
        return;
    }
    next();
}
function requireTeamOrAdmin(req, res, next) {
    if (!req.user) {
        (0, response_1.sendError)(res, 'Authentication required', 401);
        return;
    }
    if (req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_MEMBER') {
        (0, response_1.sendError)(res, 'Access denied', 403);
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map