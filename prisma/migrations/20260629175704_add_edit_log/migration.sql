-- CreateTable
CREATE TABLE "EditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instruction" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "articleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
