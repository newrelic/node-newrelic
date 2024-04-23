/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('../aws-sdk-v3/common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')

tap.test('AWS HTTP Services', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const server = createEmptyResponseServer()

    await new Promise((resolve) => {
      server.listen(0, resolve)
    })

    t.context.server = server

    t.context.agent = helper.instrumentMockedAgent()
    const AWS = require('aws-sdk')
    AWS.config.update({ region: 'us-east-1' })

    t.context.endpoint = `http://localhost:${server.address().port}`
    t.context.AWS = AWS
  })

  t.afterEach((t) => {
    t.context.server.close()
    helper.unloadAgent(t.context.agent)
  })

  t.test('APIGateway', (t) => {
    const { agent, endpoint, AWS } = t.context
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
          setImmediate(finish, t, 'API Gateway', 'createApiKey', tx)
        }
      )
    })
  })

  t.test('ELB', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.ELB({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
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
          setImmediate(finish, t, 'Elastic Load Balancing', 'addTags', tx)
        }
      )
    })
  })

  t.test('ElastiCache', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.ElastiCache({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
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
          setImmediate(finish, t, 'ElastiCache', 'addTagsToResource', tx)
        }
      )
    })
  })

  t.test('Lambda', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.Lambda({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
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
          setImmediate(finish, t, 'Lambda', 'addLayerVersionPermission', tx)
        }
      )
    })
  })

  t.test('RDS', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.RDS({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
      })
      service.addRoleToDBCluster(
        {
          DBClusterIdentifier: 'STRING_VALUE' /* required */,
          RoleArn: 'arn:aws:iam::123456789012:role/AuroraAccessRole' /* required */
        },
        () => {
          tx.end()
          setImmediate(finish, t, 'Amazon RDS', 'addRoleToDBCluster', tx)
        }
      )
    })
  })

  t.test('Redshift', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.Redshift({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
      })
      service.acceptReservedNodeExchange(
        {
          ReservedNodeId: 'STRING_VALUE' /* required */,
          TargetReservedNodeOfferingId: 'STRING_VALUE' /* required */
        },
        () => {
          tx.end()
          setImmediate(finish, t, 'Redshift', 'acceptReservedNodeExchange', tx)
        }
      )
    })
  })

  t.test('Rekognition', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.Rekognition({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
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
          setImmediate(finish, t, 'Rekognition', 'compareFaces', tx)
        }
      )
    })
  })

  t.test('SES', (t) => {
    const { agent, endpoint, AWS } = t.context
    helper.runInTransaction(agent, (tx) => {
      const service = new AWS.SES({
        credentials: FAKE_CREDENTIALS,
        endpoint: endpoint
      })
      service.cloneReceiptRuleSet(
        {
          OriginalRuleSetName: 'RuleSetToClone',
          RuleSetName: 'RuleSetToCreate'
        },
        () => {
          tx.end()
          setImmediate(finish, t, 'Amazon SES', 'cloneReceiptRuleSet', tx)
        }
      )
    })
  })
})

function finish(t, service, operation, tx) {
  const externals = common.checkAWSAttributes(t, tx.trace.root, common.EXTERN_PATTERN)
  if (t.equal(externals.length, 1, 'should have an aws external')) {
    const attrs = externals[0].attributes.get(common.SEGMENT_DESTINATION)
    t.match(
      attrs,
      {
        'aws.operation': operation,
        'aws.requestId': String,
        'aws.service': service,
        'aws.region': 'us-east-1'
      },
      'should have expected attributes'
    )
  }

  t.end()
}
