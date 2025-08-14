/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import semver from 'semver'

import helper from '../../lib/agent_helper.js'
import names from '../../../lib/metrics/names.js'
import { Sink } from './common.mjs'

const { LOGGING } = names
let pkgPath
if (import.meta.dirname) {
  pkgPath = path.join(import.meta.dirname, 'node_modules', 'winston', 'package.json')
} else {
  pkgPath = path.join(
    path.dirname(url.fileURLToPath(import.meta.url)),
    'node_modules',
    'winston',
    'package.json'
  )
}
const winstonPkg = JSON.parse(await fs.readFile(pkgPath))

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.testId = randomUUID()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('named import issues logs correctly', async (t) => {
  const sink = new Sink()
  const { agent, testId } = t.nr
  agent.config.application_logging.forwarding.enabled = true

  const { doLog } = await import('./fixtures/named-import.mjs?test=' + testId)
  doLog(sink)
  assert.equal(sink.loggedLines.length, 1, 'log is written to the transport')

  const log = sink.loggedLines[0]
  const symbols = Object.getOwnPropertySymbols(log)
  // Instrumented logs should still be decorated internally by Winston with
  // a message symbol.
  assert.equal(
    symbols.some((s) => s.toString() === 'Symbol(message)'),
    true,
    'log object has winston internal symbol'
  )

  const agentLogs = agent.logs.getEvents()
  assert.equal(
    agentLogs.some((l) => l?.message === 'import winston from winston'),
    true,
    'log gets added to agent logs'
  )

  const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
  assert.equal(1, metric.callCount, 'winston log metric is recorded')
})

test(
  'alias import issues logs correctly',
  { skip: semver.lt(winstonPkg.version, '3.4.0') },
  async (t) => {
    const sink = new Sink()
    const { agent, testId } = t.nr
    agent.config.application_logging.forwarding.enabled = true

    const { doLog } = await import('./fixtures/star-import.mjs?test=' + testId)
    doLog(sink)
    assert.equal(1, sink.loggedLines.length, 'log is written to the transport')

    const log = sink.loggedLines[0]
    const symbols = Object.getOwnPropertySymbols(log)
    // Instrumented logs should still be decorated internally by Winston with
    // a message symbol.
    assert.equal(
      true,
      symbols.some((s) => s.toString() === 'Symbol(message)'),
      'log object has winston internal symbol'
    )

    const agentLogs = agent.logs.getEvents()
    assert.equal(
      true,
      agentLogs.some((l) => l?.message === 'import * as winston from winston'),
      'log gets added to agent logs'
    )

    const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
    assert.equal(1, metric.callCount, 'winston log metric is recorded')
  }
)
