/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')
const shardPlan = require('../../versioned-runner/shard-plan')

test('planShards', async (t) => {
  await t.test('splits into contiguous chunks of at most shardSize', () => {
    const suites = ['a', 'b', 'c', 'd', 'e']
    const dirmap = shardPlan.planShards(suites, 2)
    assert.deepEqual(dirmap, {
      0: ['a', 'b'],
      1: ['c', 'd'],
      2: ['e']
    })
  })

  await t.test('covers every suite exactly once', () => {
    const suites = Array.from({ length: 13 }, (_, i) => `suite-${i}`)
    const dirmap = shardPlan.planShards(suites, 5)
    const assigned = Object.values(dirmap).flat()
    assert.equal(assigned.length, suites.length)
    assert.deepEqual([...assigned].sort(), [...suites].sort())
  })
})

test('orderSuites', async (t) => {
  const services = {
    zebra: ['redis'],
    apple: [],
    mango: ['mysql'],
    banana: [],
    cherry: ['pg']
  }
  const getServices = (dir) => services[dir]

  await t.test('puts docker-requiring suites first, each group alphabetical', () => {
    const ordered = shardPlan.orderSuites(Object.keys(services), getServices)
    assert.deepEqual(ordered, [
      // docker-requiring, alphabetical
      'cherry',
      'mango',
      'zebra',
      // docker-free, alphabetical
      'apple',
      'banana'
    ])
  })

  await t.test('preserves every suite exactly once', () => {
    const suites = Object.keys(services)
    const ordered = shardPlan.orderSuites(suites, getServices)
    assert.equal(ordered.length, suites.length)
    assert.deepEqual([...ordered].sort(), [...suites].sort())
  })

  await t.test('handles all-docker and all-docker-free inputs', () => {
    assert.deepEqual(shardPlan.orderSuites(['b', 'a'], () => []), ['a', 'b'])
    assert.deepEqual(shardPlan.orderSuites(['b', 'a'], () => ['redis']), ['a', 'b'])
  })
})

test('planServices', async (t) => {
  const dirmap = {
    0: ['redis', 'disabled-instrumentation'],
    1: ['kafkajs'],
    2: ['express', 'koa']
  }
  const services = {
    redis: ['redis'],
    'disabled-instrumentation': ['redis', 'mongodb_5'],
    kafkajs: ['kafka', 'zookeeper'],
    express: [],
    koa: []
  }
  const getServices = (dir) => services[dir]

  await t.test('unions and dedupes services within a shard', () => {
    const servicemap = shardPlan.planServices(dirmap, getServices)
    // redis appears in both suites of shard 0 -> deduped.
    assert.equal(servicemap['0'], 'mongodb_5 redis')
  })

  await t.test('lists all services a shard needs, sorted', () => {
    const servicemap = shardPlan.planServices(dirmap, getServices)
    assert.equal(servicemap['1'], 'kafka zookeeper')
  })

  await t.test('emits empty string for a service-free shard', () => {
    const servicemap = shardPlan.planServices(dirmap, getServices)
    assert.equal(servicemap['2'], '')
  })
})

test('readServices', async (t) => {
  const known = shardPlan.knownServices()

  await t.test('reads a real suite declaration', () => {
    // kafkajs declares both kafka and zookeeper.
    assert.deepEqual(shardPlan.readServices('kafkajs', known), ['kafka', 'zookeeper'])
  })

  await t.test('returns empty for a suite that declares nothing', () => {
    // express is a pure HTTP framework; no dockerServices field.
    assert.deepEqual(shardPlan.readServices('express', known), [])
  })

  await t.test('throws on an unknown service name', () => {
    const known = new Set(['redis'])
    assert.throws(
      () => shardPlan.readServices('kafkajs', known),
      /declares unknown docker service/
    )
  })
})

test('knownServices', async (t) => {
  await t.test('reads the service names from docker-compose.yml', () => {
    const known = shardPlan.knownServices()
    // Spot-check a representative set; all must be present.
    for (const name of ['redis', 'mongodb_5', 'kafka', 'zookeeper', 'pg', 'pg_prisma', 'rmq']) {
      assert.ok(known.has(name), `expected known service "${name}"`)
    }
  })
})

test('main writes shards, dirmap, and servicemap to GITHUB_OUTPUT', () => {
  const outFile = path.join(os.tmpdir(), `shard-plan-out-${process.pid}`)
  fs.writeFileSync(outFile, '')
  const prevOutput = process.env.GITHUB_OUTPUT
  process.env.GITHUB_OUTPUT = outFile

  try {
    shardPlan.main()
  } finally {
    if (prevOutput === undefined) {
      delete process.env.GITHUB_OUTPUT
    } else {
      process.env.GITHUB_OUTPUT = prevOutput
    }
  }

  const written = fs.readFileSync(outFile, 'utf8')
  fs.rmSync(outFile, { force: true })

  assert.match(written, /^shards=\[/m)
  assert.match(written, /^dirmap=\{/m)
  assert.match(written, /^servicemap=\{/m)

  // The servicemap values must be valid JSON and every value a string.
  const servicemapLine = written.split('\n').find((l) => l.startsWith('servicemap='))
  const servicemap = JSON.parse(servicemapLine.slice('servicemap='.length))
  for (const value of Object.values(servicemap)) {
    assert.equal(typeof value, 'string')
  }
})
