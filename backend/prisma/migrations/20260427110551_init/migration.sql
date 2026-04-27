-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gitUrl" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "imageTag" TEXT,
    "liveUrl" TEXT,
    "logs" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "containerId" TEXT,
    "port" INTEGER
);
