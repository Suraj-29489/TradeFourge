// lib/engine/batch-processor.ts
// TradeFourge v3.7.7 — High-Performance Large Dataset Batch Processor
// Non-blocking asynchronous processing with main-thread event loop yielding & cancellation checks for 50,000+ trades.

export interface BatchProgressInfo {
  processedCount: number;
  totalCount: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  stageLabel: string;
}

export interface BatchOptions {
  batchSize?: number; // Default: 500
  yieldDelayMs?: number; // Default: 0 (yields event loop)
  isCancelled?: () => boolean;
  onProgress?: (info: BatchProgressInfo) => void;
}

export interface BatchResult<R> {
  results: R[];
  processedCount: number;
  totalCount: number;
  cancelled: boolean;
  errors: string[];
}

/**
 * Executes a worker function across items in non-blocking batches.
 * Yields control back to the browser UI loop between batches to prevent browser freezing.
 */
export async function processInBatches<T, R>(
  items: T[],
  workerFn: (batch: T[], batchIndex: number) => Promise<R[]>,
  options: BatchOptions = {}
): Promise<BatchResult<R>> {
  const batchSize = options.batchSize || 500;
  const yieldDelayMs = options.yieldDelayMs ?? 0;
  const totalCount = items.length;
  const totalBatches = Math.ceil(totalCount / batchSize);

  const results: R[] = [];
  const errors: string[] = [];
  let processedCount = 0;

  for (let b = 0; b < totalBatches; b++) {
    // 1. Check Cancellation Signal
    if (options.isCancelled && options.isCancelled()) {
      return {
        results,
        processedCount,
        totalCount,
        cancelled: true,
        errors: [...errors, "Processing cancelled by user."],
      };
    }

    // 2. Slice Batch Items
    const startIdx = b * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalCount);
    const batch = items.slice(startIdx, endIdx);

    try {
      // 3. Execute Worker Function
      const batchResults = await workerFn(batch, b);
      results.push(...batchResults);
      processedCount += batch.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Error in batch ${b + 1}`;
      errors.push(msg);
    }

    // 4. Report Progress Callback
    if (options.onProgress) {
      const percentage = Math.round((processedCount / totalCount) * 100);
      options.onProgress({
        processedCount,
        totalCount,
        currentBatch: b + 1,
        totalBatches,
        percentage,
        stageLabel: `Processing batch ${b + 1} of ${totalBatches} (${processedCount.toLocaleString()} / ${totalCount.toLocaleString()} trades)...`,
      });
    }

    // 5. Main Thread Event Loop Yielding (Prevents UI Freezing)
    await new Promise((resolve) => setTimeout(resolve, yieldDelayMs));
  }

  return {
    results,
    processedCount,
    totalCount,
    cancelled: false,
    errors,
  };
}
