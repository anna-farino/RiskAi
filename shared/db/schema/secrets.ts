import { pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./user";
import { secretTypeEnum } from "./enums/secrets-1";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";


export const secrets = pgTable("secrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(()=>users.id),
  type: secretTypeEnum("type").notNull(),
  cipherText: text("ciphertext").notNull(),
  keyId: smallint("key_id").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow()
})


export const usersToSecrets = relations(users, ({ many }) => ({
  secrets: many(secrets)
}))

export const secretsToUser = relations(secrets, ({ one }) => ({
  user: one(users, {
    fields: [secrets.userId],
    references: [users.id]
  })
}))


export const insertSecretSchema = createInsertSchema(secrets).omit({ id: true, createdAt: true })
