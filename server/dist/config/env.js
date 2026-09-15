"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
// Node 20+ loads a local .env file without an additional runtime dependency.
process.loadEnvFile?.();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.string().default('5000'),
    CLIENT_URL: zod_1.z.string().default('http://localhost:5173'),
    SERVER_URL: zod_1.z.string().default('http://localhost:5000'),
    DATABASE_URL: zod_1.z.string(),
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    GALLERY_SESSION_SECRET: zod_1.z.string().min(32, 'GALLERY_SESSION_SECRET must be at least 32 characters'),
    AWS_REGION: zod_1.z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    AWS_S3_BUCKET: zod_1.z.string().optional(),
    MAX_FILE_SIZE: zod_1.z.string().default('52428800'),
    RATE_LIMIT_WINDOW_MS: zod_1.z.string().default('900000'),
    RATE_LIMIT_MAX: zod_1.z.string().default('100'),
    PIN_RATE_LIMIT_MAX: zod_1.z.string().default('5'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // Only fail hard in non-test environments that need all vars
    if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Invalid environment variables:');
        console.error(parsed.error.flatten().fieldErrors);
        // Don't exit — allow missing AWS vars in dev
    }
}
exports.env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '5000', 10),
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    SERVER_URL: process.env.SERVER_URL || 'http://localhost:5000',
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-must-be-long',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    GALLERY_SESSION_SECRET: process.env.GALLERY_SESSION_SECRET || 'dev-gallery-session-secret-change-in-production',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    PIN_RATE_LIMIT_MAX: parseInt(process.env.PIN_RATE_LIMIT_MAX || '5', 10),
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test',
};
//# sourceMappingURL=env.js.map