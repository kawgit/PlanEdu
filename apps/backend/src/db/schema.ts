import {
	pgTable, foreignKey, integer, text, unique, index, jsonb, date, vector, timestamp
} from "drizzle-orm/pg-core";

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
	unique("users_google_id_unique").on(table.googleId),
]);

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

export const classTable = pgTable("Class", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity({
			name: "\"Class_id_seq\"",
			startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647
		}),
	school: text("school").notNull(),
	department: text("department").notNull(),
	number: text("number").notNull(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	embedding: jsonb("embedding"),
}, (table) => [
	unique("class_school_dept_num_unique").on(table.school, table.department, table.number),
]);

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
	instructor: text("instructor"),
	location: text("location"),
	days: text("days").notNull(),
	startTime: text("startTime").notNull(),
	endTime: text("endTime").notNull(),
	notes: text("notes"),
}, (table) => [
	foreignKey({
		columns: [table.classId],
		foreignColumns: [classTable.id],
		name: "section_class_fk",
	}).onDelete("cascade").onUpdate("cascade"),
]);

export const scheduleToSection = pgTable("ScheduleToSection", {
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
