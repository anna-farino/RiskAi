import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from 'drizzle-orm';
import { capsuleArticles } from "./news-capsule";

export const auth0Ids = pgTable("auth0_ids", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  auth0Id: text("auth0_id").notNull().unique()
})

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const allowedEmails = pgTable("allowed_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at")
});

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  capsuleArticles: many(capsuleArticles),
  auth0Ids: many(auth0Ids)
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  })
}));

export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true });
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({ createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = typeof insertUserSchema._type;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof insertRefreshTokenSchema._type;
