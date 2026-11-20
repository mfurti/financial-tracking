import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

/** Minimal public Playwright listing shape; test bodies remain owned by Playwright. */
type ListedSuite = {
  specs: { file: string; tests: { projectName: string }[] }[];
  suites: ListedSuite[];
};
/** Each listed file contributes its actual selected case count to each isolated server. */
type FileSelection = { file: string; counts: Map<string, number> };
/** One process owns at most three servers and eight expected login attempts per project. */
type Batch = { files: FileSelection[]; projects: string[]; counts: Map<string, number> };
const cli = resolve('node_modules/@playwright/test/cli.js');
const args = process.argv.slice(2);
const execute = promisify(execFile);

/** Run a normal Playwright child with inherited diagnostics and a truthful exit status. */
async function playwright(options: string[], env = process.env) {
  return await new Promise<number>(
    /** The parent does not detach or hide a failing browser process. */ (complete, reject) => {
      const child = spawn(process.execPath, [cli, 'test', ...options], { stdio: 'inherit', env });
      child.once('error', reject);
      child.once(
        'exit',
        /** A signal is a failed/incomplete run, never a passing batch. */ (code) => complete(code ?? 1),
      );
    },
  );
}

/** Account for intentional extra real sessions inside the two multi-context test files. */
function loginWeight(file: string, cases: number) {
  return (
    cases +
    (basename(file) === 'workspace-settings.spec.ts' ? 2 : basename(file) === 'concept-coverage.spec.ts' ? 1 : 0)
  );
}

/** Preserve the caller's artifact destination while assigning each batch a distinct child directory. */
function outputDirectory() {
  let output = 'test-results';
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--output') output = args[index + 1] ?? output;
    else if (args[index]!.startsWith('--output=')) output = args[index]!.slice('--output='.length);
  }
  return resolve(output);
}

/** Collect every selected file/project pair from Playwright's own CLI listing. */
function filesFrom(suites: ListedSuite[], files = new Map<string, FileSelection>()) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      const file = files.get(spec.file) ?? { file: spec.file, counts: new Map<string, number>() };
      for (const test of spec.tests) file.counts.set(test.projectName, (file.counts.get(test.projectName) ?? 0) + 1);
      files.set(spec.file, file);
    }
    filesFrom(suite.suites ?? [], files);
  }
  return [...files.values()];
}

/** Partition actual selections without dropping cases or changing production authentication limits. */
function batchesFrom(files: FileSelection[]) {
  const projects = [
    ...new Set(files.flatMap(/** Retain all selected project identities. */ (file) => [...file.counts.keys()])),
  ];
  const batches: Batch[] = [];
  for (let index = 0; index < projects.length; index += 3) {
    const group = projects.slice(index, index + 3);
    let batch: Batch = { files: [], projects: group, counts: new Map() };
    for (const file of files) {
      const selected = group.filter(
        /** Files only start projects to which Playwright assigned cases. */ (project) => file.counts.has(project),
      );
      if (!selected.length) continue;
      if (
        selected.some(
          /** Oversized files require a reviewed test boundary rather than relaxed security. */ (project) =>
            loginWeight(file.file, file.counts.get(project)!) > 8,
        )
      )
        throw new Error(`Split the browser file before running more than eight login attempts: ${file.file}`);
      if (
        selected.some(
          /** Start a fresh owned server before its real login budget is exhausted. */ (project) =>
            (batch.counts.get(project) ?? 0) + loginWeight(file.file, file.counts.get(project)!) > 8,
        )
      ) {
        batches.push(batch);
        batch = { files: [], projects: group, counts: new Map() };
      }
      batch.files.push(file);
      for (const project of selected)
        batch.counts.set(project, (batch.counts.get(project) ?? 0) + loginWeight(file.file, file.counts.get(project)!));
    }
    if (batch.files.length) batches.push(batch);
  }
  return batches;
}

