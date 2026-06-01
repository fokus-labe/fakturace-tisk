import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Na Vercelu se public/ servíruje přes CDN, ale není v souborovém systému
  // serverless funkcí. PDF generátor čte Inter font z disku, proto ho musíme
  // explicitně přibalit do funkcí, které generují PDF.
  outputFileTracingIncludes: {
    "/api/invoice-requests/**": ["./public/fonts/**"],
  },
};

export default nextConfig;
