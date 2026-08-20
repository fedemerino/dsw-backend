import { readFileSync } from 'fs';
import path from 'path';
import { load } from 'js-yaml';

// process.cwd() (not import.meta.url) so this also works when babel-jest
// transpiles this ES module to CommonJS for the test suite.
const openapiPath = path.join(process.cwd(), 'docs/openapi.yaml');

export const swaggerDocument = load(readFileSync(openapiPath, 'utf8'));
