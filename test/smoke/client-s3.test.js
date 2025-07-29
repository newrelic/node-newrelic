/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../lib/agent_helper')
const {
  DESTINATIONS: { TRANS_SEGMENT }
} = require('../../lib/config/attribute-filter')

test('@aws-sdk/client-s3 functionality', async (t) => {
  const { version, name } = require('@aws-sdk/client-s3/package')

  console.log(`AWS package: ${name} version: ${version}`)
  const agent = helper.instrumentMockedAgent()
  const { S3, ...lib } = require('@aws-sdk/client-s3')
  const client = new S3({ region: 'us-east-2' })
  const { GetObjectCommand } = lib

  t.after(() => {
    helper.unloadAgent(agent)
  })

  await helper.runInTransaction(agent, async (transaction) => {
    const command = new GetObjectCommand({
      Bucket: 'node-agent-aws-smoke-tests',
      Key: 'test-file.json'
    })

    const { Body } = await client.send(command)
    const fileContents = JSON.parse(await Body.transformToString())

    assert.deepEqual(
      fileContents,
      { items: [{ name: 'Item 1' }, { name: 'Item 2' }] },
      'should successfully fetch test-file.json from S3'
    )

    transaction.end()

    const [child] = transaction.trace.getChildren(transaction.trace.root.id)
    const { url, procedure, ...awsAttributes } = child.attributes.get(TRANS_SEGMENT)

    delete awsAttributes.nr_exclusive_duration_millis

    assert.equal(
      url,
      'http://node-agent-aws-smoke-tests.s3.us-east-2.amazonaws.com/test-file.json',
      'should have url attribute in segment'
    )
    assert.equal(procedure, 'GET', 'should have method attribute in segment')
    assert.deepEqual(
      awsAttributes,
      {
        'aws.operation': 'GetObjectCommand',
        'aws.requestId': 'Unknown',
        'aws.service': 'S3',
        'aws.region': 'us-east-2'
      },
      'should have the proper AWS attributes in segment'
    )
  })
})
