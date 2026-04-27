/*
  Warnings:

  - You are about to drop the column `logs` on the `Deployment` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deploymentId" TEXT NOT NULL,
    CONSTRAINT "Log_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gitUrl" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "imageTag" TEXT,
    "liveUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "containerId" TEXT,
    "port" INTEGER
);
INSERT INTO "new_Deployment" ("containerId", "createdAt", "gitUrl", "id", "imageTag", "liveUrl", "name", "port", "status", "updatedAt") SELECT "containerId", "createdAt", "gitUrl", "id", "imageTag", "liveUrl", "name", "port", "status", "updatedAt" FROM "Deployment";
DROP TABLE "Deployment";
ALTER TABLE "new_Deployment" RENAME TO "Deployment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
