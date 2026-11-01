// `output: "standalone"` leaves static assets and public/ out of the server bundle.
// Copy them in so `pnpm start` serves the same thing the Docker image will.
import { cpSync, existsSync } from "node:fs";

const target = ".next/standalone";
if (!existsSync(target)) {
  console.error(`${target} is missing; did next build run?`);
  process.exit(1);
}
cpSync(".next/static", `${target}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${target}/public`, { recursive: true });
console.log("standalone output prepared");
