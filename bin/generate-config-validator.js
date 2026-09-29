/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

// Generates `lib/config/schema.generated.js`: a static, pre-compiled form of the
// agent config JSON Schema. At runtime `lib/config/schema.js` prefers this file
// (a plain `require`) over reading and compiling the schema from
// `lib/config/schemas/` on every process start.
//
// This generator is a build-time tool. It is run during the release process and
// the resulting artifact is committed into the release PR so it ships with the
// package; it is not itself published. See `.github/workflows/prepare-release.yml`.

const fs = require('node:fs')
const path = require('node:path')
const standaloneCode = require('ajv/dist/standalone').default
const schemaModule = require('../lib/config/schema.js')

const OUTPUT_FILE = path.join(__dirname, '..', 'lib', 'config', 'schema.generated.js')

/**
 * Serializes an env-var index (a `Map`) to a plain object suitable for JSON
 * embedding: `{ [name]: { pathSegments, node } }`.
 *
 * @param {Map<string, {pathSegments: string[], node: object}>} envVarIndex The
 *   env-var index to serialize.
 * @returns {object} The env-var index as a plain object.
 */
function serializeEnvVarIndex(envVarIndex) {
  const index = {}
  for (const [name, entry] of envVarIndex) {
    index[name] = { pathSegments: entry.pathSegments, node: entry.node }
  }
  return index
}

function main() {
  // buildState reads the schema from disk directly — it does not consult the
  // module cache or any existing artifact — so this always reflects the current
  // sources. `code.source` makes ajv emit standalone, dependency-inlined
  // validation code.
  const state = schemaModule.buildState({ code: { source: true, esm: false } })
  const validatorCode = standaloneCode(state.ajv, state.validate)
  const renderedSchema = schemaModule.renderNode(state.schema, state.resolveRef)

  const embedded = {
    schema: state.schema,
    refs: state.refs,
    renderedSchema,
    envVarIndex: serializeEnvVarIndex(state.envVarIndex)
  }

  const banner =
    '/*\n' +
    ' * Copyright 2026 New Relic Corporation. All rights reserved.\n' +
    ' * SPDX-License-Identifier: Apache-2.0\n' +
    ' */\n\n' +
    "'use strict'\n\n" +
    '/*\n' +
    ' * GENERATED FILE — DO NOT EDIT.\n' +
    ' *\n' +
    ' * Produced by `npm run generate:config-validator`\n' +
    ' * (bin/generate-config-validator.js) from the agent config JSON Schema in\n' +
    ' * lib/config/schemas/. It is a static, pre-compiled form of the schema so\n' +
    ' * that lib/config/schema.js can obtain the validator via a plain require\n' +
    ' * instead of reading and compiling the schema on every process start.\n' +
    ' */\n\n'

  // The standalone validator is a self-contained CommonJS module string. We
  // evaluate it in its own module scope so its top-level `require`/`exports`
  // don't collide with ours, then expose the result as `validate`.
  const body =
    'const { schema, refs, renderedSchema, envVarIndex } = ' +
    `${JSON.stringify(embedded, null, 2)}\n\n` +
    'const validate = (function () {\n' +
    '  const module = { exports: {} }\n' +
    '  const exports = module.exports\n' +
    '  ;(function (module, exports, require) {\n' +
    validatorCode
      .split('\n')
      .map((line) => (line.length ? '    ' + line : line))
      .join('\n') +
    '\n  })(module, exports, require)\n' +
    '  return module.exports\n' +
    '})()\n\n' +
    'module.exports = { schema, validate, refs, renderedSchema, envVarIndex }\n'

  fs.writeFileSync(OUTPUT_FILE, banner + body)
  console.log(`Wrote ${OUTPUT_FILE}`)
}

main()
