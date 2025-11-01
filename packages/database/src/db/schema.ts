import {
	pgTable, foreignKey, integer, text, unique, index, jsonb, date, vector, timestamp
} from "drizzle-orm/pg-core";

export const users = pgTable("Users", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity(),
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
		.generatedAlwaysAsIdentity(),
	name: text("name").notNull(),
	userId: integer("userId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "schedule_user_fk",
	}).onDelete("cascade").onUpdate("cascade"),
]);

export const courseTable = pgTable("Course", {
	school: text("school").notNull(),
	department: text("department").notNull(),
	number: text("number").notNull(),
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	embedding: jsonb("embedding"),
}, (table) => [
	unique("course_school_dept_num_unique").on(table.school, table.department, table.number),
]);

export const section = pgTable("Section", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity(),
	courseId: text("courseId").notNull(),
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
		columns: [table.courseId],
		foreignColumns: [courseTable.id],
		name: "section_course_fk",
	}).onDelete("cascade").onUpdate("cascade"),
]);

export const scheduleToSection = pgTable("ScheduleToSection", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity(),
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

export const bookmark = pgTable("Bookmark", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity(),
	userId: integer("userId").notNull(),
	courseId: text("courseId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "bookmark_user_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.courseId],
		foreignColumns: [courseTable.id],
		name: "bookmark_course_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	unique("bookmark_user_course_unique").on(table.userId, table.courseId),
]);

export const userCompletedCourse = pgTable("UserCompletedCourse", {
	id: integer("id")
		.primaryKey()
		.generatedAlwaysAsIdentity(),
	userId: integer("userId").notNull(),
	courseId: text("courseId").notNull(),
	grade: text("grade"),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "ucc_user_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.courseId],
		foreignColumns: [courseTable.id],
		name: "ucc_course_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	unique("ucc_user_course_unique").on(table.userId, table.courseId),
]);

export const prerequisite = pgTable("Prerequisite", {
	name: text("name").primaryKey().notNull(),
	type: text("type").notNull(),
	content: jsonb("payload").notNull(),
});

export const courseGroup = pgTable("CourseGroup", {
	name: text("name").primaryKey(),
});

export const courseGroupToCourse = pgTable("CourseGroupToCourse", {
	courseGroupId: text("courseGroupId").notNull(),
	courseId: text("courseId").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.courseGroupId],
		foreignColumns: [courseGroup.name],
		name: "cgtc_courseGroup_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.courseId],
		foreignColumns: [courseTable.id],
		name: "cgtc_course_fk",
	}).onUpdate("cascade").onDelete("cascade"),
	unique("cgtc_courseGroup_course_unique").on(table.courseGroupId, table.courseId),
]);
