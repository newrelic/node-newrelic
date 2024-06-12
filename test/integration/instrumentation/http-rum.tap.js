/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const http = require('http')
const helper = require('../../lib/agent_helper.js')
const API = require('../../../api.js')
const StreamSink = require('../../../lib/util/stream-sink.js')
const hashes = require('../../../lib/util/hashes.js')

const DATA_PREFIX = 'NREUM.info = '

test('custom naming rules should be applied early for RUM', function (t) {
  t.plan(3)

  const conf = {
    rules: {
      name: [{ pattern: '/test', name: '/WORKING' }]
    },
    license_key: 'abc1234abc1234abc1234',
    browser_monitoring: {
      enable: true,
      debug: false
    }
  }

  const agent = helper.instrumentMockedAgent(conf)

  agent.config.application_id = 12345

  const api = new API(agent)

  // These can't be set at config time as they are server only options
  agent.config.browser_monitoring.browser_key = 1234
  agent.config.browser_monitoring.js_agent_loader = 'function () {}'

  const external = http.createServer((request, response) => {
    t.equal(
      agent.getTransaction().getName(),
      'NormalizedUri/WORKING',
      'name rules should be applied'
    )
    response.end(api.getBrowserTimingHeader())
  })

  external.listen(0, function () {
    const port = external.address().port

    http.request({ port: port, path: '/test' }, done).end()

    function done(res) {
      res.pipe(
        new StreamSink(function (err, header) {
          t.equal(header.substring(0, 7), '<script', 'should generate RUM headers')
          header.split(';').forEach(function (element) {
            if (element.substring(0, DATA_PREFIX.length) === DATA_PREFIX) {
              const dataString = element.substring(DATA_PREFIX.length, element.length)
              const data = JSON.parse(dataString)
              const tx = hashes.deobfuscateNameUsingKey(
                data.transactionName,
                agent.config.license_key.substring(0, 13)
              )
              t.equal(tx, 'WebTransaction/NormalizedUri/WORKING', 'should normalize url before RUM')
            }
          })
          t.end()
        })
      )
    }
  })

  t.teardown(function () {
    external.close()
    helper.unloadAgent(agent)
  })
})

test('custom web transactions should have rules applied for RUM', function (t) {
  t.plan(2)

  const conf = {
    rules: {
      name: [{ pattern: '/test', name: '/WORKING' }]
    },
    license_key: 'abc1234abc1234abc1234',
    browser_monitoring: {
      enable: true,
      debug: false
    }
  }

  const agent = helper.instrumentMockedAgent(conf)

  agent.config.application_id = 12345

  const api = new API(agent)

  // These can't be set at config time as they are server only options
  agent.config.browser_monitoring.browser_key = 1234
  agent.config.browser_monitoring.js_agent_loader = 'function () {}'

  api.startWebTransaction('/test', function () {
    const header = api.getBrowserTimingHeader()
    t.equal(header.substring(0, 7), '<script', 'should generate RUM headers')
    header.split(';').forEach(function (element) {
      if (element.substring(0, DATA_PREFIX.length) === DATA_PREFIX) {
        const dataString = element.substring(DATA_PREFIX.length, element.length)
        const data = JSON.parse(dataString)
        const tx = hashes.deobfuscateNameUsingKey(
          data.transactionName,
          agent.config.license_key.substring(0, 13)
        )
        t.equal(tx, 'WebTransaction/NormalizedUri/WORKING', 'url normalized before RUM')
      }
    })
    t.end()
  })

  t.teardown(function () {
    helper.unloadAgent(agent)
  })
})
