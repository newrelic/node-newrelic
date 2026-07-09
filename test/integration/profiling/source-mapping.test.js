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
const { Profile } = require('pprof-format')

// require loads the compiled hot.js; FIXTURE_DIR holds its .js.map.
const { burnMappedCpu, burnUnmappedCpu, allocateMapped, allocateUnmapped } = require('./fixtures/transpiled/hot')
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'transpiled')
const ORIGINAL_CWD = process.cwd()

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

// Each test uses a different hot function: a function is only reliably captured as a
// named frame the first time it is profiled in a process.
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

    await agent.profilingData.initSourceMapper()
    manager = agent.profilingData.profilingManager
    manager.register()
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

    await agent.profilingData.initSourceMapper()
    manager = agent.profilingData.profilingManager
    manager.register()
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

// The heap sampler reports live allocations, so each test holds its retained
// arrays until after collect(). ~5000 * ~8 KB comfortably exceeds the 512 KB
// sampling interval, so the allocating frame is reliably captured.
describe('HeapProfiler source mapping', () => {
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
      profiling: { enabled: true, include: ['heap'], source_mapping: { enabled: true } }
    })
    // Point the mapper's app-root scan at the fixture rather than the whole repo.
    process.chdir(FIXTURE_DIR)

    await agent.profilingData.initSourceMapper()
    manager = agent.profilingData.profilingManager
    manager.register()
    manager.start()
    const retained = allocateMapped(5000)
    const [heapData] = await manager.collect()

    const mapped = decodeFrames(heapData).find((f) => f.name === 'allocateMapped')
    assert.ok(retained.length, 'should retain the allocations through collect')
    assert.ok(mapped, 'should have sampled the transpiled allocation function')
    assert.ok(
      mapped.file.endsWith('hot.ts'),
      `frame should resolve to the original .ts source, got ${mapped.file}`
    )
  })

  test('reports the compiled .js file when source_mapping is disabled', async () => {
    agent = helper.instrumentMockedAgent({
      profiling: { enabled: true, include: ['heap'], source_mapping: { enabled: false } }
    })

    await agent.profilingData.initSourceMapper()
    manager = agent.profilingData.profilingManager
    manager.register()
    manager.start()
    const retained = allocateUnmapped(5000)
    const [heapData] = await manager.collect()

    const unmapped = decodeFrames(heapData).find((f) => f.name === 'allocateUnmapped')
    assert.ok(retained.length, 'should retain the allocations through collect')
    assert.ok(unmapped, 'should have sampled the transpiled allocation function')
    assert.ok(
      unmapped.file.endsWith('hot.js'),
      `frame should fall back to the compiled .js file, got ${unmapped.file}`
    )
  })
})
