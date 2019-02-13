'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')


tap.test('AWS HTTP Services', (t) => {
  t.autoend()

  let helper = null
  let AWS = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })
    AWS = require('aws-sdk')
    AWS.config.update({region: 'us-east-1'})
    done()
  })

  t.afterEach((done) => {
    helper && helper.unload()
    done()
  })

  t.test('APIGateway', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.APIGateway()
      service.createApiKey({
        customerId: 'STRING_VALUE',
        description: 'STRING_VALUE',
        enabled: true || false,
        generateDistinctId: true || false,
        name: 'STRING_VALUE',
        stageKeys: [
          {
            restApiId: 'STRING_VALUE',
            stageName: 'STRING_VALUE'
          }
        ],
        value: 'STRING_VALUE'
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'API Gateway', 'createApiKey', tx)
      })
    })
  })

  t.test('ELB', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.ELB()
      service.addTags({
        LoadBalancerNames: [
          'my-load-balancer'
        ],
        Tags: [{
          Key: 'project',
          Value: 'lima'
        }, {
          Key: 'department',
          Value: 'digital-media'
        }]
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'Elastic Load Balancing', 'addTags', tx)
      })
    })
  })

  t.test('ElastiCache', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.ElastiCache()
      service.addTagsToResource({
        ResourceName: 'STRING_VALUE', /* required */
        Tags: [ /* required */
          {
            Key: 'STRING_VALUE',
            Value: 'STRING_VALUE'
          }
        ]
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'ElastiCache', 'addTagsToResource', tx)
      })
    })
  })

  t.test('Lambda', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.Lambda()
      service.addLayerVersionPermission({
        Action: 'lambda:GetLayerVersion', /* required */
        LayerName: 'STRING_VALUE', /* required */
        Principal: '*', /* required */
        StatementId: 'STRING_VALUE', /* required */
        VersionNumber: 2, /* required */
        OrganizationId: 'o-0123456789',
        RevisionId: 'STRING_VALUE'
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'Lambda', 'addLayerVersionPermission', tx)
      })
    })
  })

  t.test('RDS', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.RDS()
      service.addRoleToDBCluster({
        DBClusterIdentifier: 'STRING_VALUE', /* required */
        RoleArn: 'arn:aws:iam::123456789012:role/AuroraAccessRole' /* required */
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'Amazon RDS', 'addRoleToDBCluster', tx)
      })
    })
  })

  t.test('Redshift', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.Redshift()
      service.acceptReservedNodeExchange({
        ReservedNodeId: 'STRING_VALUE', /* required */
        TargetReservedNodeOfferingId: 'STRING_VALUE' /* required */
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'Redshift', 'acceptReservedNodeExchange', tx)
      })
    })
  })

  t.test('Rekognition', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.Rekognition()
      service.compareFaces({
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
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'Rekognition', 'compareFaces', tx)
      })
    })
  })

  t.test('SES', (t) => {
    helper.runInTransaction((tx) => {
      const service = new AWS.SES()
      service.cloneReceiptRuleSet({
        OriginalRuleSetName: 'RuleSetToClone',
        RuleSetName: 'RuleSetToCreate'
      }, (err) => {
        t.matches(err, {name: 'AccessDenied'}, 'should have a permissions error')
        tx.end()
        setImmediate(finish, t, 'Amazon SES', 'cloneReceiptRuleSet', tx)
      })
    })
  })
})

function finish(t, service, operation, tx) {
  const externals = common.checkAWSAttributes(t, tx.trace.root, common.EXTERN_PATTERN)
  if (t.equal(externals.length, 1, 'should have an aws external')) {
    const attrs = externals[0].attributes.get(common.SEGMENT_DESTINATION)
    t.matches(attrs, {
      'aws.operation': operation,
      'aws.requestId': String,
      'aws.service': service,
      'aws.region': 'us-east-1'
    }, 'should have expected attributes')
  }

  t.end()
}
