// Creates the first console account, or restores owner access to one.
//
//   pnpm auth:owner --email owner@example.com --name "Full Name" --password-file ./pw.txt
//   pnpm auth:owner --email owner@example.com --name "Full Name" < ./pw.txt
//   pnpm auth:owner --email owner@example.com --name "Full Name"      (asks, without echo)
//
// The password is read from a file, a pipe or a hidden prompt, never from the
// command line, so it stays out of shell history and the process list.
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { connect, databaseUrl } from "../src/db/client";
import { ownerInput, setOwner } from "../src/lib/auth/owner";

if (existsSync(".env")) process.loadEnvFile(".env");

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    "password-file": { type: "string" },
  },
});

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    let input = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(input);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") input = input.slice(0, -1);
        else input += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword(): Promise<string> {
  const file = values["password-file"];
  if (file) return readFileSync(file, "utf8").replace(/\r?\n$/, "");
  if (!process.stdin.isTTY) {
    let piped = "";
    for await (const chunk of process.stdin) piped += String(chunk);
    return piped.replace(/\r?\n$/, "");
  }
  const first = await readHidden("Password: ");
  const second = await readHidden("Repeat the password: ");
  if (first !== second) throw new Error("The passwords do not match.");
  return first;
}

const password = await readPassword();
const input = ownerInput.safeParse({ email: values.email, name: values.name, password });
if (!input.success) {
  console.error(
    'Usage: pnpm auth:owner --email owner@example.com --name "Full Name" [--password-file path]',
  );
  for (const issue of input.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const { db, close } = connect(databaseUrl());
try {
  const { created } = await setOwner(db, input.data);
  console.log(
    created
      ? `Created the owner account ${input.data.email}.`
      : `${input.data.email} is now an active owner with the new password.`,
  );
} finally {
  await close();
}
