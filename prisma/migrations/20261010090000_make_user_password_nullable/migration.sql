-- User.password / salt 改为可空
-- 目的：SSO 统一登录后，本地密码登录弱化；通过 SSO 创建的用户无本地密码（null），
-- 走本地登录接口时被拒绝。保留 registerUserByToken 激活流程仍可写入密码（备选登录方式）。
ALTER TABLE `User` MODIFY COLUMN `password` VARCHAR(191) NULL, MODIFY COLUMN `salt` VARCHAR(191) NULL;
