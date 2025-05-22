import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table definition
export const users = pgTable("users", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "set null" }), 
  twoFactor: boolean("two_factor").default(false)
});

// Define user relations
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  refreshTokens: many(refreshTokens),
  userPermissions: many(userPermissions),
}));

// Define roles table
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  name: varchar("name").notNull().unique(),
  description: varchar("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define roles relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

// Define permissions table
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  name: varchar("name").notNull().unique(),
  description: varchar("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define permissions relations
export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userPermissions: many(userPermissions),
}));

// Define role permissions junction table
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define role permissions relations
export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Define user permissions junction table
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define user permissions relations
export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
  permission: one(permissions, {
    fields: [userPermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Define refresh tokens table
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define refresh tokens relations
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// Define OTP table
export const otps = pgTable("otps", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  otp: varchar("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  purpose: varchar("purpose").notNull(),
  attempts: integer("attempts").default(0),
});

// Define OTP relations
export const otpsRelations = relations(otps, ({ one }) => ({
  user: one(users, {
    fields: [otps.userId],
    references: [users.id],
  }),
}));

// Define secrets table
export const secrets = pgTable("secrets", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  value: varchar("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define secrets relations
export const secretsRelations = relations(secrets, ({ one }) => ({
  user: one(users, {
    fields: [secrets.userId],
    references: [users.id],
  }),
}));

// Define the insert schema for users
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
    verifiedAt: true,
    twoFactor: true,
  });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;