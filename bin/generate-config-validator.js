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
// The generated file is committed to the repo so it ships with the package. When
// a schema block under `lib/config/schemas/` changes, regenerate and commit the
// result: `npm run generate:config-validator`. The drift test
// (`test/unit/config/schema.test.js`) fails CI when the committed artifact is
// stale relative to the schema sources.
//
// The artifact content is produced by `schema.render()`; this script only writes
// what that returns to disk.

const fs = require('node:fs')
const path = require('node:path')
const schema = require('../lib/config/schema.js')

const OUTPUT_FILE = path.join(__dirname, '..', 'lib', 'config', 'schema.generated.js')

fs.writeFileSync(OUTPUT_FILE, schema.render())
console.log(`Wrote ${OUTPUT_FILE}`)
