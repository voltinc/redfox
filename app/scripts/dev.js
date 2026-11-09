/* Development runner: the API on :3000 and the Vite dev server on :5173 with
   proxies for /api, /v1 and /preview. One command, two processes, shared logs. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const procs = [
  { name: 'api', command: 'node', args: ['--watch', 'server/index.js'], cwd: root, env: { PORT: '3000' } },
  { name: 'web', command: 'npx', args: ['vite', '--port', '5173'], cwd: path.join(root, 'web') },
];

const children = procs.map((proc) => {
  const child = spawn(proc.command, proc.args, {
    cwd: proc.cwd,
    env: { ...process.env, ...(proc.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = `[${proc.name}] `;
  const write = (stream) => (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) stream.write(prefix + line + '\n');
    }
  };
  child.stdout.on('data', write(process.stdout));
  child.stderr.on('data', write(process.stderr));
  child.on('exit', (code) => {
    if (code) console.error(`${prefix}exited with code ${code}`);
  });
  return child;
});

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('\n  Redfox dev\n  api  http://localhost:3000\n  web  http://localhost:5173\n');
