import Papa from "papaparse";
import { MT5Trade, MT5Account } from "@/types/mt5";
import { format, parseISO } from "date-fns";

export function exportMT5TradesCSV(trades: MT5Trade[], account?: MT5Account | null): void {
  const formattedData = trades.map((t) => {
    let dateStr = "";
    let timeStr = "";

    try {
      const parsed = parseISO(t.openTime);
      dateStr = format(parsed, "yyyy-MM-dd");
      timeStr = format(parsed, "HH:mm:ss");
    } catch {
      dateStr = t.openTime;
      timeStr = "";
    }

    return {
      Date: dateStr,
      Time: timeStr,
      Ticket: t.ticket,
      "Order ID": t.orderId,
      Symbol: t.symbol,
      Side: t.side,
      Volume: t.volume,
      "Open Price": t.openPrice,
      "Close Price": t.closePrice ?? "-",
      "Stop Loss": t.stopLoss ?? "-",
      "Take Profit": t.takeProfit ?? "-",
      Commission: t.commission.toFixed(2),
      Swap: t.swap.toFixed(2),
      Profit: t.profit.toFixed(2),
      Balance: account ? account.balance.toFixed(2) : "-",
      Equity: account ? account.equity.toFixed(2) : "-",
      Status: t.status,
    };
  });

  const csvString = Papa.unparse(formattedData);
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const filename = `tradeforge-mt5-trades-${todayStr}.csv`;

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
