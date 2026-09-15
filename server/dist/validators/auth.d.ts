import { z } from 'zod';
export declare const registerSchema: any;
export declare const loginSchema: any;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
//# sourceMappingURL=auth.d.ts.map