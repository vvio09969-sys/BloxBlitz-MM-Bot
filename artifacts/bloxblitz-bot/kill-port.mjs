import { readFileSync, readdirSync, readlinkSync } from "fs";

const port = parseInt(process.env.PORT || process.argv[2] || "0", 10);
if (!port) process.exit(0);

const hexPort = port.toString(16).toUpperCase().padStart(4, "0");

function findPid(file) {
  try {
    const lines = readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const localAddr = parts[1];
      const portHex = localAddr?.split(":")[1];
      if (portHex?.toUpperCase() === hexPort) {
        const inode = parts[9];
        for (const pid of readdirSync("/proc").filter((d) => /^\d+$/.test(d))) {
          try {
            for (const fd of readdirSync(`/proc/${pid}/fd`)) {
              try {
                if (readlinkSync(`/proc/${pid}/fd/${fd}`) === `socket:[${inode}]`) {
                  return parseInt(pid);
                }
              } catch {}
            }
          } catch {}
        }
      }
    }
  } catch {}
  return null;
}

const pid = findPid("/proc/net/tcp6") || findPid("/proc/net/tcp");
if (pid && pid !== process.pid) {
  try {
    process.kill(pid, "SIGKILL");
    await new Promise((r) => setTimeout(r, 600));
    console.log(`[kill-port] Killed PID ${pid} on port ${port}`);
  } catch (e) {
    console.log(`[kill-port] Could not kill PID ${pid}: ${e.message}`);
  }
} else {
  console.log(`[kill-port] Port ${port} is free`);
}
