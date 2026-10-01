import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
export const auth = betterAuth({
  appName: "AD Digital Platform",
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.APP_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [process.env.APP_URL || "http://127.0.0.1:3000"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 20,
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false },
      assignedConstituencyId: { type: "string", required: false, input: false },
      disabled: { type: "boolean", defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
          });
          if (!user || user.disabled) return false;
          await db.auditLog.create({
            data: {
              actorUserId: user.id,
              action: "LOGIN",
              entityType: "User",
              entityId: user.id,
            },
          });
          return { data: session };
        },
      },
    },
  },
});
