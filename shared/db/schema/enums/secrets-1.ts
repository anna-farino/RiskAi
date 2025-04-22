import { pgEnum } from "drizzle-orm/pg-core";
import { enumToPgEnum } from "./enum-to-pg-enum";

export enum Type {
  TEST = 'test',
}

export const secretTypeEnum = pgEnum('role', enumToPgEnum(Type))
