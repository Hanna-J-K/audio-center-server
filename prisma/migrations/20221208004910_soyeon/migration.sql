/*
  Warnings:

  - You are about to drop the column `stationId` on the `SavedRadioStation` table. All the data in the column will be lost.
  - Added the required column `title` to the `SavedRadioStation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `SavedRadioStation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SavedRadioStation" DROP COLUMN "stationId",
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL;
