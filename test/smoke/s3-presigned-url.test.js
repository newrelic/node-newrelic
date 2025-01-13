/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../lib/agent_helper')
const https = require('https')

test('@aws-sdk/s3-request-presigner functionality', (t, end) => {
  const { version, name } = require('@aws-sdk/s3-request-presigner/package')

  console.log(`AWS package: ${name} version: ${version}`)
  const agent = helper.instrumentMockedAgent()
  const { S3, ...lib } = require('@aws-sdk/client-s3')
  const client = new S3({ region: 'us-east-2' })
  const { GetObjectCommand } = lib
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  helper.runInTransaction(agent, async () => {
    const command = new GetObjectCommand({
      Bucket: 'node-agent-aws-smoke-tests',
      Key: 'test-file.json'
    })

    // VERY IMPORTANT: DO NOT LOG THIS OUT IN CI, ANYONE WITH ACCESS TO THE URL GETS ACCESS TO THE OBJECT
    const url = await getSignedUrl(client, command, { expiresIn: 2 })

    https
      .get(url, (res) => {
        const { statusCode } = res

        assert.equal(
          statusCode,
          200,
          'should successfully access the object using the presigned url'
        )

        let buff = ''
        res.on('data', (chunk) => {
          buff = buff + chunk.toString()
        })

        res.on('end', () => {
          const body = JSON.parse(buff)

          assert.deepEqual(
            body,
            { items: [{ name: 'Item 1' }, { name: 'Item 2' }] },
            'should successfully fetch the object using the presigned url'
          )
          end()
        })
      })
      .on('error', () => {
        throw new Error('Fetching object using presigned url failed, debug locally')
      })
  })
})
