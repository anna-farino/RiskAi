import { pgTable, text, serial, integer, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Articles table to store analyzed articles
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  date: text("date").notNull(),
  content: text("content").notNull(),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});

// Severity types for threat classification
export const SeverityEnum = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeverityEnum>;

// Threat types for classification
export const ThreatTypeEnum = z.enum(["vulnerability", "malware", "ransomware", "zero-day", "exploit", "other"]);
export type ThreatType = z.infer<typeof ThreatTypeEnum>;

// Product schema for storing affected Microsoft products
export const ProductSchema = z.object({
  name: z.string(),
  versions: z.string().optional(),
  icon: z.string().optional(),
});
export type Product = z.infer<typeof ProductSchema>;

// Threat schema for storing identified threats
export const ThreatSchema = z.object({
  type: ThreatTypeEnum,
  name: z.string(),
  details: z.string(),
  cve: z.string().optional(),
});
export type Threat = z.infer<typeof ThreatSchema>;

// Analysis results table to store the generated analysis
export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull(),
  summary: text("summary").notNull(),
  severity: text("severity").notNull(),
  technicalDetails: text("technical_details").notNull(),
  recommendations: text("recommendations").notNull(),
  affectedProducts: json("affected_products").notNull().$type<Product[]>(),
  threats: json("threats").notNull().$type<Threat[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertArticleSchema = createInsertSchema(articles).omit({ 
  id: true, 
  analyzedAt: true 
});
export type InsertArticle = z.infer<typeof insertArticleSchema>;

export const insertAnalysisSchema = createInsertSchema(analyses).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;

// Select types
export type Article = typeof articles.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;

// URL validation schema
export const urlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

// Manual publication schema for direct entry of cybersecurity articles
export const manualPublicationSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  content: z.string().min(50, "Content must be at least 50 characters"),
  source: z.string().default("Manual Entry"),
  date: z.string().default(() => new Date().toLocaleDateString('en-US')),
});

// Combined article with analysis for frontend
export const articleWithAnalysisSchema = z.object({
  article: z.object({
    id: z.number(),
    url: z.string(),
    title: z.string(),
    source: z.string(),
    date: z.string(),
    content: z.string(),
    analyzedAt: z.date(),
  }),
  analysis: z.object({
    id: z.number(),
    articleId: z.number(),
    summary: z.string(),
    severity: z.string(),
    technicalDetails: z.string(),
    recommendations: z.string(),
    affectedProducts: z.array(ProductSchema),
    threats: z.array(ThreatSchema),
    createdAt: z.date(),
  }),
});

export type ArticleWithAnalysis = z.infer<typeof articleWithAnalysisSchema>;
