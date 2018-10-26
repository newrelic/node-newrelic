'use strict'

const helper = require('../../lib/agent_helper')
const sinon = require('sinon')
const tap = require('tap')

const SYMBOLS = require('../../../lib/shim/constants').SYMBOLS

tap.test('aws-sdk', (t) => {
  t.autoend()

  let agent = null
  let AWS = null

  t.beforeEach((done) => {
    agent = helper.instrumentMockedAgent()
    AWS = require('aws-sdk')
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    AWS = null
    done()
  })

  t.test('should mark requests to be dt-disabled', (t) => {
    const https = require('https')
    sinon.spy(https, 'request')
    t.tearDown(() => {
      // `afterEach` runs before `tearDown`, so the sinon spy may have already
      // been removed.
      if (https.request.restore) {
        https.request.restore()
      }
    })

    AWS.config.update({
      region: 'region',
      credentials: new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'foobar'
      })
    })

    const s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      params: {Bucket: 'bucket'}
    })
    s3.listObjects({Delimiter: '/'}, () => {})

    if (t.ok(https.request.calledOnce, 'should call http.request')) {
      const args = https.request.getCall(0).args
      const headers = args[0].headers
      t.ok(headers[SYMBOLS.DISABLE_DT], 'should have disabled dt')
    }
    t.end()
  })
})
