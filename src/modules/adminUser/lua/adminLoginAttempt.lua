-- 管理员登录失败计数 + 账号锁定（原子占位）
-- KEYS[1] = adminLogin:failed:{email}
-- KEYS[2] = adminLogin:locked:{email}
-- ARGV[1] = 计数窗口/锁定时长（秒）
-- ARGV[2] = 触发锁定的尝试次数
-- 返回 {count, locked}：locked = 1 表示已锁定（调用方需在密码校验前拒绝），count = -1 表示之前就已锁定

local failed_key = KEYS[1]
local locked_key = KEYS[2]
local freeze_duration = ARGV[1]
local count_of_password_wrong = ARGV[2]

-- 已锁定：直接拒绝，不占用尝试次数
if redis.call("exists", locked_key) == 1 then
  return {-1, 1}
end

-- 先占位：每个请求在密码校验前消耗一次尝试名额
local n = redis.call("incr", failed_key)
if n == 1 or redis.call("ttl", failed_key) < 0 then
  redis.call("expire", failed_key, freeze_duration)
end

if n >= tonumber(count_of_password_wrong) then
  redis.call("set", locked_key, 1, "EX", freeze_duration)
  return {n, 1}
end

return {n, 0}
