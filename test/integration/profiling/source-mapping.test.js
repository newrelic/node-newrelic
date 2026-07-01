/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test, describe, afterEach } = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')
const path = require('node:path')

const helper = require('../../lib/agent_helper')
const ProfilingManager = require('../../../lib/profiling/index')
const { Profile } = require('pprof-format')

// Transpiled fixture: require loads hot.js; FIXTURE_DIR holds its .js.map.
const { burnMappedCpu, burnUnmappedCpu } = require('./fixtures/transpiled/hot')
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'transpiled')
const ORIGINAL_CWD = process.cwd()

const logger = { trace() {}, debug() {}, error() {} }

/**
 * Decodes the gzipped pprof buffer into `{ name, file }` for every function frame.
 *
 * @param {Buffer} encoded gzipped, protobuf-encoded pprof profile
 * @returns {Array<{name: string, file: string}>} the decoded frames
 */
function decodeFrames(encoded) {
  const profile = Profile.decode(zlib.gunzipSync(encoded))
  const str = (i) => profile.stringTable.strings[i]
  return (profile.function || []).map((fn) => { return { name: str(fn.name), file: str(fn.filename) } })
}

// Drives the full config path: an agent configured with source_mapping, through
// ProfilingManager.register() (which builds the mapper from cwd) and start/collect.
// Each test uses a *different* hot function on purpose — a function is only reliably
// captured as a named frame the first time it is profiled, so reusing one across the
// two sessions in this file would leave the second under-sampled.
describe('CpuProfiler source mapping', () => {
  let agent
  let manager

  afterEach(() => {
    manager?.stop()
    manager = null
    process.chdir(ORIGINAL_CWD)
    helper.unloadAgent(agent)
  })

  test('resolves frames to the original .ts source when source_mapping is enabled', async () => {
    agent = helper.instrumentMockedAgent({
      profiling: { enabled: true, include: ['cpu'], source_mapping: { enabled: true } }
    })
    // Point the mapper's app-root scan at the fixture rather than the whole repo.
    process.chdir(FIXTURE_DIR)
    manager = new ProfilingManager({ agent, samplingInterval: 60_000 }, { logger })

    await manager.register()
    manager.start()
    burnMappedCpu(500)
    const [cpuData] = await manager.collect()

    const mapped = decodeFrames(cpuData).find((f) => f.name === 'burnMappedCpu')
    assert.ok(mapped, 'should have sampled the transpiled hot function')
    assert.ok(
      mapped.file.endsWith('hot.ts'),
      `frame should resolve to the original .ts source, got ${mapped.file}`
    )
  })

  test('reports the compiled .js file when source_mapping is disabled', async () => {
    agent = helper.instrumentMockedAgent({
      profiling: { enabled: true, include: ['cpu'], source_mapping: { enabled: false } }
    })
    manager = new ProfilingManager({ agent, samplingInterval: 60_000 }, { logger })

    await manager.register()
    manager.start()
    burnUnmappedCpu(500)
    const [cpuData] = await manager.collect()

    const unmapped = decodeFrames(cpuData).find((f) => f.name === 'burnUnmappedCpu')
    assert.ok(unmapped, 'should have sampled the transpiled hot function')
    assert.ok(
      unmapped.file.endsWith('hot.js'),
      `frame should fall back to the compiled .js file, got ${unmapped.file}`
    )
  })
})
