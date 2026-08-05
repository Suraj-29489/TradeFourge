import Papa from "papaparse";
import { Trade, AccountCurrency } from "@/types/trade";
import { format, parseISO } from "date-fns";

export function exportJournalCSV(trades: Trade[], currency: AccountCurrency = "USD"): void {
  const formattedData = trades.map((t) => ({
    "Ticket ID": t.positionId,
    "Open Time": format(parseISO(t.openTime), "yyyy-MM-dd HH:mm:ss"),
    "Close Time": format(parseISO(t.closeTime), "yyyy-MM-dd HH:mm:ss"),
    Symbol: t.symbol,
    Direction: t.direction,
    Lots: t.lot,
    "Open Price": t.entryPrice,
    "Close Price": t.exitPrice,
    [`Net PnL (${currency})`]: t.pnl,
    Commission: t.commission,
    Swap: t.swap,
    "RR Ratio": t.rr,
    Status: t.status,
    Account: t.account,
    Broker: t.broker,
    Notes: t.notes || "",
  }));

  const csvString = Papa.unparse(formattedData);
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Trading_Journal_${format(new Date(), "yyyyMMdd")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
