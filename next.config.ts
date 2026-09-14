import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist e pdf-lib são usados só em Route Handlers (runtime nodejs).
  // Mantê-los fora do bundle evita problemas com require dinâmico/worker.
  serverExternalPackages: ["pdfjs-dist", "pdf-lib"],
};

export default nextConfig;