/** Execute every selected case once, preserving per-batch traces and machine-readable results. */
async function main() {
  if (
    args.some(
      /** Read-only and interactive CLI modes retain their native behavior. */ (arg) =>
        ['--list', '--help', '-h', '--version', '--ui', '--debug'].includes(arg),
    )
  ) {
    process.exitCode = await playwright(args);
    return;
  }
  const listing = await execute(process.execPath, [cli, 'test', ...args, '--list', '--reporter=json'], {
    maxBuffer: 32 * 1024 * 1024,
  });
  const plan = JSON.parse(listing.stdout) as { suites: ListedSuite[]; errors?: unknown[] };
  if (plan.errors?.length) throw new Error('Playwright could not collect the complete selected suite.');
  const files = filesFrom(plan.suites);
  const batches = batchesFrom(files);
  if (!batches.length) throw new Error('No selected browser cases; use --list to inspect the selection.');
  await mkdir('.local', { recursive: true });
  const runRoot = await mkdtemp(resolve('.local/e2e-run-'));
  const outputRoot = outputDirectory();
  await mkdir(outputRoot, { recursive: true });
  const evidence: { batch: number; projects: string[]; cases: number; status: string; report: string }[] = [];
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index]!;
    const projects = batch.projects.filter(
      /** Never launch an unused server. */ (project) => batch.counts.has(project),
    );
    const testList = resolve(runRoot, `batch-${index + 1}.txt`);
    const lines = batch.files.flatMap(
      /** Playwright's native test-list filter intersects the caller's original selectors. */ (file) =>
        projects
          .filter(/** Keep each file/project pair exactly once. */ (project) => file.counts.has(project))
          .map(
            /** Use file-level selection so nested titles and parameterized cases remain intact. */ (project) =>
              `[${project}] › ${file.file.replaceAll('\\', '/')}`,
          ),
    );
    await writeFile(testList, `${lines.join('\n')}\n`);
    const cases = batch.files.reduce(
      /** Count original selected cases, including runtime skips, without inventing results. */ (sum, file) =>
        sum +
        projects.reduce(
          /** Match only this batch's server owners. */ (count, project) => count + (file.counts.get(project) ?? 0),
          0,
        ),
      0,
    );
    const output = resolve(outputRoot, `batch-${index + 1}`);
    const report = resolve(outputRoot, `batch-${index + 1}.json`);
    console.info(`Browser batch ${index + 1}/${batches.length}: ${cases} cases; ${projects.join(', ')}`);
    const code = await playwright([...args, `--test-list=${testList}`, `--output=${output}`, '--reporter=line,json'], {
      ...process.env,
      E2E_BATCH_PROJECTS: JSON.stringify(projects),
      PLAYWRIGHT_JSON_OUTPUT_FILE: report,
    });
    const result = JSON.parse(await readFile(report, 'utf8')) as {
      stats: { expected: number; unexpected: number; flaky: number; skipped: number };
    };
    const reported = Object.values(result.stats).filter(
      /** Duration/timestamp fields are not case counts. */ (value) => typeof value === 'number',
    );
    // Explicit fields avoid counting duration even when a newer reporter adds more numeric metadata.
    const actualCases = result.stats.expected + result.stats.unexpected + result.stats.flaky + result.stats.skipped;
    if (!reported.length || actualCases !== cases)
      throw new Error(`Incomplete browser batch ${index + 1}: expected ${cases}, reported ${actualCases}`);
    evidence.push({ batch: index + 1, projects, cases, status: code === 0 ? 'passed' : 'failed', report });
    await writeFile(
      resolve(outputRoot, 'batches.json'),
      JSON.stringify(
        {
          selectedCases: files.reduce(
            /** Retain the complete original selection count. */ (sum, file) =>
              sum +
              [...file.counts.values()].reduce(/** Sum each project case once. */ (count, value) => count + value, 0),
            0,
          ),
          completed: evidence,
        },
        null,
        2,
      ),
    );
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
  console.info(`All ${batches.length} browser batches passed; evidence: ${resolve(outputRoot, 'batches.json')}`);
}

await main();
