/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const url = require('node:url')
const tspl = require('@matteo.collina/tspl')

const API = require('../../../api')
const helper = require('../../lib/agent_helper')

const ACCOUNT_ID = '1337'
const APP_ID = '7331'
const EXPECTED_DT_METRICS = ['DurationByCaller', 'TransportDuration']
const EXTERNAL_METRIC_SUFFIXES = ['all', 'http']
const symbols = require('../../../lib/symbols')

let compareSampled = null

test('distributed tracing full integration', async (t) => {
  const plan = tspl(t, { plan: 79 })

  const config = {
    distributed_tracing: {
      enabled: true
    },
    cross_application_tracer: { enabled: false },
    encoding_key: 'some key'
  }
  const agent = helper.instrumentMockedAgent(config)
  agent.config.primary_application_id = APP_ID
  agent.config.account_id = ACCOUNT_ID
  agent.config.trusted_account_key = ACCOUNT_ID

  // require http after creating the agent
  const http = require('http')
  const api = new API(agent)

  let firstExternalId
  let secondExternalId

  let serversToStart = 3
  function started() {
    serversToStart -= 1
    if (serversToStart === 0) {
      runTest()
    }
  }

  // eslint-disable-next-line prefer-const
  let MIDDLE_PORT
  // eslint-disable-next-line prefer-const
  let END_PORT

  // Naming is how the requests will flow through the system, to test that all
  // metrics are generated as expected as well as the dirac events.
  const start = generateServer(http, api, started, (req, res) => {
    const tx = agent.tracer.getTransaction()
    tx.nameState.appendPath('foobar')
    http.get(generateUrl(MIDDLE_PORT, 'start/middle'), (externRes) => {
      firstExternalId = agent.tracer.getSegment().id
      externRes.resume()
      externRes.on('end', () => {
        tx.nameState.popPath('foobar')
        res.end()
      })
    })
  })

  const START_PORT = start.address().port

  const middle = generateServer(http, api, started, (req, res) => {
    plan.ok(req.headers.newrelic, 'middle received newrelic from start')

    const tx = agent.tracer.getTransaction()
    tx.nameState.appendPath('foobar')
    http.get(generateUrl(END_PORT, 'middle/end'), (externRes) => {
      secondExternalId = agent.tracer.getSegment().id
      externRes.resume()
      externRes.on('end', () => {
        tx.nameState.popPath('foobar')
        res.end()
      })
    })
  })

  MIDDLE_PORT = middle.address().port

  const end = generateServer(http, api, started, (req, res) => {
    plan.ok(req.headers.newrelic, 'end received newrelic from middle')
    res.end()
  })

  END_PORT = end.address().port

  t.after(() => {
    helper.unloadAgent(agent)
    start.close()
    middle.close()
    end.close()
  })

  const transInspector = [
    function endTest(trans, event) {
      // Check the unscoped metrics
      const unscoped = trans.metrics.unscoped

      EXPECTED_DT_METRICS.forEach((name) => {
        const metric = `${name}/App/${ACCOUNT_ID}/${APP_ID}/HTTP/all`
        plan.ok(unscoped[metric], `end generated a ${name} metric`)
        plan.ok(unscoped[`${metric}Web`], `end generated a ${name} (Web) metric`)
      })

      plan.equal(Object.keys(unscoped).length, 11, 'end should only have expected unscoped metrics')
      plan.equal(Object.keys(trans.metrics.scoped).length, 0, 'should have no scoped metrics')
      // check the intrinsic attributes
      validateIntrinsics(plan, trans.trace.intrinsics, 'end', 'trace')

      // check the insights event
      const intrinsic = event[0]

      compareSampled = currySampled(plan, {
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })

      validateIntrinsics(plan, intrinsic, 'end', 'event', secondExternalId)
    },
    function middleTest(trans, event) {
      // check the unscoped metrics
      const unscoped = trans.metrics.unscoped

      EXPECTED_DT_METRICS.forEach((name) => {
        const metric = `${name}/App/${ACCOUNT_ID}/${APP_ID}/HTTP/all`
        plan.ok(unscoped[metric], `middle generated a ${name} metric`)
        plan.ok(unscoped[`${metric}Web`], `middle generated a ${name} (Web) metric`)
      })

      const external = `External/localhost:${END_PORT}/`
      EXTERNAL_METRIC_SUFFIXES.forEach((suf) => {
        plan.ok(unscoped[external + suf], `middle generated expected External metric (/${suf})`)
      })

      plan.equal(
        Object.keys(unscoped).length,
        15,
        'middle should only have expected unscoped metrics'
      )

      // check the scoped metrics
      const scoped = trans.metrics.scoped
      const middleMetric = scoped['WebTransaction/Nodejs/GET//start/middle']
      plan.ok(middleMetric, 'middle generated a scoped metric block')
      plan.ok(middleMetric[external + 'http'], 'middle generated an External scoped metric')
      const scopedKeys = Object.keys(middleMetric)
      plan.equal(scopedKeys.length, 1, 'middle should only be the inbound and outbound request.')
      plan.deepStrictEqual(
        scopedKeys,
        [`External/localhost:${END_PORT}/http`],
        'should have expected scoped metric name'
      )

      // check the intrinsic attributes
      validateIntrinsics(plan, trans.trace.intrinsics, 'middle', 'trace')

      // check the insights event
      const intrinsic = event[0]

      compareSampled({
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })

      validateIntrinsics(plan, intrinsic, 'middle', 'event', firstExternalId)
    },
    function startTest(trans, event) {
      // check the unscoped metrics
      const unscoped = trans.metrics.unscoped

      const metric = 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all'
      plan.ok(unscoped[metric], 'start has expected DT unscoped metric')

      const external = `External/localhost:${MIDDLE_PORT}/`
      EXTERNAL_METRIC_SUFFIXES.forEach((suf) => {
        plan.ok(unscoped[external + suf], `start generated expected External metric (/${suf})`)
      })

      plan.equal(
        Object.keys(unscoped).length,
        13,
        'start should only have expected unscoped metrics'
      )
      // check the scoped metrics
      const scoped = trans.metrics.scoped
      const startMetric = scoped['WebTransaction/Nodejs/GET//start']
      plan.ok(startMetric, 'start generated a scoped metric block')
      plan.ok(startMetric[external + 'http'], 'start generated an External scoped metric')
      const scopedKeys = Object.keys(startMetric)
      plan.equal(scopedKeys.length, 1, 'start should only be the inbound and outbound request.')
      plan.deepStrictEqual(
        scopedKeys,
        [`External/localhost:${MIDDLE_PORT}/http`],
        'should have expected scoped metric name'
      )

      // check the intrinsic attributes
      validateIntrinsics(plan, trans.trace.intrinsics, 'start', 'trace')

      // check the insights event
      const intrinsic = event[0]

      compareSampled({
        sampled: intrinsic.sampled,
        priority: intrinsic.priority
      })

      validateIntrinsics(plan, intrinsic, 'start', 'event')
    }
  ]

  await plan.completed

  function runTest() {
    http.get(generateUrl(START_PORT, 'start'), (res) => {
      res.resume()
      start.close()
      middle.close()
      end.close()
    })
    let txCount = 0

    const testsToCheck = []
    agent.on('transactionFinished', (trans) => {
      const event = agent.transactionEventAggregator.getEvents().filter((evt) => {
        return evt[0].guid === trans.id
      })[0]
      testsToCheck.push(transInspector[txCount].bind(this, trans, event))
      if (++txCount === 3) {
        for (const testToCheck of testsToCheck) {
          testToCheck()
        }
      }
    })
  }
})

