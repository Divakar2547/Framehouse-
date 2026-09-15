import { sendError } from '../utils/response.js';
import { hashToken } from '../utils/crypto.js';
import prisma from '../config/prisma.js';

export async function requireGallerySession(req, res, next) {
  try {
    const sessionToken = req.cookies?.gallery_session;
    const slug = req.params.slug;

    if (!sessionToken) {
      sendError(res, 'Gallery access required — please verify your PIN', 401);
      return;
    }

    const tokenHash = hashToken(sessionToken);

    const session = await prisma.galleryAccess.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        gallery: {
          select: { id: true, slug: true, isPublished: true, expiresAt: true },
        },
      },
    });

    if (!session) {
      sendError(res, 'Invalid or expired gallery session', 401);
      return;
    }

    // Check session expiry
    if (session.expiresAt < new Date()) {
      await prisma.galleryAccess.delete({ where: { id: session.id } });
      sendError(res, 'Gallery session expired — please verify your PIN again', 401);
      return;
    }

    // Ensure session belongs to the requested gallery
    if (slug && session.gallery.slug !== slug) {
      sendError(res, 'Invalid gallery session', 403);
      return;
    }

    // Check gallery is still published and not expired
    if (!session.gallery.isPublished) {
      sendError(res, 'This gallery is no longer published', 403);
      return;
    }

    if (session.gallery.expiresAt && session.gallery.expiresAt < new Date()) {
      sendError(res, 'This gallery has expired', 403);
      return;
    }

    // Update last used
    await prisma.galleryAccess.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    req.gallerySession = {
      sessionId: session.id,
      galleryId: session.gallery.id,
    };

    next();
  } catch {
    sendError(res, 'Gallery session error', 500);
  }
}
