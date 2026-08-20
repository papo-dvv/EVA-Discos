/*
  Warnings:

  - You are about to drop the `migration_history_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "migration_history_events" DROP CONSTRAINT "migration_history_events_usuario_id_fkey";

-- DropTable
DROP TABLE "migration_history_events";
