ALTER TABLE "actions" DROP CONSTRAINT IF EXISTS "actions_before_state_actions_after_state_fk";

ALTER TABLE "actions" 
ADD CONSTRAINT "actions_before_state_actions_after_state_fk" 
FOREIGN KEY ("before_state") 
REFERENCES "actions" ("after_state") 
ON DELETE RESTRICT 
DEFERRABLE INITIALLY IMMEDIATE;