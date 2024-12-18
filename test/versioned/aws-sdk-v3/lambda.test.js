/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const assert = require('node:assert')
const {
  afterEach,
  checkExternals,
  checkAWSAttributes,
  EXTERN_PATTERN,
  SEGMENT_DESTINATION
} = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')

function checkEntityLinkingSegments({ service, operations, tx, end }) {
  const root = tx.trace.root

  const segments = checkAWSAttributes(root, EXTERN_PATTERN)
  const accountId = tx.agent.config.cloud.aws.account_id
  const testFunctionName = 'funcName'

  assert(segments.length > 0, 'should have segments')
  assert.ok(accountId, 'account id should be set on agent config')

  segments.forEach((segment) => {
    const attrs = segment.attributes.get(SEGMENT_DESTINATION)

    // match is passing even though cloud resource isn't defined
    match(attrs, {
      'hostname': String,
      'port': Number,
      'product': service,
      'aws.operation': operations[0],
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': 'Lambda',
      'cloud.resource_id': `arn:aws:lambda:${attrs['aws.region']}:${accountId}:function:${testFunctionName}`,
      'cloud.platform': `aws_lambda`
    })

    // this does fail:
    assert.ok(attrs['cloud.resource_id'], 'cloud.resource_id should be set on Lambda segments')
    assert.ok(attrs['cloud.platform'], 'cloud.platform should be set on Lambda segments')
  })
  end()
}

test('LambdaClient', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()
    await new Promise((resolve) => {
      server.listen(0, resolve)
    })
    ctx.nr.server = server
    ctx.nr.agent = helper.instrumentMockedAgent({
      cloud: {
        aws: {
          account_id: 123456789123
        }
      }
    })
    const { LambdaClient, ...lib } = require('@aws-sdk/client-lambda')
    ctx.nr.AddLayerVersionPermissionCommand = lib.AddLayerVersionPermissionCommand
    ctx.nr.InvokeCommand = lib.InvokeCommand
    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.service = new LambdaClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })
  })

  t.afterEach(afterEach)

  await t.test('AddLayerVersionPermissionCommand', (t, end) => {
    const { service, agent, AddLayerVersionPermissionCommand } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new AddLayerVersionPermissionCommand({
        Action: 'lambda:GetLayerVersion' /* required */,
        LayerName: 'STRING_VALUE' /* required */,
        Principal: '*' /* required */,
        StatementId: 'STRING_VALUE' /* required */,
        VersionNumber: 2 /* required */,
        OrganizationId: 'o-0123456789',
        RevisionId: 'STRING_VALUE'
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkExternals, {
        service: 'Lambda',
        operations: ['AddLayerVersionPermissionCommand'],
        tx,
        end
      })
    })
  })

  await t.test('InvokeCommand', (t, end) => {
    const { service, agent, InvokeCommand } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const cmd = new InvokeCommand({
        FunctionName: 'funcName',
        Payload: JSON.stringify({ prop1: 'test', prop2: 'test 2' })
      })
      await service.send(cmd)
      tx.end()
      setImmediate(checkEntityLinkingSegments, {
        service: 'Lambda',
        operations: ['InvokeCommand'],
        tx,
        end
      })
    })
  })
})
