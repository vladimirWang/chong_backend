#!/usr/bin/env bash
# 与生产并行：项目名 step9-test；宿主机端口 8080/8443/3307/6380（生产占 80/443/3306/6379）
docker compose -p repo-test -f ../server/docker-compose.test.yml --env-file ./server/.env.test up -d --build
