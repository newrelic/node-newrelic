/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../lib/agent_helper')
const API = require('../../api')

const hashes = require('../../lib/util/hashes')

test('the RUM API', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
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
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not generate header when disabled', function (t) {
    const { agent, api } = t.nr
    agent.config.browser_monitoring.enable = false
    assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (0) -->')
  })

  await t.test('should issue a warning outside a transaction by default', function (t) {
    const { api } = t.nr
    assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (1) -->')
  })

  await t.test(
    'should issue a warning outside a transaction and allowTransactionlessInjection is false',
    function (t) {
      const { api } = t.nr
      assert.equal(
        api.getBrowserTimingHeader({ allowTransactionlessInjection: false }),
        '<!-- NREUM: (1) -->'
      )
    }
  )

  await t.test('should issue a warning if the transaction was ignored', function (t, end) {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.ignore = true
      assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (1) -->')
      end()
    })
  })

  await t.test('should not generate header config is missing', function (t) {
    const { agent, api } = t.nr
    agent.config.browser_monitoring = undefined
    assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (2) -->')
  })

  await t.test('should issue a warning if transaction has no name', function (t, end) {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function () {
      assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (3) -->')
      end()
    })
  })

  await t.test('should issue a warning without an application_id', function (t, end) {
    const { agent, api } = t.nr
    agent.config.application_id = undefined
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (4) -->')
      end()
    })
  })

  await t.test('should return the rum headers when in a named transaction', function (t, end) {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      assert.equal(api.getBrowserTimingHeader().indexOf('<script'), 0)
      end()
    })
  })

  await t.test('should return pretty print when debugging', function (t, end) {
    const { agent, api } = t.nr
    agent.config.browser_monitoring.debug = true
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      // there should be about 5 new lines here, this is a really *rough*
      // estimate if it's being pretty printed
      assert.ok(api.getBrowserTimingHeader().split('\n').length > 5)
      end()
    })
  })

  await t.test('should be compact when not debugging', function (t, end) {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      const l = api.getBrowserTimingHeader().split('\n').length
      assert.equal(l, 1)
      end()
    })
  })

  await t.test('should return empty headers when missing browser_key', function (t, end) {
    const { agent, api } = t.nr
    agent.config.browser_monitoring.browser_key = undefined
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (5) -->')
      end()
    })
  })

  await t.test('should return empty headers when missing js_agent_loader', function (t, end) {
    const { agent, api } = t.nr
    agent.config.browser_monitoring.js_agent_loader = ''
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (6) -->')
      end()
    })
  })

  await t.test('should be empty headers when loader is none', function (t, end) {
    const { agent, api } = t.nr
    agent.config.browser_monitoring.loader = 'none'
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      assert.equal(api.getBrowserTimingHeader(), '<!-- NREUM: (7) -->')
      end()
    })
  })

  await t.test('should get browser agent script with wrapping tag', function (t, end) {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      const timingHeader = api.getBrowserTimingHeader()
      assert.ok(
        timingHeader.startsWith(
          '<script type=\'text/javascript\'>window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,'
        )
      )
      assert.ok(timingHeader.endsWith('}; function() {}</script>'))
      end()
    })
  })

  await t.test(
    'should get the browser agent script when outside a transaction and allowTransactionlessInjection is true',
    function (t) {
      const { api } = t.nr
      const timingHeader = api.getBrowserTimingHeader({ allowTransactionlessInjection: true })
      assert.ok(
        timingHeader.startsWith(
          '<script type=\'text/javascript\'>window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,'
        )
      )
      assert.ok(timingHeader.endsWith('}; function() {}</script>'))
    }
  )

  await t.test(
    'should get browser agent script with wrapping tag and add nonce attribute to script if passed in options',
    function (t, end) {
      const { agent, api } = t.nr
      helper.runInTransaction(agent, function (tx) {
        tx.url = '/hello'
        tx.finalizeNameFromWeb()
        const timingHeader = api.getBrowserTimingHeader({ nonce: '12345' })
        assert.ok(
          timingHeader.startsWith(
            '<script type=\'text/javascript\' nonce="12345">window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,'
          )
        )
        assert.ok(timingHeader.endsWith('}; function() {}</script>'))
        end()
      })
    }
  )

  await t.test(
    'should get browser agent script without wrapping tag if hasToRemoveScriptWrapper passed in options',
    function (t, end) {
      const { agent, api } = t.nr
      helper.runInTransaction(agent, function (tx) {
        tx.url = '/hello'
        tx.finalizeNameFromWeb()
        const timingHeader = api.getBrowserTimingHeader({ hasToRemoveScriptWrapper: true })
        assert.ok(
          timingHeader.startsWith(
            'window.NREUM||(NREUM={});NREUM.info = {"licenseKey":1234,"applicationID":12345,'
          )
        )
        assert.ok(timingHeader.endsWith('}; function() {}'))
        end()
      })
    }
  )

  await t.test('should add custom attributes', function (t, end) {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      api.addCustomAttribute('hello', 1)
      tx.url = '/hello'
      tx.finalizeNameFromWeb()
      const payload = /"atts":"(.*)"/.exec(api.getBrowserTimingHeader())
      assert.ok(payload)
      const deobf = hashes.deobfuscateNameUsingKey(
        payload[1],
        agent.config.license_key.substring(0, 13)
      )
      assert.equal(JSON.parse(deobf).u.hello, 1)
      end()
    })
  })
})
