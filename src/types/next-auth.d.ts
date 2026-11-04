import type { DefaultSession } from 'next-auth';
import type { UserRole } from './database';

declare module 'next-auth' {
  interface User {
    role?: UserRole;
  }
  interface Session {
    user: DefaultSession['user'] & { id: number; role: UserRole };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: number;
    role: UserRole;
  }
}
