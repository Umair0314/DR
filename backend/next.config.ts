import path from "node:path";
import { existsSync } from "node:fs";
import { loadEnvConfig } from "@next/env";

const currentDirectory = process.cwd();
const parentDirectory = path.resolve(currentDirectory, "..");
const projectRoot = existsSync(path.join(currentDirectory, "backend", "package.json"))
  ? currentDirectory
  : existsSync(path.join(parentDirectory, "backend", "package.json"))
    ? parentDirectory
    : currentDirectory;

if (!process.env.AHREFS_API_KEY && existsSync(path.join(projectRoot, ".env.local"))) {
  loadEnvConfig(projectRoot);
}

const nextConfig = {};
export default nextConfig;
