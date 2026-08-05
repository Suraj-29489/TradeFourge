// ============================================================
// TradeFourge — Database Forensic Investigation
// Runs with: node --env-file=.env.local scripts/db-forensics.mjs
//
// WHAT THIS DOES:
// 1. Signs into Supabase using credentials from stdin
// 2. Counts trades & imports for the authenticated user
// 3. Tests DELETE with RETURNING id (proves rows actually deleted)
// 4. Re-counts immediately after delete to verify 0 remaining
// 5. Logs every step: before → deleted → after
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as readline from "readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.");
  console.error("   Run: node --env-file=.env.local scripts/db-forensics.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// ─── Utilities ────────────────────────────────────────────────────────────────

const sep  = () => console.log("─".repeat(62));
const sep2 = () => console.log("═".repeat(62));
const log  = (msg, color = "") => console.log(`${color}${msg}\x1b[0m`);
const ok   = (msg) => log(`  ✓ ${msg}`, "\x1b[32m");
const warn = (msg) => log(`  ⚠ ${msg}`, "\x1b[33m");
const err  = (msg) => log(`  ✗ ${msg}`, "\x1b[31m");
const info = (msg) => log(`  → ${msg}`, "\x1b[36m");

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

// ─── Forensic: Count rows ─────────────────────────────────────────────────────

async function countTable(table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    err(`Count ${table} failed: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

// ─── Forensic: Count with detailed breakdown ──────────────────────────────────

async function auditTrades(userId) {
  const { data, error } = await supabase
    .from("trades")
    .select("id, ticket, symbol, import_id, account_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    err(`Audit trades failed: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    info("No trades found in audit query.");
    return;
  }

  info(`Latest ${data.length} trade(s):`);
  data.forEach((t, i) => {
    console.log(`    [${i+1}] id=${t.id.slice(0,8)}… ticket=${t.ticket} symbol=${t.symbol} import_id=${t.import_id ?? "NULL"} account_id=${t.account_id ?? "NULL"}`);
  });
}

async function auditImports(userId) {
  const { data, error } = await supabase
    .from("csv_imports")
    .select("id, filename, imported_rows, import_status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    err(`Audit imports failed: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    info("No imports found in audit query.");
    return;
  }

  info(`Latest ${data.length} import(s):`);
  data.forEach((imp, i) => {
    console.log(`    [${i+1}] id=${imp.id.slice(0,8)}… file="${imp.filename}" rows=${imp.imported_rows} status=${imp.import_status}`);
  });
}

// ─── Forensic: Delete ONE trade and verify ────────────────────────────────────

async function forensicDeleteOneTrade(userId) {
  sep();
  log("\n[TEST 3A] SINGLE TRADE DELETE — RETURNING id verification\n", "\x1b[35m");

  // Pick the oldest trade to delete as the test subject
  const { data: target, error: fetchErr } = await supabase
    .from("trades")
    .select("id, ticket, symbol")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (fetchErr || !target) {
    warn("No trade found to run single-delete test. Skipping.");
    return;
  }

  info(`Target trade: id=${target.id} ticket=${target.ticket} symbol=${target.symbol}`);

  // Count BEFORE
  const before = await countTable("trades", userId);
  log(`  Rows BEFORE delete: ${before}`, "\x1b[33m");

  // DELETE with RETURNING id
  const { data: deletedRows, error: delErr } = await supabase
    .from("trades")
    .delete()
    .eq("id", target.id)
    .eq("user_id", userId)
    .select("id");

  if (delErr) {
    err(`DELETE failed: ${delErr.message}`);
    err(`Code: ${delErr.code} | Details: ${delErr.details}`);
    return;
  }

  const deletedCount = deletedRows?.length ?? 0;
  log(`  Rows DELETED (RETURNING id count): ${deletedCount}`, deletedCount > 0 ? "\x1b[32m" : "\x1b[31m");

  if (deletedCount === 0) {
    err("DELETE returned 0 rows. RLS may be blocking deletion.");
    err("Possible causes: wrong user_id, RLS policy mismatch, row never existed.");
    return;
  }

  // Verify with immediate SELECT
  const { data: checkRow } = await supabase
    .from("trades")
    .select("id")
    .eq("id", target.id)
    .maybeSingle();

  if (checkRow) {
    err(`VERIFICATION FAILED — Trade ${target.id} still exists in DB after DELETE!`);
    err("This is a confirmed phantom row. Check RLS policies and triggers.");
  } else {
    ok(`Verification passed — trade ${target.id} no longer exists in DB.`);
  }

  // Count AFTER
  const after = await countTable("trades", userId);
  log(`  Rows AFTER delete: ${after}`, "\x1b[33m");

  const diff = before - after;
  if (diff === 1) {
    ok(`Count dropped by exactly 1. DELETE fully confirmed: ${before} → ${after}`);
  } else {
    err(`Expected count to drop by 1. Actual change: ${before} → ${after} (diff=${diff})`);
  }
}

// ─── Forensic: Delete ALL trades and verify ───────────────────────────────────

async function forensicDeleteAllTrades(userId) {
  sep();
  log("\n[TEST 3B] DELETE ALL TRADES — Full purge verification\n", "\x1b[35m");

  const before = await countTable("trades", userId);
  log(`  Rows BEFORE deleteAll: ${before}`, "\x1b[33m");

  if (before === 0) {
    warn("No trades to delete. Skipping deleteAll test.");
    return;
  }

  const { data: deletedRows, error: delErr } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (delErr) {
    err(`DELETE ALL failed: ${delErr.message}`);
    err(`Code: ${delErr.code} | Details: ${delErr.details}`);
    return;
  }

  const deletedCount = deletedRows?.length ?? 0;
  log(`  Rows DELETED (RETURNING id count): ${deletedCount}`, deletedCount > 0 ? "\x1b[32m" : "\x1b[31m");

  const after = await countTable("trades", userId);
  log(`  Rows AFTER deleteAll: ${after}`, "\x1b[33m");

  if (after === 0) {
    ok(`ALL trades deleted. DB confirmed empty: ${before} → 0`);
  } else {
    err(`DELETE ALL FAILED. ${after} rows remain after deleteAll.`);
    err("Investigating remaining rows...");

    const { data: remaining } = await supabase
      .from("trades")
      .select("id, user_id, import_id, ticket")
      .eq("user_id", userId)
      .limit(5);

    if (remaining && remaining.length > 0) {
      err("Remaining rows sample:");
      remaining.forEach(r => {
        console.log(`    id=${r.id} user_id=${r.user_id} import_id=${r.import_id} ticket=${r.ticket}`);
      });
    }

    // Also check if there are rows with NULL user_id
    const { count: nullUserCount } = await supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .is("user_id", null);
    
    info(`Trades with NULL user_id: ${nullUserCount ?? "unknown"}`);

    // Check if rows belong to a DIFFERENT user_id
    const { data: allRows } = await supabase
      .from("trades")
      .select("user_id")
      .neq("user_id", userId)
      .limit(3);

    if (allRows && allRows.length > 0) {
      warn(`Found trades belonging to different user_id(s): ${[...new Set(allRows.map(r => r.user_id))].join(", ")}`);
    }
  }
}

// ─── Forensic: Delete ALL imports and verify ─────────────────────────────────

async function forensicDeleteAllImports(userId) {
  sep();
  log("\n[TEST 3C] DELETE ALL IMPORTS — Cascade verification\n", "\x1b[35m");

  const beforeImports = await countTable("csv_imports", userId);
  const beforeTrades  = await countTable("trades", userId);
  log(`  Imports BEFORE: ${beforeImports}`, "\x1b[33m");
  log(`  Trades BEFORE:  ${beforeTrades}`, "\x1b[33m");

  if (beforeImports === 0) {
    warn("No imports to delete. Skipping.");
    return;
  }

  // Delete all trades belonging to imports first
  const { data: deletedTrades, error: tradeDelErr } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .not("import_id", "is", null)
    .select("id");

  if (tradeDelErr) {
    err(`DELETE import trades failed: ${tradeDelErr.message}`);
  } else {
    info(`Deleted ${deletedTrades?.length ?? 0} import-linked trades.`);
  }

  // Delete all import records
  const { data: deletedImports, error: impDelErr } = await supabase
    .from("csv_imports")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (impDelErr) {
    err(`DELETE imports failed: ${impDelErr.message}`);
  } else {
    info(`Deleted ${deletedImports?.length ?? 0} import records.`);
  }

  const afterImports = await countTable("csv_imports", userId);
  const afterTrades  = await countTable("trades", userId);
  log(`  Imports AFTER: ${afterImports}`, afterImports === 0 ? "\x1b[32m" : "\x1b[31m");
  log(`  Trades AFTER:  ${afterTrades}`, afterTrades === 0 ? "\x1b[32m" : "\x1b[31m");

  if (afterImports === 0) ok("All imports deleted and verified.");
  else err(`${afterImports} imports remain.`);

  if (afterTrades === 0) ok("All import-linked trades deleted and verified.");
  else warn(`${afterTrades} trades remain (may be manually added, not from imports).`);
}

// ─── Forensic: Check NULL import_id trades ───────────────────────────────────

async function checkNullImportIdTrades(userId) {
  sep();
  log("\n[TEST 4] ORPHAN TRADES — Trades with NULL import_id\n", "\x1b[35m");

  const { count, error } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("import_id", null);

  if (error) {
    err(`NULL import_id check failed: ${error.message}`);
    return;
  }

  info(`Trades with import_id = NULL: ${count ?? 0}`);

  if ((count ?? 0) > 0) {
    warn("These trades were NOT created by CSV import (manual entry or legacy data).");
    warn("Deleting imports will NOT delete these trades.");
    warn("Use deleteAllTrades() to remove them.");

    const { data: samples } = await supabase
      .from("trades")
      .select("id, ticket, symbol, source, created_at")
      .eq("user_id", userId)
      .is("import_id", null)
      .limit(5);

    if (samples) {
      info("Sample orphan trades:");
      samples.forEach(t => {
        console.log(`    id=${t.id.slice(0,8)}… ticket=${t.ticket} symbol=${t.symbol} source=${t.source} created=${t.created_at?.slice(0,10)}`);
      });
    }
  } else {
    ok("No orphan trades. All trades have import_id set.");
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  sep2();
  log("  TradeFourge — Database Forensic Investigation", "\x1b[1m\x1b[36m");
  log(`  Target: ${SUPABASE_URL}`, "\x1b[36m");
  log(`  Time:   ${new Date().toISOString()}`, "\x1b[36m");
  sep2();

  // Step 0: Sign in
  console.log("\nThis script requires your TradeFourge account credentials to authenticate.\n");
  const email    = await prompt("  Email:    ");
  const password = await prompt("  Password: ");
  console.log("");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData?.user) {
    err(`Authentication failed: ${authError?.message ?? "Unknown error"}`);
    process.exit(1);
  }

  const userId = authData.user.id;
  ok(`Authenticated as: ${authData.user.email}`);
  info(`User ID: ${userId}`);
  info(`Session token: ${authData.session?.access_token?.slice(0, 30)}…`);
  console.log("");

  // ── Phase 1: Initial Counts ───────────────────────────────────────────────
  sep();
  log("\n[TEST 1 & 2] INITIAL ROW COUNTS\n", "\x1b[35m");

  const tradeCount  = await countTable("trades", userId);
  const importCount = await countTable("csv_imports", userId);

  log(`  SELECT COUNT(*) FROM public.trades WHERE user_id = '${userId}'`);
  log(`  → Result: ${tradeCount}`, tradeCount > 0 ? "\x1b[33m" : "\x1b[32m");
  console.log("");
  log(`  SELECT COUNT(*) FROM public.csv_imports WHERE user_id = '${userId}'`);
  log(`  → Result: ${importCount}`, importCount > 0 ? "\x1b[33m" : "\x1b[32m");
  console.log("");

  if (tradeCount === 0 && importCount === 0) {
    ok("Database is already clean. No trades or imports found.");
    sep2();
    process.exit(0);
  }

  // ── Phase 2: Detailed Audit ───────────────────────────────────────────────
  sep();
  log("\n[AUDIT] TRADE & IMPORT DETAILS\n", "\x1b[35m");
  await auditTrades(userId);
  console.log("");
  await auditImports(userId);

  // ── Phase 3: NULL import_id check ────────────────────────────────────────
  await checkNullImportIdTrades(userId);

  // ── Phase 4: DELETE TESTS ────────────────────────────────────────────────
  console.log("");
  const runDelete = await prompt("\nRun DELETE tests? This will PERMANENTLY remove data. (yes/no): ");
  if (runDelete.trim().toLowerCase() !== "yes") {
    warn("DELETE tests skipped by user.");
    sep2();
    log("  Forensic Investigation Complete — READ-ONLY mode", "\x1b[36m");
    sep2();
    process.exit(0);
  }

  const deleteMode = await prompt("Delete mode: (single=delete 1 trade) (all=delete everything) (imports=delete imports+trades): ");

  if (deleteMode.trim() === "single") {
    await forensicDeleteOneTrade(userId);
  } else if (deleteMode.trim() === "all") {
    await forensicDeleteAllTrades(userId);
  } else if (deleteMode.trim() === "imports") {
    await forensicDeleteAllImports(userId);
  } else {
    warn("Unknown mode. Skipping.");
  }

  // ── Final Count ───────────────────────────────────────────────────────────
  sep();
  log("\n[FINAL] POST-DELETE COUNT VERIFICATION\n", "\x1b[35m");

  const finalTrades  = await countTable("trades", userId);
  const finalImports = await countTable("csv_imports", userId);

  log(`  Trades  remaining: ${finalTrades}`,  finalTrades === 0  ? "\x1b[32m" : "\x1b[31m");
  log(`  Imports remaining: ${finalImports}`, finalImports === 0 ? "\x1b[32m" : "\x1b[31m");

  if (finalTrades === 0 && finalImports === 0) {
    ok("DATABASE IS CLEAN. Both tables verified empty for this user.");
  } else {
    err(`DATABASE IS NOT CLEAN.`);
    if (finalTrades > 0)  err(`  ${finalTrades} trade row(s) remain.`);
    if (finalImports > 0) err(`  ${finalImports} import row(s) remain.`);
    err("Investigate RLS policies, user_id mismatches, and NULL import_id orphan rows.");
  }

  sep2();
  log("  Forensic Investigation Complete", "\x1b[36m");
  log(`  Time: ${new Date().toISOString()}`, "\x1b[36m");
  sep2();
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
