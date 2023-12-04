/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import { randomUUID } from 'node:crypto'
import helper from '../../lib/agent_helper.js'
import names from '../../../lib/metrics/names.js'
import { Sink } from './common.mjs'

const { LOGGING } = names

tap.beforeEach(async (t) => {
  t.context.test_id = randomUUID()
  t.context.agent = helper.instrumentMockedAgent()
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
})

tap.test('named import issues logs correctly', async (t) => {
  const sink = new Sink()
  const { agent } = t.context
  agent.config.application_logging.forwarding.enabled = true

  const { doLog } = await import('./fixtures/named-import.mjs?test=' + t.context.test_id)
  doLog(sink)
  t.equal(1, sink.loggedLines.length, 'log is written to the transport')

  const log = sink.loggedLines[0]
  const symbols = Object.getOwnPropertySymbols(log)
  // Instrumented logs should still be decorated internally by Winston with
  // a message symbol.
  t.equal(
    true,
    symbols.some((s) => s.toString() === 'Symbol(message)'),
    'log object has winston internal symbol'
  )

  const agentLogs = agent.logs.getEvents()
  t.equal(
    true,
    agentLogs.some((l) => {
      return l?.message === 'import winston from winston'
    }),
    'log gets added to agent logs'
  )

  const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
  t.equal(1, metric.callCount, 'winston log metric is recorded')
})

tap.test('alias import issues logs correctly', async (t) => {
  const sink = new Sink()
  const { agent } = t.context
  agent.config.application_logging.forwarding.enabled = true

  const { doLog } = await import('./fixtures/star-import.mjs?test=' + t.context.test_id)
  doLog(sink)
  t.equal(1, sink.loggedLines.length, 'log is written to the transport')

  const log = sink.loggedLines[0]
  const symbols = Object.getOwnPropertySymbols(log)
  // Instrumented logs should still be decorated internally by Winston with
  // a message symbol.
  t.equal(
    true,
    symbols.some((s) => s.toString() === 'Symbol(message)'),
    'log object has winston internal symbol'
  )

  const agentLogs = agent.logs.getEvents()
  t.equal(
    true,
    agentLogs.some((l) => {
      return l?.message === 'import * as winston from winston'
    }),
    'log gets added to agent logs'
  )

  const metric = agent.metrics.getMetric(LOGGING.LIBS.WINSTON)
  t.equal(1, metric.callCount, 'winston log metric is recorded')
})
