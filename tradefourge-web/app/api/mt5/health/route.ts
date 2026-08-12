import { NextResponse } from "next/server";
import { mt5Success } from "@/lib/api/mt5-response";

export async function GET() {
  return mt5Success({
    service: "tradeforge-mt5-api",
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
