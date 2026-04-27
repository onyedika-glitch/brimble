# Brimble Pre-Hire Task Implementation Plan

## Overview
Building a one-page deployment pipeline for containerized apps.

## Architecture
- **Frontend**: Vite + TanStack (Router, Query) + Tailwind CSS.
- **Backend**: Node.js (TypeScript) + Fastify/Express + Prisma (SQLite).
- **Orchestration**: Docker Compose.
- **Ingress**: Caddy.
- **Build Tool**: Railpack.
- **Runtime**: Docker (API via socket).

## Components

### 1. Backend (/backend)
- **API Endpoints**:
    - `POST /deployments`: Create a new deployment (Git URL).
    - `GET /deployments`: List all deployments.
    - `GET /deployments/:id/logs`: SSE stream for live logs.
- **Database**: SQLite (via Prisma) to track deployment states (pending, building, deploying, running, failed).
- **Worker**: 
    - Clone git repository.
    - Execute `railpack` to build image.
    - Start container with unique port/label.
    - Update Caddy configuration.
- **Log Streaming**: Capture stdout/stderr from build and run processes, pipe to a message bus (or simple EventEmitter) for SSE.

### 2. Frontend (/frontend)
- **Framework**: Vite + TanStack Router + TanStack Query.
- **UI**:
    - Form for Git URL.
    - List of deployments with status indicator and live URL.
    - Overlay/Panel for live logs.
    - Image tag display.

### 3. Pipeline (/pipeline)
- **Caddy**: Use Caddy's dynamic configuration (Admin API) or a template-based approach to route traffic.
- **Docker Compose**:
    - Service: `backend` (mounts `/var/run/docker.sock`).
    - Service: `frontend`.
    - Service: `caddy`.

## Roadmap
1. [ ] Project Initialization.
2. [ ] Backend: Database schema and basic API.
3. [ ] Pipeline: Railpack build logic implementation.
4. [ ] Backend: Log streaming via SSE.
5. [ ] Frontend: Basic layout and deployment list.
6. [ ] Frontend: Deployment creation and live logs.
7. [ ] Infrastructure: Caddy configuration and Docker Compose.
8. [ ] Testing & README.
