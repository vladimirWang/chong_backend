-- DropIndex: User.username was nullable with no index, nothing to drop for it
-- DropColumns: User.password, User.salt, User.username
-- 身份信息（username/password/salt）统一由 SSO 管理，repo_cms User 表不再存储

ALTER TABLE `User` DROP COLUMN `username`;
ALTER TABLE `User` DROP COLUMN `password`;
ALTER TABLE `User` DROP COLUMN `salt`;
