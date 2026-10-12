/* global __dirname, __filename */
const { writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const HEADER =
  '// Generated from openapi.yml. Regenerate with npm run api:generate. Do not edit.\n';
async function generateSchema() {
  const { default: openapiTS, astToString } = require('openapi-typescript');
  const prettier = require('prettier');
  return prettier.format(
    HEADER + astToString(await openapiTS(pathToFileURL(path.join(__dirname, 'openapi.yml')))),
    { ...(await prettier.resolveConfig(__filename)), parser: 'typescript' },
  );
}
module.exports = { generateSchema };
if (require.main === module) {
  generateSchema().then((schema) => writeFileSync(path.join(__dirname, 'schema.ts'), schema));
}
