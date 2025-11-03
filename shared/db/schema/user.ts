import { pgTable, text, timestamp, uuid, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from 'drizzle-orm';
import { capsuleArticles } from "./news-capsule";
import { organizations } from "./organizations";

export const accountStatusEnum = pgEnum('account_status', [
  'active',
  'pending_deletion',
  'deleted',
]);

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
  organizationId: uuid("organization_id").references(() => organizations.id),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  //
  onBoarded: boolean("onboarded").default(false),
  subFree: boolean("sub_free").default(false),
  noSubModeEnabled: boolean("no_sub_mode_enabled").default(false),
  accountStatus: accountStatusEnum("account_status").default('active'),
  accountDeletedAt: timestamp("account_deleted_at"),
});

export const subFreeUsers = pgTable("sub_free_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  pattern: text("pattern").notNull().unique(), // email or domain pattern
  description: text("description"), // optional note about who/why
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id]
  }),
  refreshTokens: many(refreshTokens),
  capsuleArticles: many(capsuleArticles)
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
export type Auth0Ids = typeof auth0Ids.$inferSelect;
export type InsertUser = typeof insertUserSchema._type;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof insertRefreshTokenSchema._type;
export type AllowedEmails = typeof allowedEmails.$inferSelect;



