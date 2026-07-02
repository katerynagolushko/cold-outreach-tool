import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "nodemailer", "@electric-sql/pglite"],
};

export default nextConfig;
