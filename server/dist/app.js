"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const event_routes_1 = __importDefault(require("./routes/event.routes"));
const photo_routes_1 = __importDefault(require("./routes/photo.routes"));
const gallery_routes_1 = __importDefault(require("./routes/gallery.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const app = (0, express_1.default)();
// ─── Security Headers ──────────────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: env_1.env.isProduction
        ? undefined
        : false, // Relax CSP in development
    crossOriginEmbedderPolicy: false,
}));
// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: env_1.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', rateLimiter_1.globalRateLimiter);
// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', environment: env_1.env.NODE_ENV, timestamp: new Date().toISOString() });
});
// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', auth_routes_1.default);
app.use('/api/events', event_routes_1.default);
app.use('/api', photo_routes_1.default); // handles /api/events/:id/photos and /api/photos/:id
app.use('/api', gallery_routes_1.default); // handles /api/events/:id/galleries and /api/galleries/:id
app.use('/api/public/gallery', public_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.globalErrorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map