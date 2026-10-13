/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

// Generates `lib/config/schema.generated.js`: a static, pre-compiled form of the
// agent config JSON Schema. At runtime `lib/config/schema.js` prefers this file
// (a plain `require`) over reading and compiling the schema from
// `lib/config/schemas/` on every process start. Alongside it, writes
// `lib/config/schema.json`: the fully rendered schema (every `$ref` inlined),
// which the generated module requires as its `renderedSchema`.
//
// The generated files are committed to the repo so they ship with the package.
// When a schema block under `lib/config/schemas/` changes, regenerate and commit
// the result: `npm run generate:config-validator`. The drift test
// (`test/unit/config/schema.test.js`) fails CI when the committed artifacts are
// stale relative to the schema sources.
//
// The artifact contents are produced by `schema.render()`; this script only
// writes what that returns to disk.

const fs = require('node:fs')
const path = require('node:path')
const schema = require('../lib/config/schema.js')

const CONFIG_DIR = path.join(__dirname, '..', 'lib', 'config')
const GENERATED_FILE = path.join(CONFIG_DIR, 'schema.generated.js')
const RENDERED_SCHEMA_FILE = path.join(CONFIG_DIR, 'schema.json')

const { generated, renderedSchema } = schema.render()

fs.writeFileSync(GENERATED_FILE, generated)
console.log(`Wrote ${GENERATED_FILE}`)

fs.writeFileSync(RENDERED_SCHEMA_FILE, renderedSchema)
console.log(`Wrote ${RENDERED_SCHEMA_FILE}`)
