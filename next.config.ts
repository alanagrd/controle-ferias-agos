import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist e mupdf são usados só em Route Handlers (runtime nodejs).
  serverExternalPackages: ["pdfjs-dist", "mupdf"],
  // Imports dinâmicos (worker do pdfjs e o .wasm do mupdf) não são rastreados
  // pelo file tracing; sem isto o Vercel não os inclui no pacote da função.
  outputFileTracingIncludes: {
    "/api/holerites/parse": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/api/holerites/importar": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/mupdf/dist/mupdf-wasm.wasm",
    ],
  },
};

export default nextConfig;
