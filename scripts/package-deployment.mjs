import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const revision = args.get('--revision');
const output = args.get('--output');
const images = ['api', 'web', 'backup'].map(
  /** Reject mutable tags and unexpected registry destinations before writing a bundle. */ (name) => {
    const value = args.get(`--${name}`);
    if (!new RegExp(`^ghcr\\.io/mfurti/financial-tracking-${name}@sha256:[a-f0-9]{64}$`).test(value ?? ''))
      throw new Error('Supply the immutable GHCR digest for each application image');
    return [name, value];
  },
);
if (!/^[a-f0-9]{40}$/.test(revision ?? '') || !output) throw new Error('Supply a full revision and output directory');
const root = resolve('.local');
const directory = resolve(output);
if (!directory.startsWith(`${root}${sep}`))
  throw new Error('Bundle output must be inside the workspace .local directory');
await mkdir(directory, { recursive: true });
if ((await readdir(directory)).length) throw new Error('Bundle output must be empty');
let environment = await readFile('infrastructure/.env.example', 'utf8');
for (const [name, image] of images) environment = environment.replace(`RELEASE_${name.toUpperCase()}_IMAGE`, image);
await writeFile(join(directory, '.env.example'), environment);
await writeFile(join(directory, 'compose.yaml'), await readFile('infrastructure/compose.yaml'));
await writeFile(join(directory, 'README.md'), await readFile('infrastructure/DEPLOYMENT.md'));
await writeFile(join(directory, 'REVISION'), `${revision}\n`);
process.stdout.write('Deployment-only bundle created; no source files or secrets copied.\n');
