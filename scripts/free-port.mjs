#!/usr/bin/env node
// Force-frees the given TCP ports (default: 3030 web, 3031 api) when a dev
// server was killed uncleanly and left the port bound.
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['3030', '3031'];
const isWindows = process.platform === 'win32';

for (const port of ports) {
  try {
    if (isWindows) {
      const out = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: 'utf8' },
      );
      const pids = [
        ...new Set(
          out
            .trim()
            .split('\n')
            .map((line) => line.trim().split(/\s+/).pop()),
        ),
      ];
      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`);
        console.log(`[free-port] Killed PID ${pid} on port ${port}`);
      }
    } else {
      const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
      const pids = out.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        execSync(`kill -9 ${pid}`);
        console.log(`[free-port] Killed PID ${pid} on port ${port}`);
      }
    }
  } catch {
    console.log(`[free-port] Port ${port} is already free`);
  }
}
