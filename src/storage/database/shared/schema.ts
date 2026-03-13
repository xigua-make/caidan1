import { pgTable, serial, varchar, integer, timestamp, boolean, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 激活码表
export const activationCodes = pgTable(
  "activation_codes",
  {
    id: serial().notNull(),
    // 6位数数字激活码
    code: varchar("code", { length: 6 }).notNull().unique(),
    // 有效期类型：1d, 7d, permanent
    durationType: varchar("duration_type", { length: 20 }).notNull(),
    // 最大使用次数（-1表示无限）
    maxUses: integer("max_uses").default(1).notNull(),
    // 当前已使用次数
    usedCount: integer("used_count").default(0).notNull(),
    // 是否启用
    isActive: boolean("is_active").default(true).notNull(),
    // 创建时间
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    // 过期时间（null表示永久）
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("activation_codes_code_idx").on(table.code),
    index("activation_codes_is_active_idx").on(table.isActive),
  ]
);

// 激活记录表（记录每次激活）
export const activationRecords = pgTable(
  "activation_records",
  {
    id: serial().notNull(),
    // 激活码ID
    codeId: integer("code_id").notNull(),
    // 设备标识（用于防止同一设备重复激活）
    deviceId: varchar("device_id", { length: 64 }),
    // 激活时间
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    // 过期时间
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("activation_records_code_id_idx").on(table.codeId),
    index("activation_records_device_id_idx").on(table.deviceId),
  ]
);
