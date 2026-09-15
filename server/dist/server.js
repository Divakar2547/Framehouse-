"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const prisma_1 = __importDefault(require("./config/prisma"));
async function start() {
    try {
        // Test database connection
        await prisma_1.default.$connect();
        console.log('✅ Database connected');
        const server = app_1.default.listen(env_1.env.PORT, () => {
            console.log(`\n🚀 Server running on port ${env_1.env.PORT}`);
            console.log(`   Environment: ${env_1.env.NODE_ENV}`);
            console.log(`   API:         ${env_1.env.SERVER_URL}/api`);
            console.log(`   Health:      ${env_1.env.SERVER_URL}/health\n`);
        });
        // Graceful shutdown
        const shutdown = async (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            server.close(async () => {
                await prisma_1.default.$disconnect();
                console.log('✅ Server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (err) {
        console.error('❌ Failed to start server:', err);
        await prisma_1.default.$disconnect();
        process.exit(1);
    }
}
start();
//# sourceMappingURL=server.js.map