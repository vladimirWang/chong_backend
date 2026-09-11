#!/bin/bash

# 测试数据导入脚本
# 使用 SQL 直接导入 User、Vendor、Product 表数据

# 数据库配置 (从 .env.development 读取)
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="123456"
DB_NAME="gallary_development"

echo "========================================"
echo "开始导入测试数据..."
echo "========================================"

# MySQL 命令
MYSQL_CMD="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}"

# ========================================
# 1. 导入 User 表数据
# ========================================
echo ""
echo ">>> 1. 导入 User 表数据"
echo "----------------------------------------"

$MYSQL_CMD -e "
INSERT INTO User (email, password, createdAt, updatedAt) VALUES
  ('123456@qq.com', '123456', NOW(), NOW()),
  ('654321@qq.com', '654321', NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();
"

if [ $? -eq 0 ]; then
  echo "✅ User 表数据导入成功"
else
  echo "❌ User 表数据导入失败"
fi

# ========================================
# 2. 导入 Vendor 表数据
# ========================================
echo ""
echo ">>> 2. 导入 Vendor 表数据"
echo "----------------------------------------"

$MYSQL_CMD -e "
INSERT INTO Vendor (name, createdAt, updatedAt) VALUES
  ('nike', NOW(), NOW()),
  ('puma', NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();
"

if [ $? -eq 0 ]; then
  echo "✅ Vendor 表数据导入成功"
else
  echo "❌ Vendor 表数据导入失败"
fi

# ========================================
# 3. 导入 Product 表数据
# ========================================
echo ""
echo ">>> 3. 导入 Product 表数据"
echo "----------------------------------------"

# 先获取 vendor id
NIKE_ID=$($MYSQL_CMD -N -e "SELECT id FROM Vendor WHERE name = 'nike' LIMIT 1;")
PUMA_ID=$($MYSQL_CMD -N -e "SELECT id FROM Vendor WHERE name = 'puma' LIMIT 1;")

echo "nike vendorId: $NIKE_ID"
echo "puma vendorId: $PUMA_ID"

$MYSQL_CMD -e "
INSERT INTO Product (name, vendorId, balance, createAt, updateAt) VALUES
  ('nike裤子', ${NIKE_ID}, 0, NOW(), NOW()),
  ('nike帽子', ${NIKE_ID}, 0, NOW(), NOW()),
  ('puma衣服', ${PUMA_ID}, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE updateAt = NOW();
"

if [ $? -eq 0 ]; then
  echo "✅ Product 表数据导入成功"
else
  echo "❌ Product 表数据导入失败"
fi

# ========================================
# 完成
# ========================================
echo ""
echo "========================================"
echo "✅ 测试数据导入完成!"
echo "========================================"
echo ""
echo "已导入数据汇总:"
echo "  - User:    2 条 (123456@qq.com, 654321@qq.com)"
echo "  - Vendor:  2 条 (nike, puma)"
echo "  - Product: 3 条 (nike裤子, nike帽子, puma衣服)"
echo ""

# 显示导入结果
echo ">>> 验证导入结果:"
echo "----------------------------------------"
echo "User 表:"
$MYSQL_CMD -e "SELECT id, email FROM User;"
echo ""
echo "Vendor 表:"
$MYSQL_CMD -e "SELECT id, name FROM Vendor;"
echo ""
echo "Product 表:"
$MYSQL_CMD -e "SELECT id, name, vendorId FROM Product;"
