CREATE TABLE "Bookmark" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Bookmark_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"courseId" text NOT NULL,
	CONSTRAINT "bookmark_user_course_unique" UNIQUE("userId","courseId")
);
--> statement-breakpoint
CREATE TABLE "CourseGroup" (
	"name" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CourseGroupToCourse" (
	"courseGroupId" text NOT NULL,
	"courseId" text NOT NULL,
	CONSTRAINT "CourseGroupToCourse_courseGroupId_courseId_pk" PRIMARY KEY("courseGroupId","courseId"),
	CONSTRAINT "cgtc_courseGroup_course_unique" UNIQUE("courseGroupId","courseId")
);
--> statement-breakpoint
CREATE TABLE "Course" (
	"school" text NOT NULL,
	"department" text NOT NULL,
	"number" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"embedding" jsonb,
	CONSTRAINT "course_school_dept_num_unique" UNIQUE("school","department","number")
);
--> statement-breakpoint
CREATE TABLE "Prerequisite" (
	"name" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Schedule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Schedule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"userId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ScheduleToSection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ScheduleToSection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"scheduleId" integer NOT NULL,
	"sectionId" integer NOT NULL,
	CONSTRAINT "stsec_schedule_section_unique" UNIQUE("scheduleId","sectionId")
);
--> statement-breakpoint
CREATE TABLE "Section" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Section_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"courseId" text NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"season" text NOT NULL,
	"instructor" text,
	"location" text,
	"days" text NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "UserCompletedCourse" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "UserCompletedCourse_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"courseId" text NOT NULL,
	"grade" text,
	CONSTRAINT "ucc_user_course_unique" UNIQUE("userId","courseId")
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"google_id" text NOT NULL,
	"major" text,
	"minor" text,
	"target_graduation" date,
	"incoming_credits" integer,
	"interests" text,
	"study_abroad_interest" text,
	"preferred_course_load" text,
	"embedding" vector(1536),
	"embedding_updated_at" timestamp,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "Bookmark" ADD CONSTRAINT "bookmark_user_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Bookmark" ADD CONSTRAINT "bookmark_course_fk" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CourseGroupToCourse" ADD CONSTRAINT "cgtc_courseGroup_fk" FOREIGN KEY ("courseGroupId") REFERENCES "public"."CourseGroup"("name") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CourseGroupToCourse" ADD CONSTRAINT "cgtc_course_fk" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Schedule" ADD CONSTRAINT "schedule_user_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ScheduleToSection" ADD CONSTRAINT "stsec_schedule_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ScheduleToSection" ADD CONSTRAINT "stsec_section_fk" FOREIGN KEY ("sectionId") REFERENCES "public"."Section"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Section" ADD CONSTRAINT "section_course_fk" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserCompletedCourse" ADD CONSTRAINT "ucc_user_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserCompletedCourse" ADD CONSTRAINT "ucc_course_fk" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;