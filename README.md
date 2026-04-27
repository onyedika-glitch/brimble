# Brimble Clone - Full-Stack Deployment Engine

A high-performance, containerized deployment platform built for the Brimble Engineering take-home task. This system allows users to deploy Git repositories with zero configuration, featuring live build logs and dynamic ingress routing.

## 📺 Project Demo
**[Link to Screen Recording]**  
*(Paste your Loom/YouTube link here)*

---

## 🚀 Key Features
- **Zero-Config Build Pipeline**: Leveraging **Railpack** to automatically detect and build projects (Node.js, Laravel, Python, etc.).
- **Live Log Streaming**: Real-time build and deployment logs via EventSource/SSE.
- **Dynamic Ingress**: Automated **Caddy** configuration via Admin API for path-based and host-based routing.
- **Smart Root Detection**: Automatically identifies project sub-directories (e.g., finding `package.json` in a monorepo).
- **Architecture**: Orchestrated with **Docker Compose**, featuring a dedicated **BuildKit** service for isolated builds.
- **Premium UI**: Modern Dashboard built with **Vite + Tailwind CSS v4** and **TanStack Query**.

## 🛠️ Technical Decisions

### 1. Build Infrastructure (Railpack + BuildKit)
Instead of writing complex Dockerfiles for every language, I integrated **Railpack**. It analyzes the source code and generates a plan. Communication with a remote **BuildKit** daemon ensures that build environments are isolated and highly performant.

### 2. Ingress & Routing (Caddy)
I chose **Caddy** for its robust Admin API. When a container is launched, the backend dynamically pushes a new routing configuration to Caddy, mapping a local subdomain (e.g., `app-uuid.localhost`) to the new container's port instantly.

### 3. State Management & Reliability
- **Prisma + SQLite**: Lightweight but powerful database for tracking deployment states and persisting logs.
- **ESM Migration**: The entire backend is built with native ESM for modern Node.js compatibility.
- **Selective Volumes**: Configured Docker volumes to prevent host/container dependency conflicts (`better-sqlite3` native module stability).

---

## 🏗️ Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### Installation & Launch
1. Clone the repository:
   ```bash
   git clone https://github.com/onyedika-glitch/brimble.git
   cd brimble
   ```
2. Launch the infrastructure:
   ```bash
   sudo docker compose up --build
   ```
3. Access the dashboard:
   **http://localhost:8080**

Built with ⚡️ by **Onyedika**