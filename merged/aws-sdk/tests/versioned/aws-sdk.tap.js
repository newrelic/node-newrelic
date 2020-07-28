/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const sinon = require('sinon')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')
utils.assert.extendTap(tap)

const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('./aws-server-stubs')

tap.test('aws-sdk', (t) => {
  t.autoend()

  let helper = null
  let AWS = null

  let server = null
  let endpoint = null

  t.beforeEach((done) => {
    server = createEmptyResponseServer()
    server.listen(0, () => {
      helper = utils.TestAgent.makeInstrumented()
      helper.registerInstrumentation({
        moduleName: 'aws-sdk',
        type: 'conglomerate',
        onRequire: require('../../lib/instrumentation')
      })
      AWS = require('aws-sdk')
      AWS.config.update({region: 'us-east-1'})

      endpoint = `http://localhost:${server.address().port}`
      done()
    })
  })

  t.afterEach((done) => {
    server.close()
    server = null

    helper && helper.unload()
    AWS = null
    done()
  })

  t.test('should mark requests to be dt-disabled', {skip: true}, (t) => {
    // http because we've changed endpoint to be http
    const http = require('http')
    sinon.spy(http, 'request')
    t.tearDown(() => {
      // `afterEach` runs before `tearDown`, so the sinon spy may have already
      // been removed.
      if (http.request.restore) {
        http.request.restore()
      }
    })

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      credentials: FAKE_CREDENTIALS,
      endpoint: endpoint,
      // allows using generic endpoint, instead of needing a
      // bucket.endpoint server setup.
      s3ForcePathStyle: true,
      params: {Bucket: 'bucket'}
    })
    s3.listObjects({Delimiter: '/'}, (err) => {
      t.error(err)

      if (t.ok(http.request.calledOnce, 'should call http.request')) {
        const args = http.request.getCall(0).args
        const headers = args[0].headers
        const symbols = Object.getOwnPropertySymbols(headers).filter((s) => {
          return s.toString() === 'Symbol(Disable distributed tracing)'
        })
        t.equal(symbols.length, 1, 'should have disabled dt')
      }
      t.end()
    })
  })

  t.test('should maintain transaction state in promises', (t) => {
    const service = new AWS.SES({
      credentials: FAKE_CREDENTIALS,
      endpoint: endpoint
    })
    helper.runInTransaction((tx) => {
      service.cloneReceiptRuleSet({
        OriginalRuleSetName: 'RuleSetToClone',
        RuleSetName: 'RuleSetToCreate'
      }).promise().then(() => {
        t.transaction(tx)
        tx.end()
        ender()
      })
    })

    // Run two concurrent promises to check for conflation
    helper.runInTransaction((tx) => {
      service.cloneReceiptRuleSet({
        OriginalRuleSetName: 'RuleSetToClone',
        RuleSetName: 'RuleSetToCreate'
      }).promise().then(() => {
        t.transaction(tx)
        tx.end()
        ender()
      })
    })

    let count = 0
    function ender() {
      if (++count === 2) {
        t.end()
      }
    }
  })
})
