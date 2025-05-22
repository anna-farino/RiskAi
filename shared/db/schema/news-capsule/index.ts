import { pgTable, text, timestamp, uuid, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// News Capsule table
export const capsules = pgTable("news_capsules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  duration: integer("duration").notNull(), // in hours
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull(), // 'active', 'paused', 'completed'
  sourcesToMonitor: jsonb("sources_to_monitor").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// News capsule articles table
export const capsuleArticles = pgTable("news_capsule_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  capsuleId: uuid("capsule_id").notNull().references(() => capsules.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  source: text("source").notNull(),
  publishDate: timestamp("publish_date"),
  summary: text("summary"),
  content: text("content"),
  keywords: jsonb("keywords").$type<string[]>(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow()
});

// User preferences for news capsules
export const capsulePreferences = pgTable("news_capsule_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  autoGenerateCapsules: boolean("auto_generate_capsules").default(true),
  frequencyHours: integer("frequency_hours").default(24),
  receiveNotifications: boolean("receive_notifications").default(true),
  notifyOnKeywords: boolean("notify_on_keywords").default(true),
  includeAnalytics: boolean("include_analytics").default(true),
  maxArticlesPerCapsule: integer("max_articles_per_capsule").default(50),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Insert schemas using drizzle-zod
export const insertCapsuleSchema = createInsertSchema(capsules)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertCapsuleArticleSchema = createInsertSchema(capsuleArticles)
  .omit({ id: true, createdAt: true });

export const insertCapsulePreferencesSchema = createInsertSchema(capsulePreferences)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Type definitions
export type Capsule = typeof capsules.$inferSelect;
export type InsertCapsule = z.infer<typeof insertCapsuleSchema>;

export type CapsuleArticle = typeof capsuleArticles.$inferSelect;
export type InsertCapsuleArticle = z.infer<typeof insertCapsuleArticleSchema>;

export type CapsulePreference = typeof capsulePreferences.$inferSelect;
export type InsertCapsulePreference = z.infer<typeof insertCapsulePreferencesSchema>;