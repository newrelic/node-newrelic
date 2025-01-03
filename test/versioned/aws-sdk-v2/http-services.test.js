/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { match } = require('../../lib/custom-assertions')

test('AWS HTTP Services', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    ctx.nr.server = server

    ctx.nr.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    AWS.config.update({ region: 'us-east-1' })

    ctx.nr.endpoint = `http://localhost:${server.address().port}`
    ctx.nr.AWS = AWS
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('APIGateway', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.APIGateway({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.createApiKey(
        {
          customerId: 'STRING_VALUE',
          description: 'STRING_VALUE',
          enabled: true,
          generateDistinctId: true,
          name: 'STRING_VALUE',
          stageKeys: [
            {
              restApiId: 'STRING_VALUE',
              stageName: 'STRING_VALUE'
            }
          ],
          value: 'STRING_VALUE'
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'API Gateway', 'createApiKey', tx)
        }
      )
    })
  })

  await t.test('ELB', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.ELB({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.addTags(
        {
          LoadBalancerNames: ['my-load-balancer'],
          Tags: [
            {
              Key: 'project',
              Value: 'lima'
            },
            {
              Key: 'department',
              Value: 'digital-media'
            }
          ]
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'Elastic Load Balancing', 'addTags', tx)
        }
      )
    })
  })

  await t.test('ElastiCache', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.ElastiCache({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.addTagsToResource(
        {
          ResourceName: 'STRING_VALUE' /* required */,
          Tags: [
            /* required */
            {
              Key: 'STRING_VALUE',
              Value: 'STRING_VALUE'
            }
          ]
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'ElastiCache', 'addTagsToResource', tx)
        }
      )
    })
  })

  await t.test('Lambda', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.Lambda({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.addLayerVersionPermission(
        {
          Action: 'lambda:GetLayerVersion' /* required */,
          LayerName: 'STRING_VALUE' /* required */,
          Principal: '*' /* required */,
          StatementId: 'STRING_VALUE' /* required */,
          VersionNumber: 2 /* required */,
          OrganizationId: 'o-0123456789',
          RevisionId: 'STRING_VALUE'
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'Lambda', 'addLayerVersionPermission', tx)
        }
      )
    })
  })

  await t.test('RDS', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.RDS({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.addRoleToDBCluster(
        {
          DBClusterIdentifier: 'STRING_VALUE' /* required */,
          RoleArn: 'arn:aws:iam::123456789012:role/AuroraAccessRole' /* required */
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'Amazon RDS', 'addRoleToDBCluster', tx)
        }
      )
    })
  })

  await t.test('Redshift', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.Redshift({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.acceptReservedNodeExchange(
        {
          ReservedNodeId: 'STRING_VALUE' /* required */,
          TargetReservedNodeOfferingId: 'STRING_VALUE' /* required */
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'Redshift', 'acceptReservedNodeExchange', tx)
        }
      )
    })
  })

  await t.test('Rekognition', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.Rekognition({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.compareFaces(
        {
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
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'Rekognition', 'compareFaces', tx)
        }
      )
    })
  })

  await t.test('SES', (t, end) => {
    const { agent, endpoint, AWS } = t.nr
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.SES({
        credentials: FAKE_CREDENTIALS,
        endpoint
      })
      service.cloneReceiptRuleSet(
        {
          OriginalRuleSetName: 'RuleSetToClone',
          RuleSetName: 'RuleSetToCreate'
        },
        () => {
          tx.end()
          setImmediate(finish, end, 'Amazon SES', 'cloneReceiptRuleSet', tx)
        }
      )
    })
  })
})

function finish(end, service, operation, tx) {
  const externals = common.checkAWSAttributes(tx.trace.root, common.EXTERN_PATTERN)
  if (assert.equal(externals.length, 1, 'should have an aws external')) {
    const attrs = externals[0].attributes.get(common.SEGMENT_DESTINATION)
    match(attrs, {
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.service': service,
      'aws.region': 'us-east-1'
    })
  }

  end()
}
