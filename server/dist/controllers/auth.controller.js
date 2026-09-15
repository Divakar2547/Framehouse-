"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.logout = logout;
exports.getMe = getMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
const prisma_1 = __importDefault(require("../config/prisma"));
const env_1 = require("../config/env");
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env_1.env.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
};
async function register(req, res, next) {
    try {
        const { name, email, password } = req.body;
        const existing = await prisma_1.default.user.findUnique({ where: { email } });
        if (existing) {
            (0, response_1.sendError)(res, 'An account with this email already exists', 409);
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.default.user.create({
            data: { name, email, passwordHash, role: 'ADMIN' },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        const token = (0, jwt_1.signToken)({ userId: user.id, email: user.email, role: user.role });
        res.cookie('token', token, COOKIE_OPTIONS);
        await (0, auditLog_1.createAuditLog)({
            userId: user.id,
            action: 'USER_REGISTERED',
            details: { email: user.email },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        (0, response_1.sendSuccess)(res, { user }, 'Registration successful', 201);
    }
    catch (err) {
        next(err);
    }
}
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                passwordHash: true,
                isActive: true,
                avatarUrl: true,
            },
        });
        // Use constant-time comparison to prevent user enumeration
        const dummyHash = '$2a$12$dummy.hash.for.timing.safety.only.xxxxxxxxxxxxxxxxxx';
        const passwordMatch = user
            ? await bcryptjs_1.default.compare(password, user.passwordHash)
            : await bcryptjs_1.default.compare(password, dummyHash).then(() => false);
        if (!user || !passwordMatch) {
            (0, response_1.sendError)(res, 'Invalid email or password', 401);
            return;
        }
        if (!user.isActive) {
            (0, response_1.sendError)(res, 'This account has been deactivated', 401);
            return;
        }
        const token = (0, jwt_1.signToken)({ userId: user.id, email: user.email, role: user.role });
        res.cookie('token', token, COOKIE_OPTIONS);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id,
            action: 'USER_LOGIN',
            details: { email: user.email },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        (0, response_1.sendSuccess)(res, {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        }, 'Login successful');
    }
    catch (err) {
        next(err);
    }
}
async function logout(req, res, next) {
    try {
        if (req.user) {
            await (0, auditLog_1.createAuditLog)({
                userId: req.user.id,
                action: 'USER_LOGOUT',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
        }
        res.clearCookie('token', { path: '/' });
        (0, response_1.sendSuccess)(res, null, 'Logged out successfully');
    }
    catch (err) {
        next(err);
    }
}
async function getMe(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Not authenticated', 401);
            return;
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
        if (!user) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        (0, response_1.sendSuccess)(res, { user });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=auth.controller.js.map