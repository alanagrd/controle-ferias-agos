import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist e pdf-lib são usados só em Route Handlers (runtime nodejs).
  serverExternalPackages: ["pdfjs-dist", "pdf-lib"],
  // O pdfjs carrega o worker por import dinâmico; sem isto o Vercel não inclui
  // o pdf.worker.mjs no pacote da função ("Cannot find module ... pdf.worker.mjs").
  outputFileTracingIncludes: {
    "/api/holerites/parse": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/api/holerites/importar": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
