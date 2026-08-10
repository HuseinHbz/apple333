import { readFile, readdir, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import type { AnySchema, ErrorObject } from 'ajv';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const repositoryRoot = process.cwd();
const schemaPath = resolve(
  repositoryRoot,
  'docs/prompts/schema/enterprise-phase-prompt.schema.json'
);
const defaultDocumentDirectories = [
  'docs/prompts/templates',
  'docs/prompts/phases'
];

function resolveRepositoryPath(input: string): string {
  const resolvedPath = resolve(repositoryRoot, input);
  const pathFromRoot = relative(repositoryRoot, resolvedPath);

  if (pathFromRoot === '' || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
    throw new Error(`Validation target must be inside the repository: ${input}`);
  }

  return resolvedPath;
}

async function readJson(path: string): Promise<JsonValue> {
  const contents = await readFile(path, 'utf8');
  return JSON.parse(contents) as JsonValue;
}

async function collectJsonFiles(path: string): Promise<string[]> {
  const metadata = await stat(path);

  if (metadata.isFile()) {
    return path.endsWith('.json') ? [path] : [];
  }

  if (!metadata.isDirectory()) {
    return [];
  }

  const entries = await readdir(path, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => collectJsonFiles(resolve(path, entry.name)))
  );

  return nestedFiles.flat();
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || '/';
    return `${location} ${error.message ?? 'failed validation'}`;
  });
}

async function main(): Promise<void> {
  const schema = (await readJson(schemaPath)) as AnySchema;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const requestedTargets = process.argv.slice(2);
  const sourceTargets = requestedTargets.length > 0 ? requestedTargets : defaultDocumentDirectories;
  const documentPaths = (
    await Promise.all(sourceTargets.map((target) => collectJsonFiles(resolveRepositoryPath(target))))
  ).flat();

  if (documentPaths.length === 0) {
    throw new Error('No prompt JSON documents were found to validate.');
  }

  let invalidDocumentCount = 0;
  for (const documentPath of documentPaths) {
    const displayPath = relative(repositoryRoot, documentPath);

    try {
      const document = await readJson(documentPath);
      if (validate(document)) {
        console.log(`PASS ${displayPath}`);
        continue;
      }

      invalidDocumentCount += 1;
      console.error(`FAIL ${displayPath}`);
      for (const error of formatErrors(validate.errors)) {
        console.error(`  - ${error}`);
      }
    } catch (error) {
      invalidDocumentCount += 1;
      const message = error instanceof Error ? error.message : 'Unknown validation error.';
      console.error(`FAIL ${displayPath}: ${message}`);
    }
  }

  if (invalidDocumentCount > 0) {
    throw new Error(`${invalidDocumentCount} prompt document(s) failed validation.`);
  }

  console.log(`Validated ${documentPaths.length} enterprise prompt document(s).`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Prompt validation failed.';
  console.error(`Prompt validation failed: ${message}`);
  process.exitCode = 1;
});
