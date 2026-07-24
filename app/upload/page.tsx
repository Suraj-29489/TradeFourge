"use client";

import React from "react";
import { CsvUploader }    from "@/components/upload/CsvUploader";
import { JournalManager } from "@/components/upload/JournalManager";

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <CsvUploader />
      {/* Journal list appears below uploader */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border">
        <JournalManager />
      </div>
    </div>
  );
}
