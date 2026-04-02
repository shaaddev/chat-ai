import { spawn } from "node:child_process";
import { auth } from "@/app/auth";

const TIMEOUT_MS = 5000;
const MAX_OUTPUT = 10_000;

function truncate(str: string) {
  return str.length > MAX_OUTPUT
    ? `${str.slice(0, MAX_OUTPUT)}\n...(truncated)`
    : str;
}

function getCommand(language: string): { cmd: string; args: string[] } | null {
  const lang = language.toLowerCase().replace(/\s+/g, "");

  if (["javascript", "js", "node"].includes(lang)) {
    return { cmd: "node", args: ["-e"] };
  }
  if (["typescript", "ts"].includes(lang)) {
    return { cmd: "npx", args: ["tsx", "-e"] };
  }
  if (["python", "python3", "py"].includes(lang)) {
    return { cmd: "python3", args: ["-c"] };
  }

  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code: string; language: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { code, language } = body;
  if (!code || typeof code !== "string") {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  const command = getCommand(language || "javascript");
  if (!command) {
    return Response.json(
      {
        stdout: "",
        stderr: `Unsupported language: ${language}. Supported: javascript, typescript, python.`,
        exitCode: 1,
      },
      { status: 200 }
    );
  }

  return new Promise<Response>((resolve) => {
    let stdout = "";
    let stderr = "";
    let resolved = false;

    const proc = spawn(command.cmd, [...command.args, code], {
      timeout: TIMEOUT_MS,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (exitCode) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(
        Response.json({
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          exitCode: exitCode ?? 1,
        })
      );
    });

    proc.on("error", (err) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(
        Response.json({
          stdout: "",
          stderr: err.message,
          exitCode: 1,
        })
      );
    });

    setTimeout(() => {
      if (resolved) {
        return;
      }
      resolved = true;
      try {
        proc.kill("SIGKILL");
      } catch {
        // Ignore kill failures after the process has already exited.
      }
      resolve(
        Response.json({
          stdout: truncate(stdout),
          stderr: truncate(`${stderr}\nExecution timed out (5s limit)`),
          exitCode: 124,
        })
      );
    }, TIMEOUT_MS + 500);
  });
}
