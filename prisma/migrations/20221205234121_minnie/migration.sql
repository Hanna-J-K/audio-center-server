/*
  Warnings:

  - You are about to drop the column `userId` on the `Broadcast` table. All the data in the column will be lost.
  - Added the required column `author` to the `Broadcast` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Broadcast` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Track` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Broadcast" DROP COLUMN "userId",
ADD COLUMN     "author" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "url" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SavedTrack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,

    CONSTRAINT "SavedTrack_pkey" PRIMARY KEY ("id")
);
