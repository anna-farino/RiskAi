import { boolean, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./user";


export const otps = pgTable('otps', {
  id: uuid("id").defaultRandom().primaryKey(),
  otp: varchar("otp", { length: 100 }).notNull(),
  created_at: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  expires_at: timestamp("expires_at", { mode: 'string' }).notNull(),
  attempts: integer("attempts").default(0),
  used: boolean("used").default(false),
  user_id: integer("user_id").notNull().references(()=>users.id)
})
