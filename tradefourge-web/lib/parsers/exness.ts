import Papa from "papaparse";
import {
  BrokerParser,
  ParseResult,
  Trade,
  Direction,
  TradeStatus,
  AccountCurrency,
  AccountType,
} from "@/types/trade";

export const ExnessParser: BrokerParser = {
  id: "exness",
  name: "Exness MT4 / MT5 CSV",
  description: "Supports Exness position history exports with automatic currency & account type detection",

  parse: (csvText: string, accountName = "Exness Trading Account"): ParseResult => {
    const errors: string[] = [];
    const trades: Trade[] = [];

    let detectedCurrency: AccountCurrency = "USD";
    let detectedAccountType: AccountType = "Pro";

    try {
      const fullTextUpper = csvText.toUpperCase();
      if (fullTextUpper.includes("CENT")) {
        detectedAccountType = "Standard Cent";
      } else if (fullTextUpper.includes("RAW") || fullTextUpper.includes("ZERO")) {
        detectedAccountType = "Raw";
      } else if (fullTextUpper.includes("STANDARD")) {
        detectedAccountType = "Standard";
      }

      if (fullTextUpper.includes("DEMO") || fullTextUpper.includes("PRACTICE")) {
        detectedAccountType = "Demo";
      } else if (fullTextUpper.includes("RAW") || fullTextUpper.includes("ZERO")) {
        detectedAccountType = "Raw";
      } else if (fullTextUpper.includes("PRO")) {
        detectedAccountType = "Pro";
      }

      // 2. Parse CSV rows with PapaParse
      const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
      });

      if (parsed.errors && parsed.errors.length > 0) {
        parsed.errors.forEach((err) => {
          if (err.row !== undefined) {
            errors.push(`Row ${err.row}: ${err.message}`);
          }
        });
      }

      parsed.data.forEach((row, index) => {
        const getVal = (...keys: string[]): string => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find((rk) => rk.includes(k));
            if (foundKey && row[foundKey] !== undefined) {
              return row[foundKey].trim();
            }
          }
          return "";
        };

        const positionId = getVal("position", "ticket", "order", "id") || `EX-${Date.now()}-${index}`;
        const rawType = getVal("type", "action", "direction", "side").toLowerCase();
        const symbol = getVal("symbol", "item", "pair").toUpperCase() || "EURUSD";

        const openTimeRaw = getVal("open time", "opentime", "open date", "time");
        const closeTimeRaw = getVal("close time", "closetime", "close date") || openTimeRaw;

        const volumeRaw = getVal("volume", "lots", "lot", "size");
        const openPriceRaw = getVal("open price", "openprice", "price");
        const closePriceRaw = getVal("close price", "closeprice", "exit price");

        const profitRaw = getVal("profit", "pnl", "net pnl", "realized pnl");
        const commissionRaw = getVal("commission", "fee", "comm");
        const swapRaw = getVal("swap", "rollover");

        // Parse numeric values
        const lot = parseFloat(volumeRaw) || 0.1;
        const entryPrice = parseFloat(openPriceRaw) || 0;
        const exitPrice = parseFloat(closePriceRaw) || entryPrice;
        const rawPnl = parseFloat(profitRaw) || 0;
        const commission = Math.abs(parseFloat(commissionRaw) || 0);
        const swap = parseFloat(swapRaw) || 0;

        const netPnl = rawPnl - commission + swap;

        const direction: Direction =
          rawType.includes("buy") || rawType.includes("long") ? "LONG" : "SHORT";

        let status: TradeStatus = "BREAKEVEN";
        if (netPnl > 0.5) status = "WIN";
        else if (netPnl < -0.5) status = "LOSS";

        let openTime = new Date().toISOString();
        let closeTime = new Date().toISOString();
        let holdDurationMs = 0;

        if (openTimeRaw) {
          const parsedOpen = new Date(openTimeRaw.replace(/\./g, "-"));
          if (!isNaN(parsedOpen.getTime())) openTime = parsedOpen.toISOString();
        }

        if (closeTimeRaw) {
          const parsedClose = new Date(closeTimeRaw.replace(/\./g, "-"));
          if (!isNaN(parsedClose.getTime())) {
            closeTime = parsedClose.toISOString();
            const openMs = new Date(openTime).getTime();
            const closeMs = parsedClose.getTime();
            holdDurationMs = Math.max(0, closeMs - openMs);
          }
        }

        // Calculate R:R ratio
        const priceDelta = Math.abs(exitPrice - entryPrice);
        const estimatedRisk = entryPrice * 0.005;
        const rr = parseFloat((priceDelta / (estimatedRisk || 1)).toFixed(2));

        trades.push({
          id: `exness-${positionId}-${index}`,
          positionId,
          openTime,
          closeTime,
          symbol,
          direction,
          lot,
          entryPrice,
          exitPrice,
          pnl: parseFloat(netPnl.toFixed(2)),
          commission: parseFloat(commission.toFixed(2)),
          swap: parseFloat(swap.toFixed(2)),
          rr: status === "LOSS" ? -1 : Math.max(0.5, rr),
          status,
          account: accountName,
          accountType: detectedAccountType,
          currency: detectedCurrency,
          broker: "Exness",
          notes: `Position Ticket #${positionId} (${detectedAccountType})`,
          tags: [symbol, direction, "Exness", detectedAccountType],
          holdDurationMs,
        });
      });

      return {
        success: trades.length > 0,
        trades,
        detectedCurrency,
        detectedAccountType,
        errors,
        totalParsed: trades.length,
      };
    } catch (err: any) {
      return {
        success: false,
        trades: [],
        detectedCurrency: "USD",
        detectedAccountType: "Standard",
        errors: [err.message || "Failed to parse CSV file"],
        totalParsed: 0,
      };
    }
  },
};
