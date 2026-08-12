// lib/api/mt5-response.ts
// Standardized API Response Helpers for MT5 Companion API endpoints.

import { NextResponse } from "next/server";
import type { MT5ApiResponseSuccess, MT5ApiResponseError } from "@/types/mt5-api";

export function mt5Success<T>(data: T, status = 200): NextResponse<MT5ApiResponseSuccess<T>> {
  return NextResponse.json(
    {
      ok: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function mt5Error(
  code: string,
  message: string,
  status = 400,
  details?: any
): NextResponse<MT5ApiResponseError> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