const createResponse = (req, res, body, bodyProperty) => {
  body[bodyProperty] = req.headers
  body = JSON.stringify(body)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.write(body)
  res.end()
}

test('distributed tracing', async (t) => {
  // simulation of the callback used by the async library, used by generateServer and close
  const cb = () => new Promise((resolve) => resolve())

  t.beforeEach(async (ctx) => {
    const agent = helper.instrumentMockedAgent({
      distributed_tracing: { enabled: true },
      cross_application_tracer: { enabled: true }
    })
    agent.config.primary_application_id = APP_ID
    agent.config.account_id = ACCOUNT_ID
    agent.config.trusted_account_key = ACCOUNT_ID
    agent.config.encoding_key = 'foobar'

    const http = require('http')
    const api = new API(agent)

    const getNextUrl = async (endpoint, bodyProperty, port, req, res) => {
      const tx = agent.tracer.getTransaction()
      tx.nameState.appendPath('foobar')

      return get(generateUrl(port, endpoint), (err, { body }) => {
        tx.nameState.popPath('foobar')
        createResponse(req, res, body, bodyProperty)
      })
    }

    const end = generateServer(http, api, cb, (req, res) => {
      return createResponse(req, res, {}, 'end')
    })
    const END_PORT = end.address().port
    const middle = generateServer(http, api, cb, (req, res) => {
      return getNextUrl('middle/end', 'middle', END_PORT, req, res)
    })
    const MIDDLE_PORT = middle.address().port
    const start = generateServer(http, api, cb, (req, res) => {
      return getNextUrl('start/middle', 'start', MIDDLE_PORT, req, res)
    })
    const START_PORT = start.address().port

    ctx.nr = { agent, start, START_PORT, middle, MIDDLE_PORT, end, END_PORT }
  })

  t.afterEach(async (ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    await Promise.all([ctx.nr.start.close(cb), ctx.nr.middle.close(cb), ctx.nr.end.close(cb)])
  })

  await t.test('should create tracing headers at each step', (t, end) => {
    const { agent, START_PORT } = t.nr
    helper.runInTransaction(agent, (tx) => {
      get(generateUrl(START_PORT, 'start'), (err, { body }) => {
        assert.ifError(err)

        assert.ok(body.start.newrelic, 'should have DT headers from the start')
        assert.ok(body.middle.newrelic, 'should continue trace to through next state')
        assert.ok(tx.isDistributedTrace, 'should mark transaction as distributed')

        end()
      })
    })
  })

  for (const header of [symbols.disableDT, 'x-new-relic-disable-dt']) {
    await t.test(`should be disabled by ${header.toString()}`, (t, end) => {
      const { agent, START_PORT } = t.nr
      helper.runInTransaction(agent, (tx) => {
        const OLD_HEADER = 'x-newrelic-transaction'
        const headers = { [header]: 'true' }
        get(generateUrl(START_PORT, 'start'), { headers }, (err, { body }) => {
          assert.ifError(err)
          assert.equal(body.start.newrelic, undefined, 'should not add DT header when disabled')
          assert.equal(body.start[OLD_HEADER], undefined, 'should not add old CAT header either')
          assert.ok(body.middle.newrelic, undefined, 'should not stop down-stream DT from working')

          assert.equal(
            tx.isDistributedTrace,
            undefined,
            'should not mark transaction as distributed'
          )

          end()
        })
      })
    })
  }
})

