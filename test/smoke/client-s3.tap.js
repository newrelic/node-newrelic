/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../lib/agent_helper')
const {
  DESTINATIONS: { TRANS_SEGMENT }
} = require('../../lib/config/attribute-filter')

tap.test('@aws-sdk/client-s3 functionality', (t) => {
  t.before(() => {
    const { version, name } = require('@aws-sdk/client-s3/package')
    // eslint-disable-next-line no-console
    console.log(`AWS package: ${name} version: ${version}`)
  })

  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent()
    const { S3, ...lib } = require('@aws-sdk/client-s3')
    t.context.client = new S3({ region: 'us-east-2' })
    t.context.GetObjectCommand = lib.GetObjectCommand
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
  })

  t.test('GetObjectCommand', (t) => {
    const { agent, client, GetObjectCommand } = t.context
    helper.runInTransaction(agent, async (transaction) => {
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
        transaction.trace.root.children[1].attributes.get(TRANS_SEGMENT)

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
  t.end()
})
