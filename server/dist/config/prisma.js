"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const env_1 = require("./env");
const prisma = globalThis.__prisma ??
    new client_1.PrismaClient({
        log: env_1.env.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
    });
if (env_1.env.isDevelopment) {
    globalThis.__prisma = prisma;
}
exports.default = prisma;
//# sourceMappingURL=prisma.js.map