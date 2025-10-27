import { relations } from "drizzle-orm/relations";
import { users, schedule, scheduleToClassToSlot, classTable, classToHubRequirement, hubRequirement, bookmark, userCompletedClass, studyabroadlocations, locationclasses } from "./schema";

export const scheduleRelations = relations(schedule, ({one, many}) => ({
	user: one(users, {
		fields: [schedule.userId],
		references: [users.id]
	}),
	scheduleToClassToSlots: many(scheduleToClassToSlot),
}));

export const usersRelations = relations(users, ({many}) => ({
	schedules: many(schedule),
	bookmarks: many(bookmark),
	userCompletedClasses: many(userCompletedClass),
}));

export const scheduleToClassToSlotRelations = relations(scheduleToClassToSlot, ({one}) => ({
	schedule: one(schedule, {
		fields: [scheduleToClassToSlot.id],
		references: [schedule.id]
	}),
}));

export const classToHubRequirementRelations = relations(classToHubRequirement, ({one}) => ({
	class: one(classTable, {
		fields: [classToHubRequirement.classId],
		references: [classTable.id]
	}),
	hubRequirement: one(hubRequirement, {
		fields: [classToHubRequirement.hubRequirementId],
		references: [hubRequirement.id]
	}),
}));

export const classRelations = relations(classTable, ({many}) => ({
	classToHubRequirements: many(classToHubRequirement),
	bookmarks: many(bookmark),
	userCompletedClasses: many(userCompletedClass),
	locationclasses: many(locationclasses),
}));

export const hubRequirementRelations = relations(hubRequirement, ({many}) => ({
	classToHubRequirements: many(classToHubRequirement),
}));

export const bookmarkRelations = relations(bookmark, ({one}) => ({
	user: one(users, {
		fields: [bookmark.userId],
		references: [users.id]
	}),
	class: one(classTable, {
		fields: [bookmark.classId],
		references: [classTable.id]
	}),
}));

export const userCompletedClassRelations = relations(userCompletedClass, ({one}) => ({
	user: one(users, {
		fields: [userCompletedClass.userId],
		references: [users.id]
	}),
	class: one(classTable, {
		fields: [userCompletedClass.classId],
		references: [classTable.id]
	}),
}));

export const locationclassesRelations = relations(locationclasses, ({one}) => ({
	studyabroadlocation: one(studyabroadlocations, {
		fields: [locationclasses.locationid],
		references: [studyabroadlocations.locationid]
	}),
	class: one(classTable, {
		fields: [locationclasses.classid],
		references: [classTable.id]
	}),
}));

export const studyabroadlocationsRelations = relations(studyabroadlocations, ({many}) => ({
	locationclasses: many(locationclasses),
}));