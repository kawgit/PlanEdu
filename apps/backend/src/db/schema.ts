import { pgTable, foreignKey, integer, text, unique, index, jsonb, serial, date, vector, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Define users table first since it's referenced by other tables
export const users = pgTable("Users", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"Users_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	googleId: text("google_id").notNull(),
	major: text(),
	minor: text(),
	targetGraduation: date("target_graduation"),
	incomingCredits: integer("incoming_credits"),
	interests: text(),
	studyAbroadInterest: text("study_abroad_interest"),
	preferredCourseLoad: text("preferred_course_load"),
	embedding: vector({ dimensions: 1536 }),
	embeddingUpdatedAt: timestamp("embedding_updated_at", { mode: 'string' }),
}, (table) => [
	index("users_embedding_idx").using("ivfflat", table.embedding.asc().nullsLast().op("vector_cosine_ops")).with({ lists: "100" }),
]);

export const schedule = pgTable("Schedule", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"Schedule_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	name: text().notNull(),
	userId: integer().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "userId_constraint"
	}),
]);

export const hubRequirement = pgTable("HubRequirement", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"HubRequirement_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	name: text().notNull(),
}, (table) => [
	unique("unique_hub_name").on(table.name),
]);

export const classTable = pgTable("Class", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"Class_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	school: text().notNull(),
	department: text().notNull(),
	number: integer().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	embedding: jsonb(),
}, (table) => []);

export const section = pgTable("Section", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"Class_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	classId: integer().notNull(),
	name: text().notNull(),
	year: integer().notNull(),
	season: text().notNull(),
	instructor: text().notNull(),
	location: text().notNull(),
	days: text().notNull(),
	startTime: text().notNull(),
	endTime: text().notNull(),
	notes: text().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.id],
		foreignColumns: [classTable.id],
		name: "section_class_fk"
	}),
]);

export const scheduleToSection = pgTable("ScheduleToSection", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"ScheduleToClassToSlot_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	scheduleId: integer().notNull(),
	sectionId: integer().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.id],
		foreignColumns: [schedule.id],
		name: "stcts_schedule_fk"
	}),
	foreignKey({
		columns: [table.id],
		foreignColumns: [section.id],
		name: "stcts_section_fk"
	}),
	unique("stcts_schedule_cts_unique").on(table.scheduleId, table.classToSlotId),
]);

export const classToHubRequirement = pgTable("ClassToHubRequirement", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"ClassToHubRequirement_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	classId: integer().notNull(),
	hubRequirementId: integer().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "cthr_class_fk"
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.hubRequirementId],
		foreignColumns: [hubRequirement.id],
		name: "cthr_hubRequirement_fk"
	}).onUpdate("cascade").onDelete("cascade"),
	unique("cthr_class_hub_unique").on(table.classId, table.hubRequirementId),
]);

export const bookmark = pgTable("Bookmark", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"Bookmark_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	userId: integer().notNull(),
	classId: integer().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "bookmark_user_fk"
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "bookmark_class_fk"
	}).onUpdate("cascade").onDelete("cascade"),
]);

export const userCompletedClass = pgTable("UserCompletedClass", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "\"UserCompletedClass_id_seq\"", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647 }),
	userId: integer().notNull(),
	classId: integer().notNull(),
	grade: text(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "ucc_user_fk"
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "ucc_class_fk"
	}).onUpdate("cascade").onDelete("cascade"),
	unique("ucc_user_class_unique").on(table.userId, table.classId),
]);

