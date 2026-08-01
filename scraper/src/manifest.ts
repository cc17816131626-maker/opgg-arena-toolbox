import { createHash } from "node:crypto";
import type { Manifest } from "./types.js";

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function buildManifest(params: {
  patch: string;
  generatedAt: string;
  dataBuffer: Buffer;
  dataUrl: string;
}): Manifest {
  const { patch, generatedAt, dataBuffer, dataUrl } = params;
  return {
    version: `${generatedAt.slice(0, 10)}-${patch}`,
    patch,
    generatedAt,
    dataUrl,
    sha256: sha256Hex(dataBuffer),
    sizeBytes: dataBuffer.length,
  };
}
