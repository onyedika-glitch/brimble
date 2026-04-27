# Brimble Deployment Pipeline (BDP)

A one-page deployment pipeline that builds containerized apps using Railpack, runs them via Docker, and routes traffic through Caddy.

## Features
- **Git Deployment**: Submit a Git URL to trigger a deployment.
- **Railpack Builds**: Zero-config container builds.
- **Live Logs**: Real-time log streaming from build and deployment phases via SSE.
- **Infrastructure**: Automated container orchestration and Caddy ingress routing.
- **One-Pager UI**: Clean, responsive dashboard built with Vite + TanStack.

## Quick Start (Hard Requirement)

Run the entire stack with a single command:

```bash
docker compose up
```

Wait for images to build and containers to start. Once ready:
- **Dashboard**: [http://localhost:8080](http://localhost:8080)
- **API**: [http://localhost:8080/api](http://localhost:8080/api)
- **Deployments**: Access your deployed apps at `http://[name].localhost:8080` (requires host entry) or via the dashboard link.

### Prerequisites
- Docker & Docker Compose
- That's it!

## Architecture Decisions

### Pipeline Flow
1. **GitHub URL** is submitted to the Backend.
2. **Backend** clones the repository into a temporary workspace.
3. **Railpack** scans the workspace, generates a build plan, and builds a container image.
4. **Docker** runs the built image with a dynamically assigned port.
5. **Caddy** Admin API is updated to route `[deployment-name].localhost` to the container port.
6. **Logs** are captured from each step and persisted in SQLite, while simultaneously broadcasted to the Frontend via Server-Sent Events (SSE).

### Technology Stack
- **Frontend**: React (Vite) + TanStack Query + Tailwind CSS.
- **Backend**: Fastify + Prisma (SQLite).
- **Orchestration**: Docker Compose.
- **Ingress**: Caddy (Dynamic configuration).
- **Build**: Railpack (successor to Nixpacks).

## What I'd do with more time
- [ ] **Rollbacks**: Implementation would involve keeping track of successful image tags and providing a 'Restore' button.
- [ ] **Build Cache**: Share Railpack cache volumes between builds to speed up subsequent deployments.
- [ ] **Zero-Downtime**: Implement a blue-green strategy where the new container is healthy before Caddy switches the route and the old container is stopped.
- [ ] **Metrics**: Add CPU/Memory monitoring for running deployments in the UI.

## Brimble Feedback
Attached separately in the submission.