import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const pleskBin = '/opt/plesk/node/22/bin';
const pleskNpm = `${pleskBin}/npm`;
const deploymentEnvironment = existsSync(pleskNpm)
  ? { ...process.env, PATH: `${pleskBin}:${process.env.PATH ?? ''}` }
  : process.env;

if (existsSync(pleskNpm)) {
  const install = spawnSync(pleskNpm, ['ci', '--include=dev', '--include=optional'], {
    cwd: process.cwd(),
    env: deploymentEnvironment,
    stdio: 'inherit',
  });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const tasks = [
  ['node_modules/typescript/bin/tsc', ['-b']],
  ['node_modules/vite/bin/vite.js', ['build']],
  ['node_modules/typescript/bin/tsc', ['-p', 'tsconfig.server.json']],
  ['node_modules/tsx/dist/cli.mjs', ['server/src/db/migrate.ts']],
];

for (const [entrypoint, arguments_] of tasks) {
  const result = spawnSync(process.execPath, [entrypoint, ...arguments_], {
    cwd: process.cwd(),
    env: deploymentEnvironment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
