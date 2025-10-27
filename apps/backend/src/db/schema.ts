import {
	pgTable, foreignKey, integer, text, unique, index, jsonb, date, vector, timestamp
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------- Users ----------
export const users = pgTable("Users", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"Users_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	googleId: text("google_id").notNull(),
	major: text("major"),
	minor: text("minor"),
	targetGraduation: date("target_graduation"),
	incomingCredits: integer("incoming_credits"),
	interests: text("interests"),
	studyAbroadInterest: text("study_abroad_interest"),
	preferredCourseLoad: text("preferred_course_load"),
	embedding: vector("embedding", { dimensions: 1536 }),
	embeddingUpdatedAt: timestamp("embedding_updated_at", { mode: "string" }),
}, (table) => [
	// ivfflat over pgvector
	index("users_embedding_idx")
		.using("ivfflat", table.embedding.op("vector_cosine_ops"))
		.with({ lists: "100" }),
	unique("users_google_id_unique").on(table.googleId),
]);

// ---------- Schedule ----------
export const schedule = pgTable("Schedule", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"Schedule_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	name: text("name").notNull(),
	userId: integer("userId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "schedule_user_fk",
	}).onDelete("cascade").onUpdate("cascade"),
]);

// ---------- HubRequirement ----------
export const hubRequirement = pgTable("HubRequirement", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"HubRequirement_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	name: text("name").notNull(),
}, (table) => [
	unique("unique_hub_name").on(table.name),
]);

// ---------- Class ----------
export const classTable = pgTable("Class", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"Class_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	school: text("school").notNull(),
	department: text("department").notNull(),
	// If you want to allow non-numeric course "numbers", change to text("number").notNull()
	number: integer("number").notNull(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	// Consider vector(...) if you plan ANN over classes as well; keeping your jsonb choice:
	embedding: jsonb("embedding"),
}, (table) => [
	unique("class_school_dept_num_unique").on(table.school, table.department, table.number),
]);

// ---------- Section ----------
export const section = pgTable("Section", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"Section_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	classId: integer("classId").notNull(),
	name: text("name").notNull(),
	year: integer("year").notNull(),
	season: text("season").notNull(),
	instructor: text("instructor"), // made nullable for real-world gaps
	location: text("location"),
	days: text("days"),
	startTime: text("startTime"),
	endTime: text("endTime"),
	notes: text("notes"),
}, (table) => [
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "section_class_fk",
	}).onDelete("cascade").onUpdate("cascade"),
	// Prevent duplicate sections as you defined (same class + name + term)
	unique("section_unique_term").on(table.classId, table.name, table.year, table.season),
]);

// ---------- ScheduleToSection ----------
export const scheduleToSection = pgTable("ScheduleToSection", {
	// Optional: you can drop this surrogate id and use composite PK instead.
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"ScheduleToSection_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	scheduleId: integer("scheduleId").notNull(),
	sectionId: integer("sectionId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.scheduleId],
		foreignColumns: [schedule.id],
		name: "stsec_schedule_fk",
	}).onDelete("cascade").onUpdate("cascade"),
	foreignKey({
		columns: [table.sectionId],
		foreignColumns: [section.id],
		name: "stsec_section_fk",
	}).onDelete("cascade").onUpdate("cascade"),
	unique("stsec_schedule_section_unique").on(table.scheduleId, table.sectionId),
]);

// ---------- ClassToHubRequirement ----------
export const classToHubRequirement = pgTable("ClassToHubRequirement", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"ClassToHubRequirement_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	classId: integer("classId").notNull(),
	hubRequirementId: integer("hubRequirementId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "cthr_class_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.hubRequirementId],
		foreignColumns: [hubRequirement.id],
		name: "cthr_hubRequirement_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	unique("cthr_class_hub_unique").on(table.classId, table.hubRequirementId),
]);

// ---------- Bookmark ----------
export const bookmark = pgTable("Bookmark", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"Bookmark_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	userId: integer("userId").notNull(),
	classId: integer("classId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "bookmark_user_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "bookmark_class_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	unique("bookmark_user_class_unique").on(table.userId, table.classId),
]);

// ---------- UserCompletedClass ----------
export const userCompletedClass = pgTable("UserCompletedClass", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"UserCompletedClass_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	userId: integer("userId").notNull(),
	classId: integer("classId").notNull(),
	grade: text("grade"),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "ucc_user_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "ucc_class_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	unique("ucc_user_class_unique").on(table.userId, table.classId),
]);
