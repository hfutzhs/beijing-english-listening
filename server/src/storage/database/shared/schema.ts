import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, real, jsonb, index, serial } from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

/**
 * 统一试题表 - 存储所有题型的题目
 * type: 'listen_choose' | 'listen_answer' | 'listen_retell' | 'read_aloud'
 * paper_id: 试卷编号(1-5)，0表示独立练习题
 */
export const questions = pgTable(
	"questions",
	{
		id: serial().primaryKey(),
		type: varchar("type", { length: 30 }).notNull(),
		paperId: integer("paper_id").notNull().default(0),
		sectionIndex: integer("section_index").notNull().default(1),
		difficultyGroup: integer("difficulty_group"),
		difficultyCoefficient: real("difficulty_coefficient"),
		title: varchar("title", { length: 300 }),
		content: jsonb("content").notNull(),
		audioScript: text("audio_script"),
		standardAudioKey: varchar("standard_audio_key", { length: 500 }),
		maxScore: integer("max_score").notNull().default(9),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("questions_type_idx").on(table.type),
		index("questions_paper_id_idx").on(table.paperId),
		index("questions_type_paper_idx").on(table.type, table.paperId),
	]
);

/**
 * 练习/考试记录表 - 统一存储所有题型的作答记录
 */
export const practiceRecords = pgTable(
	"practice_records",
	{
		id: serial().primaryKey(),
		deviceId: varchar("device_id", { length: 100 }).notNull(),
		questionType: varchar("question_type", { length: 30 }).notNull(),
		questionId: integer("question_id"),
		paperId: integer("paper_id"),
		sessionId: varchar("session_id", { length: 100 }),
		// 选择题
		userAnswer: text("user_answer"),
		isCorrect: boolean("is_correct"),
		// 语音题
		audioKey: varchar("audio_key", { length: 500 }),
		transcription: text("transcription"),
		// 评分
		score: integer("score").notNull().default(0),
		maxScore: integer("max_score").notNull().default(9),
		scoreLevel: varchar("score_level", { length: 50 }),
		accuracyAnalysis: text("accuracy_analysis"),
		fluencyAnalysis: text("fluency_analysis"),
		completenessAnalysis: text("completeness_analysis"),
		specificIssues: text("specific_issues"),
		suggestions: text("suggestions"),
		// 错题/不及格标记
		isFailed: boolean("is_failed").default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("practice_records_device_id_idx").on(table.deviceId),
		index("practice_records_type_idx").on(table.questionType),
		index("practice_records_session_id_idx").on(table.sessionId),
		index("practice_records_created_at_idx").on(table.createdAt),
	]
);
