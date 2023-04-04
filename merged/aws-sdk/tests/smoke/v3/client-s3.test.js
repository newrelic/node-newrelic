/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const { registerInstrumentation } = require('../common')

const SEGMENT_DESTINATION = 0x20

tap.test('@aws-sdk/client-s3 functionality', (t) => {
  t.autoend()

  let helperAgent
  let client
  let GetObjectCommand

  t.beforeEach(() => {
    helperAgent = utils.TestAgent.makeInstrumented()
    registerInstrumentation(helperAgent)

    const { S3, ...lib } = require('@aws-sdk/client-s3')
    client = new S3({ region: 'us-east-2' })
    GetObjectCommand = lib.GetObjectCommand
  })

  t.afterEach(() => {
    helperAgent && helperAgent.unload()
  })

  t.test('GetObjectCommand', (t) => {
    helperAgent.runInTransaction(async (transaction) => {
      const command = new GetObjectCommand({
        Bucket: 'node-agent-aws-smoke-tests',
        Key: 'test-file.json'
      })

      const { Body } = await client.send(command)
      const fileContents = JSON.parse(await Body.transformToString())

      t.same(
        fileContents,
        { items: [{ name: 'Item 1' }, { name: 'Item 2' }] },
        'should successfully fetch test-file.json from S3'
      )

      transaction.end()

      const { url, procedure, ...awsAttributes } =
        transaction.trace.root.children[0].attributes.get(SEGMENT_DESTINATION)

      delete awsAttributes.nr_exclusive_duration_millis

      t.equal(
        url,
        'http://node-agent-aws-smoke-tests.s3.us-east-2.amazonaws.com/test-file.json',
        'should have url attribute in segment'
      )
      t.equal(procedure, 'GET', 'should have method attribute in segment')
      t.same(
        awsAttributes,
        {
          'aws.operation': 'GetObjectCommand',
          'aws.requestId': 'Unknown',
          'aws.service': 'S3',
          'aws.region': 'us-east-2'
        },
        'should have the proper AWS attributes in segment'
      )

      t.end()
    })
  })
})
