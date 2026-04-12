import { Database as BunDatabase } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuditLogEntry } from "../../shared/types";

export class Database {
  public db: BunDatabase;

  constructor(filename = "database.sqlite") {
    this.db = new BunDatabase(filename, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.runMigrations();
  }

  private runMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = join(import.meta.dir, "migrations");
    const files = readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith(".sql")) continue;

      const isApplied = this.db.query("SELECT 1 FROM migrations WHERE name = ?").get(file);
      if (!isApplied) {
        const sql = readFileSync(join(migrationsDir, file), "utf8");
        this.db.transaction(() => {
          this.db.exec(sql);
          this.db.query("INSERT INTO migrations (name) VALUES (?)").run(file);
        })();
        console.log(`Applied migration: ${file}`);
      }
    }
  }

  public getLastAuditHash(branchId: string): string {
    const row = this.db
      .query<{ entry_hash: string }, [string]>(
        "SELECT entry_hash FROM audit_log WHERE branch_id = ? ORDER BY id DESC LIMIT 1",
      )
      .get(branchId);
    return row
      ? row.entry_hash
      : "0000000000000000000000000000000000000000000000000000000000000000";
  }

  public insertAuditLog(entry: {
    tick: number;
    branchId: string;
    agentId: string | null;
    system: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    causeEventId: string | null;
    causeDescription: string | null;
    suppressed: boolean;
    previousHash: string;
    entryHash: string;
  }): void {
    this.db
      .query(`
      INSERT INTO audit_log (
        tick, branch_id, agent_id, system, field, old_value, new_value,
        cause_event_id, cause_description, suppressed, previous_hash, entry_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        entry.tick,
        entry.branchId,
        entry.agentId,
        entry.system,
        entry.field,
        entry.oldValue,
        entry.newValue,
        entry.causeEventId,
        entry.causeDescription,
        entry.suppressed ? 1 : 0,
        entry.previousHash,
        entry.entryHash,
      );
  }

  public getAuditLogs(branchId: string, fromTick?: number, toTick?: number): AuditLogEntry[] {
    let sql = "SELECT * FROM audit_log WHERE branch_id = ?";
    const params: (string | number)[] = [branchId];
    if (fromTick !== undefined) {
      sql += " AND tick >= ?";
      params.push(fromTick);
    }
    if (toTick !== undefined) {
      sql += " AND tick <= ?";
      params.push(toTick);
    }
    sql += " ORDER BY id ASC";
    return this.db.query(sql).all(...params) as AuditLogEntry[];
  }

  public getAgentHistory(agentId: string, fromTick?: number, toTick?: number): AuditLogEntry[] {
    let sql = "SELECT * FROM audit_log WHERE agent_id = ?";
    const params: (string | number)[] = [agentId];
    if (fromTick !== undefined) {
      sql += " AND tick >= ?";
      params.push(fromTick);
    }
    if (toTick !== undefined) {
      sql += " AND tick <= ?";
      params.push(toTick);
    }
    sql += " ORDER BY tick ASC, id ASC";
    return this.db.query(sql).all(...params) as AuditLogEntry[];
  }

  public close() {
    this.db.close();
  }
}

export const db = new Database(); // Singleton instance
