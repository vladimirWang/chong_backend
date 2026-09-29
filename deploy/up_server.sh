#!/bin/bash

docker compose -p repo-prod --env-file ../.env.prod up -d server
