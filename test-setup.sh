#!/bin/bash

# 完整测试流程脚本
# 1. 删除并重建数据库
# 2. 导入初始数据

# 数据库配置
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="123456"
DB_NAME="gallary_development"

MYSQL_CMD="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD}"

echo "========================================"
echo "开始完整测试流程..."
echo "========================================"

# ========================================
# Step 1: 删除并重建数据库
# ========================================
echo ""
echo ">>> Step 1: 删除并重建数据库"
echo "----------------------------------------"

echo "删除数据库: ${DB_NAME}"
$MYSQL_CMD -e "DROP DATABASE IF EXISTS ${DB_NAME};"

if [ $? -eq 0 ]; then
  echo "✅ 数据库删除成功"
else
  echo "❌ 数据库删除失败"
  exit 1
fi

echo "创建数据库: ${DB_NAME}"
$MYSQL_CMD -e "CREATE DATABASE ${DB_NAME};"

if [ $? -eq 0 ]; then
  echo "✅ 数据库创建成功"
else
  echo "❌ 数据库创建失败"
  exit 1
fi

# ========================================
# Step 2: 执行 Prisma db push 创建表结构
# ========================================
echo ""
echo ">>> Step 2: 执行 Prisma db push 创建表结构"
echo "----------------------------------------"

bun run db:push

if [ $? -eq 0 ]; then
  echo "✅ 表结构创建成功"
else
  echo "❌ 表结构创建失败"
  exit 1
fi

# ========================================
# Step 3: 导入初始数据
# ========================================
echo ""
echo ">>> Step 3: 导入初始数据"
echo "----------------------------------------"

# 导入 User 表
echo "导入 User 表..."
$MYSQL_CMD ${DB_NAME} -e "
INSERT INTO User (email, password, createdAt, updatedAt) VALUES
  ('123456@qq.com', '123456', NOW(), NOW()),
  ('654321@qq.com', '654321', NOW(), NOW());
"

if [ $? -eq 0 ]; then
  echo "✅ User 表导入成功"
else
  echo "❌ User 表导入失败"
  exit 1
fi

# 导入 Vendor 表
echo "导入 Vendor 表..."
$MYSQL_CMD ${DB_NAME} -e "
INSERT INTO Vendor (name, createdAt, updatedAt) VALUES
  ('nike', NOW(), NOW()),
  ('puma', NOW(), NOW());
"

if [ $? -eq 0 ]; then
  echo "✅ Vendor 表导入成功"
else
  echo "❌ Vendor 表导入失败"
  exit 1
fi

# 导入 Product 表
echo "导入 Product 表..."
NIKE_ID=$($MYSQL_CMD ${DB_NAME} -N -e "SELECT id FROM Vendor WHERE name = 'nike' LIMIT 1;")
PUMA_ID=$($MYSQL_CMD ${DB_NAME} -N -e "SELECT id FROM Vendor WHERE name = 'puma' LIMIT 1;")

$MYSQL_CMD ${DB_NAME} -e "
INSERT INTO Product (name, vendorId, balance, createAt, updateAt) VALUES
  ('nike裤子', ${NIKE_ID}, 0, NOW(), NOW()),
  ('nike帽子', ${NIKE_ID}, 0, NOW(), NOW()),
  ('puma衣服', ${PUMA_ID}, 0, NOW(), NOW());
"

if [ $? -eq 0 ]; then
  echo "✅ Product 表导入成功"
else
  echo "❌ Product 表导入失败"
  exit 1
fi

echo ""
echo ">>> 初始数据导入完成"
echo "  - User:    2 条"
echo "  - Vendor:  2 条"
echo "  - Product: 3 条"

# ========================================
# 完成
# ========================================
echo ""
echo "========================================"
echo "✅ 数据库初始化完成!"
echo "========================================"
