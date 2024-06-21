/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../lib/agent_helper')
const API = require('../../api')

const hashes = require('../../lib/util/hashes')

tap.test('the RUM API', function (t) {
  t.autoend()
  t.beforeEach(function (t) {
    const agent = helper.loadMockedAgent({
      license_key: 'license key here',
      browser_monitoring: {
        attributes: {
          enabled: true,
          include: ['*']
        }
      }
    })
    agent.config.browser_monitoring.enable = true
    agent.config.browser_monitoring.debug = false
    agent.config.application_id = 12345
    agent.config.browser_monitoring.browser_key = 1234
    agent.config.browser_monitoring.js_agent_loader = 'function() {}'
    t.context.api = new API(agent)
    t.context.agent = agent
  })

  t.afterEach(function (t) {
    helper.unloadAgent(t.context.agent)
  })

  t.test('should not generate header when disabled', function (t) {
    const { agent, api } = t.context
    agent.config.browser_monitoring.enable = false
    t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (0) -->')
    t.end()
  })

  t.test('should issue a warning outside a transaction by default', function (t) {
    const { api } = t.context
    t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (1) -->')
    t.end()
  })

  t.test(
    'should issue a warning outside a transaction and allowTransactionlessInjection is false',
    function (t) {
      const { api } = t.context
      t.equal(
        api.getBrowserTimingHeader({ allowTransactionlessInjection: false }),
        '<!-- NREUM: (1) -->'
      )
      t.end()
    }
  )

  t.test('should issue a warning if the transaction was ignored', function (t) {
    const { agent, api } = t.context
    helper.runInTransaction(agent, function (tx) {
      tx.ignore = true
      t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (1) -->')
      t.end()
    })
  })

  t.test('should not generate header config is missing', function (t) {
    const { agent, api } = t.context
    agent.config.browser_monitoring = undefined
    t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (2) -->')
    t.end()
  })

  t.test('should issue a warning if transaction has no name', function (t) {
    const { agent, api } = t.context
    helper.runInTransaction(agent, function () {
      t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (3) -->')
      t.end()
    })
  })

  t.test('should issue a warning without an application_id', function (t) {
    const { agent, api } = t.context
    agent.config.application_id = undefined
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (4) -->')
      t.end()
    })
  })

  t.test('should return the rum headers when in a named transaction', function (t) {
    const { agent, api } = t.context
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      t.equal(api.getBrowserTimingHeader().indexOf('<script'), 0)
      t.end()
    })
  })

  t.test('should return pretty print when debugging', function (t) {
    const { agent, api } = t.context
    agent.config.browser_monitoring.debug = true
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      // there should be about 5 new lines here, this is a really *rough*
      // estimate if it's being pretty printed
      t.ok(api.getBrowserTimingHeader().split('\n').length > 5)
      t.end()
    })
  })

  t.test('should be compact when not debugging', function (t) {
    const { agent, api } = t.context
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      const l = api.getBrowserTimingHeader().split('\n').length
      t.equal(l, 1)
      t.end()
    })
  })

  t.test('should return empty headers when missing browser_key', function (t) {
    const { agent, api } = t.context
    agent.config.browser_monitoring.browser_key = undefined
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (5) -->')
      t.end()
    })
  })

  t.test('should return empty headers when missing js_agent_loader', function (t) {
    const { agent, api } = t.context
    agent.config.browser_monitoring.js_agent_loader = ''
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (6) -->')
      t.end()
    })
  })

  t.test('should be empty headers when loader is none', function (t) {
    const { agent, api } = t.context
    agent.config.browser_monitoring.loader = 'none'
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      t.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (7) -->')
      t.end()
    })
  })

  t.test('should get browser agent script with wrapping tag', function (t) {
    const { agent, api } = t.context
    helper.runInTransaction(agent, function (tx) {
      tx.finalizeNameFromUri('hello')
      const timingHeader = api.getBrowserTimingHeader()
      t.ok(
        timingHeader.startsWith(
          `<script type=\'text/javascript\'>window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,`
        )
      )
      t.ok(timingHeader.endsWith(`}; function() {}</script>`))
      t.end()
    })
  })

  t.test(
    'should get the browser agent script when outside a transaction and allowTransactionlessInjection is true',
    function (t) {
      const { api } = t.context
      const timingHeader = api.getBrowserTimingHeader({ allowTransactionlessInjection: true })
      t.ok(
        timingHeader.startsWith(
          `<script type=\'text/javascript\'>window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,`
        )
      )
      t.ok(timingHeader.endsWith(`}; function() {}</script>`))
      t.end()
    }
  )

  t.test(
    'should get browser agent script with wrapping tag and add nonce attribute to script if passed in options',
    function (t) {
      const { agent, api } = t.context
      helper.runInTransaction(agent, function (tx) {
        tx.finalizeNameFromUri('hello')
        const timingHeader = api.getBrowserTimingHeader({ nonce: '12345' })
        t.ok(
          timingHeader.startsWith(
            `<script type=\'text/javascript\' nonce="12345">window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,`
          )
        )
        t.ok(timingHeader.endsWith(`}; function() {}</script>`))
        t.end()
      })
    }
  )

  t.test(
    'should get browser agent script without wrapping tag if hasToRemoveScriptWrapper passed in options',
    function (t) {
      const { agent, api } = t.context
      helper.runInTransaction(agent, function (tx) {
        tx.finalizeNameFromUri('hello')
        const timingHeader = api.getBrowserTimingHeader({ hasToRemoveScriptWrapper: true })
        t.ok(
          timingHeader.startsWith(
            'window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,'
          )
        )
        t.ok(timingHeader.endsWith(`}; function() {}`))
        t.end()
      })
    }
  )

  t.test('should add custom attributes', function (t) {
    const { agent, api } = t.context
    helper.runInTransaction(agent, function (tx) {
      api.addCustomAttribute('hello', 1)
      tx.finalizeNameFromUri('hello')
      const payload = /"atts":"(.*)"/.exec(api.getBrowserTimingHeader())
      t.ok(payload)
      const deobf = hashes.deobfuscateNameUsingKey(
        payload[1],
        agent.config.license_key.substring(0, 13)
      )
      t.equal(JSON.parse(deobf).u.hello, 1)
      t.end()
    })
  })
})
