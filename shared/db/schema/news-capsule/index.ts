import { pgTable, text, serial, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  threatName: text("threat_name").notNull(),
  vulnerabilityId: text("vulnerability_id").default("Unspecified").notNull(),
  summary: text("summary").notNull(),
  impacts: text("impacts").notNull(),
  attackVector: text("attack_vector").default("Unknown attack vector").notNull(),
  microsoftConnection: text("microsoft_connection").notNull(),
  sourcePublication: text("source_publication").notNull(),
  originalUrl: text("original_url").notNull(),
  targetOS: text("target_os").default("Microsoft / Windows").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  markedForReporting: boolean("marked_for_reporting").default(true).notNull(),
  markedForDeletion: boolean("marked_for_deletion").default(false).notNull(),
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

