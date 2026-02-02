import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  adapter: {
    type: 'mysql',
    url: 'mysql://root:@localhost:3306/order_platform'
    // إذا عندك كلمة مرور، استبدلها root:كلمة_المرور
  }
});
