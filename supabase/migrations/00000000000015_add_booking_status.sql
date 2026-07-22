-- Migration: Add 'booking' status to repairs table check constraint
ALTER TABLE repairs DROP CONSTRAINT IF EXISTS repairs_status_check;

ALTER TABLE repairs ADD CONSTRAINT repairs_status_check 
  CHECK (status IN ('booking', 'pending', 'repairing', 'ready', 'delivered', 'delivered_pending_balance', 'cancelled'));

-- Set default status to 'booking' for new repair entries
ALTER TABLE repairs ALTER COLUMN status SET DEFAULT 'booking';
