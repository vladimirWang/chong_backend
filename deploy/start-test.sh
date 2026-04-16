#!/usr/bin/env bash
# 与生产并行：项目名 step9-test；宿主机端口 8080/8443/3307/6380（生产占 80/443/3306/6379）
docker compose -p step13-test -f ./docker-compose.test.yml --env-file ../.env.test up -d --build
