-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "Schedule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""Schedule_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"name" text NOT NULL,
	"userId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HubRequirement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""HubRequirement_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"name" text NOT NULL,
	CONSTRAINT "unique_hub_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Class" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""Class_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"school" text NOT NULL,
	"department" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"csMajorScore" integer DEFAULT 0,
	"embedding" jsonb
);
--> statement-breakpoint
CREATE TABLE "ScheduleToClassToSlot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""ScheduleToClassToSlot_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"scheduleId" integer NOT NULL,
	"classToSlotId" integer NOT NULL,
	CONSTRAINT "stcts_schedule_cts_unique" UNIQUE("scheduleId","classToSlotId")
);
--> statement-breakpoint
CREATE TABLE "ClassToHubRequirement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""ClassToHubRequirement_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"classId" integer NOT NULL,
	"hubRequirementId" integer NOT NULL,
	CONSTRAINT "cthr_class_hub_unique" UNIQUE("classId","hubRequirementId")
);
--> statement-breakpoint
CREATE TABLE "Bookmark" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""Bookmark_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"userId" integer NOT NULL,
	"classId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserCompletedClass" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""UserCompletedClass_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"userId" integer NOT NULL,
	"classId" integer NOT NULL,
	"grade" text,
	CONSTRAINT "ucc_user_class_unique" UNIQUE("userId","classId")
);
--> statement-breakpoint
CREATE TABLE "studyabroadlocations" (
	"locationid" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "studyabroadlocations_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""Users_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1),
	"google_id" text NOT NULL,
	"major" text,
	"minor" text,
	"target_graduation" date,
	"incoming_credits" integer,
	"interests" text,
	"study_abroad_interest" text,
	"preferred_course_load" text,
	"embedding" vector(1536),
	"embedding_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "locationclasses" (
	"locationid" integer NOT NULL,
	"classid" integer NOT NULL,
	CONSTRAINT "locationclasses_pkey" PRIMARY KEY("locationid","classid")
);
--> statement-breakpoint
ALTER TABLE "Schedule" ADD CONSTRAINT "userId_constraint" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ScheduleToClassToSlot" ADD CONSTRAINT "stcts_schedule_fk" FOREIGN KEY ("id") REFERENCES "public"."Schedule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ClassToHubRequirement" ADD CONSTRAINT "cthr_class_fk" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ClassToHubRequirement" ADD CONSTRAINT "cthr_hubRequirement_fk" FOREIGN KEY ("hubRequirementId") REFERENCES "public"."HubRequirement"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Bookmark" ADD CONSTRAINT "bookmark_user_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Bookmark" ADD CONSTRAINT "bookmark_class_fk" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserCompletedClass" ADD CONSTRAINT "ucc_user_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserCompletedClass" ADD CONSTRAINT "ucc_class_fk" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "locationclasses" ADD CONSTRAINT "fk_location" FOREIGN KEY ("locationid") REFERENCES "public"."studyabroadlocations"("locationid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locationclasses" ADD CONSTRAINT "fk_class" FOREIGN KEY ("classid") REFERENCES "public"."Class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_class_csMajorScore" ON "Class" USING btree ("csMajorScore" int4_ops);--> statement-breakpoint
CREATE INDEX "users_embedding_idx" ON "Users" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);
*/