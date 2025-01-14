/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const common = require('./common')
const helper = require('../../lib/agent_helper')
const { match } = require('../../lib/custom-assertions')

test('Redshift-data', async (t) => {
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

    const { RedshiftDataClient, ListSchemasCommand } = require('@aws-sdk/client-redshift-data')

    ctx.nr.redshiftCommands = {
      ListSchemasCommand: ListSchemasCommand
    }

    const endpoint = `http://localhost:${server.address().port}`
    ctx.nr.client = new RedshiftDataClient({
      credentials: FAKE_CREDENTIALS,
      endpoint,
      region: 'us-east-1'
    })

    ctx.nr.tests = createTests()
  })

  t.afterEach(common.afterEach)

  await t.test('client commands', (t, end) => {
    const { redshiftCommands, client, agent, tests } = t.nr
    helper.runInTransaction(agent, async function (tx) {
      for (const test of tests) {
        const CommandClass = redshiftCommands[test.command];
        const command = new CommandClass(test.params);
        await client.send(command);
      }

      tx.end()

      const args = [end, tests, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(end, tests, tx) {
  const root = tx.trace.root
  const segments = common.checkAWSAttributes(root, common.DATASTORE_PATTERN)

  assert.equal(segments.length, tests.length, `should have ${tests.length} aws datastore segments`)

  const externalSegments = common.checkAWSAttributes(root, common.EXTERN_PATTERN)
  assert.equal(externalSegments.length, 0, 'should not have any External segments')

  // const accountId = tx.agent.config.cloud.aws.account_id

  segments.forEach((segment, i) => {
    const operation = tests[i].operation
    assert.equal(
      segment.name,
      `Datastore/operation/Redshift/${operation}`,
      'should have operation in segment name'
    )
    const attrs = segment.attributes.get(common.SEGMENT_DESTINATION)
    attrs.port_path_or_id = parseInt(attrs.port_path_or_id, 10)
    match(attrs, {
      host: String,
      port_path_or_id: Number,
      product: 'Redshift',
      // database_name: 'dev',
      collection: String,
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.region': 'us-east-1',
      'aws.service': 'Redshift Data',
    })
  })

  end()
}

function createTests() {
  const listSchemas = getListSchemas()

  return [
    { params: listSchemas, operation: 'ListSchemasCommand', command: 'ListSchemasCommand'},
  ]
}

function getListSchemas() {
  return {
      Database: 'dev',
      DbUser: 'a_user',
      ClusterIdentifier: 'a_cluster'
    }
}