"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireGallerySession = requireGallerySession;
const response_1 = require("../utils/response");
const crypto_1 = require("../utils/crypto");
const prisma_1 = __importDefault(require("../config/prisma"));
async function requireGallerySession(req, res, next) {
    try {
        const sessionToken = req.cookies?.gallery_session;
        const slug = req.params.slug;
        if (!sessionToken) {
            (0, response_1.sendError)(res, 'Gallery access required — please verify your PIN', 401);
            return;
        }
        const tokenHash = (0, crypto_1.hashToken)(sessionToken);
        const session = await prisma_1.default.galleryAccess.findUnique({
            where: { sessionTokenHash: tokenHash },
            include: {
                gallery: {
                    select: { id: true, slug: true, isPublished: true, expiresAt: true },
                },
            },
        });
        if (!session) {
            (0, response_1.sendError)(res, 'Invalid or expired gallery session', 401);
            return;
        }
        // Check session expiry
        if (session.expiresAt < new Date()) {
            await prisma_1.default.galleryAccess.delete({ where: { id: session.id } });
            (0, response_1.sendError)(res, 'Gallery session expired — please verify your PIN again', 401);
            return;
        }
        // Ensure session belongs to the requested gallery
        if (slug && session.gallery.slug !== slug) {
            (0, response_1.sendError)(res, 'Invalid gallery session', 403);
            return;
        }
        // Check gallery is still published and not expired
        if (!session.gallery.isPublished) {
            (0, response_1.sendError)(res, 'This gallery is no longer published', 403);
            return;
        }
        if (session.gallery.expiresAt && session.gallery.expiresAt < new Date()) {
            (0, response_1.sendError)(res, 'This gallery has expired', 403);
            return;
        }
        // Update last used
        await prisma_1.default.galleryAccess.update({
            where: { id: session.id },
            data: { lastUsedAt: new Date() },
        });
        req.gallerySession = {
            sessionId: session.id,
            galleryId: session.gallery.id,
        };
        next();
    }
    catch {
        (0, response_1.sendError)(res, 'Gallery session error', 500);
    }
}
//# sourceMappingURL=gallerySession.js.map