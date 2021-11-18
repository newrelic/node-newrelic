/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('../common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../aws-server-stubs')

tap.test('RekognitionClient', (t) => {
  t.autoend()
  let helper = null
  let server = null
  let service = null
  let CompareFacesCommand = null

  t.beforeEach(async () => {
    server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    helper = utils.TestAgent.makeInstrumented()
    common.registerCoreInstrumentation(helper)
    const { RekognitionClient, ...lib } = require('@aws-sdk/client-rekognition')
    CompareFacesCommand = lib.CompareFacesCommand
    const endpoint = `http://localhost:${server.address().port}`
    service = new RekognitionClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(() => {
    server.destroy()
    helper && helper.unload()
  })

  t.test('CompareFacesCommand', (t) => {
    helper.runInTransaction(async (tx) => {
      const cmd = new CompareFacesCommand({
        SimilarityThreshold: 90,
        SourceImage: {
          S3Object: {
            Bucket: 'mybucket',
            Name: 'mysourceimage'
          }
        },
        TargetImage: {
          S3Object: {
            Bucket: 'mybucket',
            Name: 'mytargetimage'
          }
        }
      })
      await service.send(cmd)
      tx.end()
      setImmediate(common.checkExternals, {
        t,
        service: 'Rekognition',
        operations: ['CompareFacesCommand'],
        tx
      })
    })
  })
})
