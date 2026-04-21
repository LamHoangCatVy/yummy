CREATE TABLE `kb_insights` (
	`id` integer PRIMARY KEY NOT NULL,
	`files` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kb_meta` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`project_summary` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kb_tree` (
	`path` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repo_info` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`owner` text NOT NULL,
	`repo` text NOT NULL,
	`branch` text,
	`url` text NOT NULL,
	`github_token` text DEFAULT '' NOT NULL,
	`max_scan_limit` integer DEFAULT 10000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`time` text NOT NULL,
	`agent` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`in_tokens` integer NOT NULL,
	`out_tokens` integer NOT NULL,
	`latency` real NOT NULL,
	`cost` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_status` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`running` integer DEFAULT false NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`error` integer DEFAULT false NOT NULL,
	`initialized` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`logs` text DEFAULT '[]' NOT NULL,
	`chat_history` text DEFAULT '[]' NOT NULL,
	`agent_outputs` text DEFAULT '{}' NOT NULL,
	`jira_backlog` text DEFAULT '[]' NOT NULL,
	`metrics` text DEFAULT '{"tokens":0}' NOT NULL,
	`workflow_state` text DEFAULT 'idle' NOT NULL
);
