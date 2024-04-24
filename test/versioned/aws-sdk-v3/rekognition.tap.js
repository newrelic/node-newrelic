/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('RekognitionClient', (t) => {
  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent()
    const { RekognitionClient, ...lib } = require('@aws-sdk/client-rekognition')
    t.context.CompareFacesCommand = lib.CompareFacesCommand
    const endpoint = `http://localhost:${server.address().port}`
    t.context.service = new RekognitionClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach((t) => {
    t.context.server.destroy()
    helper.unloadAgent(t.context.agent)
  })

  t.test('CompareFacesCommand', (t) => {
    const { service, agent, CompareFacesCommand } = t.context
    helper.runInTransaction(agent, async (tx) => {
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
      setImmediate(t.checkExternals, {
        service: 'Rekognition',
        operations: ['CompareFacesCommand'],
        tx
      })
    })
  })
  t.end()
})
