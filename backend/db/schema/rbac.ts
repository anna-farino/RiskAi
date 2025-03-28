import { relations } from "drizzle-orm";
import { pgTable, uuid, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./user";

// Permissions table
export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique()
});

// Roles table
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique()
});

// Connecting table between roles and users
export const rolesUsers = pgTable("roles_users", {
  userId: integer("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
});

// Connecting table between roles and permissions
export const rolesPermissions = pgTable("roles_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id),
});

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(rolesUsers),
  permissions: many(rolesPermissions)
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolesPermissions)
}));

// Create insert schemas for validation
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true });
export const insertRoleUserSchema = createInsertSchema(rolesUsers);
export const insertRolePermissionSchema = createInsertSchema(rolesPermissions);

// Types
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof insertPermissionSchema._type;
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof insertRoleSchema._type;
export type RoleUser = typeof rolesUsers.$inferSelect;
export type InsertRoleUser = typeof insertRoleUserSchema._type;
export type RolePermission = typeof rolesPermissions.$inferSelect;
export type InsertRolePermission = typeof insertRolePermissionSchema._type;