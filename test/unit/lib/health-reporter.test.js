/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const fs = require('node:fs')
const tspl = require('@matteo.collina/tspl')

const { match } = require('#test/assert')
const Config = require('#agentlib/config/index.js')
const HealthReporter = require('#agentlib/health-reporter.js')

function simpleInterval(method) {
  method.call()
  return {
    unref() {}
  }
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.writeFileOrig = fs.writeFile
  ctx.nr.bigintOrig = process.hrtime.bigint

  let count = 0n
  process.hrtime.bigint = () => {
    count += 1n
    return count
  }

  const logs = {
    info: [],
    debug: [],
    error: [],
    warn: []
  }
  ctx.nr.logs = logs
  ctx.nr.logger = {
    info(...args) {
      logs.info.push(args)
    },
    debug(...args) {
      logs.debug.push(args)
    },
    error(...args) {
      logs.error.push(args)
    },
    warn(...args) {
      logs.warn.push(args)
    }
  }

  ctx.nr.agentConfig = Config.initialize({
    agent_control: {
      fleet_id: 42,
      health: {
        delivery_location: os.tmpdir(),
        frequency: 1
      }
    }
  })
})

test.afterEach((ctx) => {
  fs.writeFile = ctx.nr.writeFileOrig
  process.hrtime.bigint = ctx.nr.bigintOrig
})

test('requires fleet id to be set', (t) => {
  delete t.nr.agentConfig.agent_control.fleet_id

  const reporter = new HealthReporter(t.nr)
  assert.ok(reporter)

  const {
    logs: { info }
  } = t.nr
  assert.deepStrictEqual(info, [['new relic control not present, skipping health reporting']])
})

test('requires output directory to be set', (t) => {
  delete t.nr.agentConfig.agent_control.health.delivery_location

  const reporter = new HealthReporter(t.nr)
  assert.ok(reporter)

  const {
    logs: { info, error }
  } = t.nr
  assert.equal(info.length, 0, 'should not log any info messages')
  assert.deepStrictEqual(error, [
    ['health check output directory not provided, skipping health reporting']
  ])
})

test('sets default interval', (t) => {
  delete t.nr.agentConfig.agent_control.health.frequency

  const reporter = new HealthReporter(t.nr)
  assert.ok(reporter)

  const {
    logs: { info, error, debug }
  } = t.nr
  match(info, [
    [/new relic control is present, writing health on interval 5000 milliseconds to .+/],
    ['health reporter initialized']
  ])
  assert.equal(error.length, 0, 'should not log any errors')
  assert.deepStrictEqual(debug, [['health check interval not available, using default 5 seconds']])
})

test('initializes and writes to destination', async (t) => {
  const plan = tspl(t, { plan: 8 })
  fs.writeFile = (dest, data, options, callback) => {
    plan.match(dest, /health-\w{32}\.yaml/)
    plan.equal(
      data,
      [
        'healthy: true',
        "status: 'Healthy.'",
        'last_error: NR-APM-000',
        'start_time_unix_nano: 1',
        'status_time_unix_nano: 2'
      ].join('\n')
    )
    plan.deepStrictEqual(options, { encoding: 'utf8' })
    callback()
    plan.equal(t.nr.logs.error.length, 0, 'callback should not write error log')
  }

  const reporter = new HealthReporter({ ...t.nr, setInterval: localInterval })
  plan.ok(reporter)

  await plan.completed

  function localInterval(method, delay) {
    plan.equal(delay, 1_000)
    plan.equal(method.name, 'bound #healthCheck')
    method.call()
    return {
      unref() {
        plan.ok('invoked unref')
      }
    }
  }
})

test('logs error if writing failed', async (t) => {
  const plan = tspl(t, { plan: 3 })
  fs.writeFile = (dest, data, options, callback) => {
    callback(Error('boom'))
    plan.deepStrictEqual(t.nr.logs.error, [['error when writing out health status: boom']])
  }

  const reporter = new HealthReporter({ ...t.nr, setInterval: localInterval })
  plan.ok(reporter)

  await plan.completed

  function localInterval(method) {
    method.call()
    return {
      unref() {
        plan.ok('invoked unref')
      }
    }
  }
})

test('setStatus and stop do nothing if reporter disabled', (t, end) => {
  delete t.nr.agentConfig.agent_control.fleet_id
  fs.writeFile = () => {
    assert.fail('should not be invoked')
  }
  const reporter = new HealthReporter(t.nr)
  reporter.setStatus(HealthReporter.STATUS_AGENT_SHUTDOWN)
  reporter.stop(() => {
    assert.ok('stopped')
    end()
  })
})

test('setStatus warns for bad code', (t) => {
  const reporter = new HealthReporter(t.nr)
  reporter.setStatus('bad-code')
  assert.deepStrictEqual(t.nr.logs.warn, [['invalid health reporter status provided: bad-code']])
})

test('setStatus logs info message if shutdown and not healthy', (t) => {
  const reporter = new HealthReporter(t.nr)
  reporter.setStatus(HealthReporter.STATUS_BACKEND_ERROR)
  reporter.setStatus(HealthReporter.STATUS_AGENT_SHUTDOWN)
  assert.deepStrictEqual(t.nr.logs.info.pop(), [
    'not setting shutdown health status due to current status code: NR-APM-004'
  ])
})

test('stop leaves last error code in place', async (t) => {
  const plan = tspl(t, { plan: 3 })
  let invocation = 0
  fs.writeFile = (dest, data, options, callback) => {
    if (invocation === 0) {
      invocation += 1
      return callback()
    }

    plan.equal(
      data,
      [
        'healthy: false',
        "status: 'HTTP error communicating with New Relic.'",
        'last_error: NR-APM-004',
        'start_time_unix_nano: 1',
        'status_time_unix_nano: 3'
      ].join('\n')
    )
    callback()
  }

  const reporter = new HealthReporter({ ...t.nr, setInterval: simpleInterval })
  reporter.setStatus(HealthReporter.STATUS_BACKEND_ERROR)
  reporter.stop(() => {
    plan.deepStrictEqual(t.nr.logs.error, [])
  })
  plan.ok(reporter)

  await plan.completed
})

test('stop sets shutdown status', async (t) => {
  const plan = tspl(t, { plan: 3 })
  let invocation = 0
  fs.writeFile = (dest, data, options, callback) => {
    if (invocation === 0) {
      invocation += 1
      return callback()
    }

    plan.equal(
      data,
      [
        'healthy: true',
        "status: 'Agent has shutdown.'",
        'last_error: NR-APM-099',
        'start_time_unix_nano: 1',
        'status_time_unix_nano: 3'
      ].join('\n')
    )
    callback()
  }

  const reporter = new HealthReporter({ ...t.nr, setInterval: simpleInterval })
  reporter.stop(() => {
    plan.deepStrictEqual(t.nr.logs.error, [])
  })
  plan.ok(reporter)

  await plan.completed
})

test('stop logs writing error', async (t) => {
  const plan = tspl(t, { plan: 2 })
  let invocation = 0
  fs.writeFile = (dest, data, options, callback) => {
    if (invocation === 0) {
      invocation += 1
      return callback()
    }

    callback(Error('boom'))
  }

  const reporter = new HealthReporter({ ...t.nr, setInterval: simpleInterval })
  reporter.stop(() => {
    plan.deepStrictEqual(t.nr.logs.error, [
      ['error when writing out health status during shutdown: boom']
    ])
  })
  plan.ok(reporter)

  await plan.completed
})