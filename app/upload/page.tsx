"use client";

import React from "react";
import { CsvUploader } from "@/components/upload/CsvUploader";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <CsvUploader />
    </div>
  );
}
