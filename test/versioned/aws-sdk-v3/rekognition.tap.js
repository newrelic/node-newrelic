/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { afterEach, checkExternals } = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

test('RekognitionClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent()
    const { RekognitionClient, ...lib } = require('@aws-sdk/client-rekognition')
    ctx.nr.CompareFacesCommand = lib.CompareFacesCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new RekognitionClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('CompareFacesCommand', (t, end) => {
    const { service, agent, CompareFacesCommand } = t.nr
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
      setImmediate(checkExternals, {
        service: 'Rekognition',
        operations: ['CompareFacesCommand'],
        tx,
        end
      })
    })
  })
})