function generateServer(http, api, started, responseHandler) {
  const server = http.createServer((req, res) => {
    const tx = api.agent.getTransaction()
    tx.nameState.appendPath(req.url)
    req.resume()
    responseHandler(req, res)
  })
  server.listen(() => started())
  return server
}

function generateUrl(port, endpoint) {
  return 'http://localhost:' + port + '/' + endpoint
}

function currySampled(plan, a) {
  return (b) => {
    b = b || a
    plan.ok(
      a.sampled === b.sampled && a.priority === b.priority,
      'sampled values and priority persist across transactions'
    )
    a = b
    return b
  }
}

function validateIntrinsics(plan, intrinsic, reqName, type, parentSpanId) {
  reqName = reqName || 'start'
  type = type || 'event'

  plan.ok(intrinsic.guid, `${reqName} should have a guid on ${type}`)
  plan.ok(intrinsic.traceId, `${reqName} should have a traceId on ${type}`)
  plan.ok(intrinsic.sampled != null, `${reqName} should have a sampled boolean on ${type}`)
  plan.ok(intrinsic.priority, `${reqName} should have a priority on ${type}`)

  if (reqName === 'start') {
    plan.equal(intrinsic.parentId, undefined, `${reqName} should not have a parentId on ${type}`)
    return
  }

  if (type !== 'trace') {
    plan.ok(intrinsic.parentId, `${reqName} should have a parentId on ${type}`)
    plan.equal(
      intrinsic.parentSpanId,
      parentSpanId,
      `${reqName} should have a parentSpanId of ${parentSpanId} on ${type}`
    )
  }
  plan.ok(intrinsic['parent.app'], `${reqName} should have a parent app on ${type}`)
  plan.ok(intrinsic['parent.type'], `${reqName} should have a parent type on ${type}`)
  plan.ok(intrinsic['parent.account'], `${reqName} should have a parent account on ${type}`)
  plan.ok(
    intrinsic['parent.transportType'],
    `${reqName} should have a parent transportType on ${type}`
  )
  plan.ok(
    intrinsic['parent.transportDuration'],
    `${reqName} should have a parent transportDuration on ${type}`
  )
}

function get(uri, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = {}
  }
  Object.assign(options, url.parse(uri))

  require('http').get(options, (res) => {
    let body = ''
    res.on('data', (data) => (body += data.toString('utf8')))
    res.on('error', (err) => cb(err))
    res.on('end', () => {
      cb(null, { body: JSON.parse(body), reqHeaders: res.req.headers })
    })
  })
}
