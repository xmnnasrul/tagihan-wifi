import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/),
  password: z.string().min(1).refine(
    (password) => new TextEncoder().encode(password).length <= 72,
    'Password terlalu panjang',
  ),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;