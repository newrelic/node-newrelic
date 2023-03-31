/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const { registerInstrumentation } = require('../common')
const https = require('https')

tap.test('@aws-sdk/s3-request-presigner functionality', (t) => {
  t.autoend()

  let helperAgent
  let client
  let GetObjectCommand
  let getSignedUrl

  t.beforeEach(() => {
    helperAgent = utils.TestAgent.makeInstrumented()
    registerInstrumentation(helperAgent)

    const { S3, ...lib } = require('@aws-sdk/client-s3')
    client = new S3({ region: 'us-east-2' })
    GetObjectCommand = lib.GetObjectCommand

    const requestPresigner = require('@aws-sdk/s3-request-presigner')
    getSignedUrl = requestPresigner.getSignedUrl
  })

  t.afterEach(() => {
    helperAgent && helperAgent.unload()
  })

  t.test('GetObjectCommand', (t) => {
    helperAgent.runInTransaction(async () => {
      const command = new GetObjectCommand({
        Bucket: 'node-agent-aws-smoke-tests',
        Key: 'test-file.json'
      })

      // VERY IMPORTANT: DO NOT LOG THIS OUT IN CI, ANYONE WITH ACCESS TO THE URL GETS ACCESS TO THE OBJECT
      const url = await getSignedUrl(client, command, { expiresIn: 2 })

      https
        .get(url, (res) => {
          const { statusCode } = res

          t.equal(statusCode, 200, 'should successfully access the object using the presigned url')

          let buff = ''
          res.on('data', (chunk) => {
            buff = buff + chunk.toString()
          })

          res.on('end', () => {
            const body = JSON.parse(buff)

            t.same(
              body,
              { items: [{ name: 'Item 1' }, { name: 'Item 2' }] },
              'should successfully fetch the object using the presigned url'
            )
            t.end()
          })
        })
        .on('error', () => {
          throw new Error('Fetching object using presigned url failed, debug locally')
        })
    })
  })
})
