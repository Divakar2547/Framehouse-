"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = hashToken;
exports.generateSecureToken = generateSecureToken;
exports.generateSlug = generateSlug;
exports.hashIp = hashIp;
const crypto_1 = __importDefault(require("crypto"));
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
function generateSecureToken(bytes = 32) {
    return crypto_1.default.randomBytes(bytes).toString('hex');
}
function generateSlug(title) {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        .substring(0, 50);
    const suffix = crypto_1.default.randomBytes(4).toString('hex');
    return `${base}-${suffix}`;
}
function hashIp(ip) {
    return crypto_1.default.createHash('sha256').update(ip + 'ip-salt-privacy').digest('hex').substring(0, 16);
}
//# sourceMappingURL=crypto.js.map