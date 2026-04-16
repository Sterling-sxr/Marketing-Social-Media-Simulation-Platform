[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=20525206&assignment_repo_type=AssignmentRepo)

# Capstone Project W16B Donut (Setup Guide)

## Introduction
This repository includes the complete Donut capstone project, covering both the Django backend and the Vite/React frontend. The whole application stack is managed with Docker Compose, so the full system can be launched with a single command.

## Project Structure
* `backend/` contains the Django application, with app modules located under `backend/apps/`
* `frontend/` contains the Vite/React single-page frontend
* `nginx/` contains the reverse proxy configuration used to serve the frontend and forward API/media requests
* `docs/` stores project documentation and related artefacts
  * `docs/requirements/` contains user stories and requirement documents
  * `docs/design/` stores design sprint outputs for each sprint
  * `docs/db/schema/` contains database DDL files, including `edu_social.sql` as a schema reference

## Requirements
Before starting, make sure the following are installed:

* Docker 24 or above
* Docker Compose plugin

## Initial Setup
For the first run, follow these steps:

1. Copy the example environment file by running `cp .env.example .env`, then update secrets or ports if necessary
2. Build the Docker images with `docker compose build`
3. Start the full stack using `docker compose up -d`
4. Check container status with `docker compose ps`, then visit `http://localhost:8080`

When the backend container starts, Django migrations are executed automatically. PostgreSQL, Redis, RabbitMQ, and MinIO are all created as part of the Compose stack.

## Common Commands
* Show all container logs:
  `docker compose logs -f`

* Rebuild backend and frontend after code changes:
  `docker compose up -d --build backend frontend`

* Restart the nginx gateway after rebuilding:
  `docker compose restart gateway`

* Shut down the stack:
  `docker compose down`
  Add `-v` as well if you want to remove volumes and stored data

* Start the frontend in Docker development mode with hot reload:
  `docker compose up -d postgres redis rabbitmq minio minio-init backend gateway frontend-dev --build --no-deps`

* Open the frontend dev server at:
  `http://localhost:5173`

## Frontend Hot Reload with Docker
For regular frontend development, use `frontend-dev`. It mounts your local frontend source code and runs Vite in development mode.

```bash
# 1) Start backend-related services together with the frontend dev container
docker compose up -d postgres redis rabbitmq minio minio-init backend gateway frontend-dev --build --no-deps

# 2) Stop the production frontend container if it is already running
docker compose stop frontend

# 3) Check frontend-dev logs
#    npm dependencies will be installed on the first run
docker compose logs -f frontend-dev
