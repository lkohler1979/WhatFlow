-- Recreate the FK conversations.instance_id -> instances.id with ON DELETE CASCADE.
-- Fixes P-17: DELETE /v1/instances/:id returned 500 when the instance had
-- Conversations/Messages because the FK had no cascade.

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_instance_id_fkey";

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
