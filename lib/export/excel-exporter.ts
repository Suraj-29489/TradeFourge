import * as XLSX from "xlsx";
import { Trade, TradeStats, AccountCurrency } from "@/types/trade";
import { format, parseISO } from "date-fns";

export function exportJournalExcel(
  trades: Trade[],
  stats: TradeStats,
  currency: AccountCurrency = "USD"
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary Statistics
  const summaryData = [
    ["TRADEFOURGE - PERFORMANCE REPORT"],
    ["Generated At", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
    ["Account Currency", currency],
    [""],
    ["METRIC", "VALUE"],
    ["Net Profit", `${currency} ${stats.totalNetProfit}`],
    ["Account Balance", `${currency} ${stats.balance}`],
    ["Win Rate", `${stats.winRate}%`],
    ["Profit Factor", stats.profitFactor],
    ["Expectancy", `${currency} ${stats.expectancy} per trade`],
    ["Total Trades", stats.totalTrades],
    ["Winning Trades", stats.winningTrades],
    ["Losing Trades", stats.losingTrades],
    ["Average Win", `${currency} ${stats.averageWin}`],
    ["Average Loss", `${currency} ${stats.averageLoss}`],
    ["Average R:R", `${stats.averageRR} R`],
    ["Best Streak", `${stats.bestStreak} Wins`],
    ["Worst Streak", `${stats.worstStreak} Losses`],
    ["Total Commission", `${currency} ${stats.totalCommission}`],
    ["Total Swap", `${currency} ${stats.totalSwap}`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Sheet 2: Position Log
  const tradeRows = trades.map((t) => ({
    "Position Ticket": t.positionId,
    "Open Time": format(parseISO(t.openTime), "yyyy-MM-dd HH:mm:ss"),
    "Close Time": format(parseISO(t.closeTime), "yyyy-MM-dd HH:mm:ss"),
    Symbol: t.symbol,
    Direction: t.direction,
    "Volume (Lots)": t.lot,
    "Entry Price": t.entryPrice,
    "Exit Price": t.exitPrice,
    [`Net PnL (${currency})`]: t.pnl,
    [`Commission (${currency})`]: t.commission,
    [`Swap (${currency})`]: t.swap,
    "Risk:Reward": t.rr,
    Status: t.status,
    Account: t.account,
    "Account Type": t.accountType || "Standard",
    Notes: t.notes || "",
  }));

  const wsTrades = XLSX.utils.json_to_sheet(tradeRows);
  XLSX.utils.book_append_sheet(wb, wsTrades, "Positions Log");

  XLSX.writeFile(wb, `TradeFourge_Export_${format(new Date(), "yyyyMMdd")}.xlsx`);
}
