-- Add current_tick column to runs table for tracking active simulation state
ALTER TABLE runs ADD COLUMN current_tick INTEGER NOT NULL DEFAULT 0;