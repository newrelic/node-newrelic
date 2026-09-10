/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Regenerates `full-config.json`: a configuration that specifies a value for
 * every field the agent's config definition exposes. It walks
 * `lib/config/default.js`'s `definition()` and, for each leaf, picks a
 * type-correct sample value based on the leaf's formatter (or default). The
 * result is used by `index.bench.js` to measure the cost of parsing a maximal
 * configuration.
 *
 * Run from the repo root:
 *   node test/benchmark/lib/config/generate-full-config.js
 */

const fs = require('fs')
const path = require('path')

const defaultConfig = require('../../../../lib/config/default')
const pkgInstrumentation = require('../../../../lib/config/build-instrumentation-config')
const formatters = require('../../../../lib/config/formatters')

const OUTPUT_PATH = path.join(__dirname, 'full-config.json')

// A few leaves can't be inferred from their formatter/default alone.
const VALUE_OVERRIDES = {
  // Custom formatter splits a delimited string; give it a real array.
  app_name: ['Benchmark App One', 'Benchmark App Two'],
  // The default ('') is a placeholder the parser rejects; supply a real key.
  license_key: '0000111122223333444455556666777788889999',
  // The default is a cwd-relative absolute path; 'stdout' keeps the fixture portable.
  'logging.filepath': 'stdout'
}

// Maps a formatter to a function that produces a type-correct sample value
// from the leaf's default. Keyed by the formatter reference itself.
const FORMATTER_SAMPLES = new Map([
  [formatters.boolean, (def) => (typeof def === 'boolean' ? !def : true)],
  [formatters.int, (def) => (typeof def === 'number' ? def : 1)],
  [formatters.float, (def) => (typeof def === 'number' ? def : 0.5)],
  [formatters.array, (def) => (Array.isArray(def) && def.length ? def : ['sample-a', 'sample-b'])],
  [formatters.object, (def) => (def && typeof def === 'object' && !Array.isArray(def) ? def : { key: 'value' })],
  [formatters.objectList, () => [{ key: 'value' }]]
])

function leafValue(pathStr, node) {
  if (Object.prototype.hasOwnProperty.call(VALUE_OVERRIDES, pathStr)) {
    return VALUE_OVERRIDES[pathStr]
  }

  if (typeof node === 'string') {
    return node === '' ? 'sample' : node
  }

  const { formatter, default: def } = node
  const sample = FORMATTER_SAMPLES.get(formatter)
  if (sample) {
    return sample(def)
  }
  // `allowList` is bound, so it can't be a Map key; its default is a valid member.
  if (formatter && formatter.name === 'bound allowList') {
    return def
  }
  if (def === null || def === undefined) {
    return 'sample'
  }
  return def
}

function walk(pathStr, node) {
  if (node === pkgInstrumentation) {
    const out = {}
    for (const pkg of Object.keys(node)) {
      out[pkg] = { enabled: false }
    }
    return out
  }

  if (typeof node !== 'object' || node === null) {
    return leafValue(pathStr, node)
  }

  const isLeaf = ['default', 'formatter', 'env'].some((prop) => Object.prototype.hasOwnProperty.call(node, prop))
  if (isLeaf) {
    return leafValue(pathStr, node)
  }

  const out = {}
  for (const [key, child] of Object.entries(node)) {
    out[key] = walk(pathStr ? `${pathStr}.${key}` : key, child)
  }
  return out
}

function generate() {
  const definition = defaultConfig.definition()
  const config = {}
  for (const [key, value] of Object.entries(definition)) {
    config[key] = walk(key, value)
  }

  // Exercise the object-shaped samplers rather than the string defaults so the
  // fixture covers the sampler-building code path.
  config.distributed_tracing.sampler.remote_parent_sampled = {
    trace_id_ratio_based: { ratio: 0.5 }
  }
  config.distributed_tracing.sampler.remote_parent_not_sampled = {
    adaptive: { sampling_target: 20 }
  }

  return config
}

if (require.main === module) {
  const config = generate()
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(config, null, 2)}\n`)
  // eslint-disable-next-line no-console
  console.log(`Wrote ${OUTPUT_PATH}`)
}

module.exports = { generate }
