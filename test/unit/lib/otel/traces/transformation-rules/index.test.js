/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const rules = require('#agentlib/otel/traces/transformation-rules/index.js')()

test('transformation rules module', async (t) => {
  await t.test('should export an array', () => {
    assert.ok(Array.isArray(rules), 'rules should be an array')
  })

  await t.test('files should follow numbering scheme by type', () => {
    const rulesDir = path.join(__dirname, '../../../../../../lib/otel/traces/transformation-rules')
    const files = fs.readdirSync(rulesDir)
      .filter((file) => /^\d{3}-.+\.json$/.test(file))
      .sort()

    // Numbering scheme:
    // - Server rules: 100-199 (fallback at 199)
    // - Consumer rules: 200-299 (fallback at 299)
    // - Client rules: 300-399 (fallback at 399)
    // - Producer rules: 400-499 (fallback at 499)
    // - Internal fallback: 999

    // Verify server rules (100-199)
    const serverFiles = files.filter((f) => f.startsWith('1'))
    assert.ok(serverFiles.every((f) => parseInt(f) >= 100 && parseInt(f) < 200),
      'server rules should be numbered 100-199')

    // Verify consumer rules (200-299)
    const consumerFiles = files.filter((f) => f.startsWith('2') && !f.startsWith('999'))
    assert.ok(consumerFiles.every((f) => parseInt(f) >= 200 && parseInt(f) < 300),
      'consumer rules should be numbered 200-299')

    // Verify client rules (300-399) - includes both DB and HTTP/RPC/Lambda clients
    const clientFiles = files.filter((f) => f.startsWith('3'))
    assert.ok(clientFiles.every((f) => parseInt(f) >= 300 && parseInt(f) < 400),
      'client rules should be numbered 300-399')

    // Verify producer rules (400-499)
    const producerFiles = files.filter((f) => f.startsWith('4'))
    assert.ok(producerFiles.every((f) => parseInt(f) >= 400 && parseInt(f) < 500),
      'producer rules should be numbered 400-499')

    // Verify final internal fallback rule (999)
    const fallbackFiles = files.filter((f) => f.startsWith('999'))
    assert.equal(fallbackFiles.length, 1, 'should have exactly one fallback rule at 999')
  })

  await t.test('fallback rules should be at X99 positions', () => {
    const rulesDir = path.join(__dirname, '../../../../../../lib/otel/traces/transformation-rules')
    const files = fs.readdirSync(rulesDir)
      .filter((file) => /^\d{3}-.+\.json$/.test(file))

    // Verify specific fallback positions
    const fallbackPositions = {
      '199-FallbackServer.json': 'server',
      '299-FallbackConsumer.json': 'consumer',
      '399-FallbackClient.json': 'external',
      '499-FallbackProducer.json': 'producer',
      '999-Fallback.json': 'internal'
    }

    for (const [filename, expectedType] of Object.entries(fallbackPositions)) {
      assert.ok(files.includes(filename), `${filename} should exist`)
      const rule = require(path.join(rulesDir, filename))
      assert.equal(rule.type, expectedType, `${filename} should be of type ${expectedType}`)
      assert.equal(rule.matcher.required_attribute_keys.length, 0, `${filename} should have no required attributes`)
    }
  })

  await t.test('should contain 33 rules', () => {
    assert.equal(rules.length, 33, 'should have exactly 33 rules')
  })

  await t.test('should load rules in correct order', () => {
    const expectedOrder = [
      'OtelHttpServer1_23',
      'OtelHttpServerNextjs1_20',
      'OtelHttpServer1_20',
      'OtelRpcServer1_20',
      'FallbackServer',
      'OtelMessagingConsumer1_30',
      'OtelMessagingConsumer1_24',
      'OtelMessagingConsumer1_17',
      'FallbackConsumer',
      'OtelDbClientRedis1_40',
      'OtelDbClientRedis1_24',
      'OtelDbClientMongo1_40',
      'OtelDbClientMongo1_24',
      'OtelDbClient1_40',
      'OtelDbClient1_24',
      'OtelDbClientRedis1_17',
      'OtelDbClientMongo1_17',
      'OtelDbClientDynamo1_40',
      'OtelDbClientDynamo1_17',
      'OtelDbClient1_17',
      'OtelDbClientPrisma1_40',
      'OtelHttpClient1_23',
      'OtelHttpClient1_17',
      'OtelRpcClient1_23',
      'OtelLambdaClient1_17',
      'OtelRpcClient1_17',
      'FallbackClient',
      'Producer_1_30',
      'Producer_1_24',
      'ProducerSQS_1_17',
      'Producer_1_17',
      'FallbackProducer',
      'Fallback'
    ]

    const actualOrder = rules.map((rule) => rule.name)
    assert.deepEqual(actualOrder, expectedOrder, 'rules should be in the correct order')
  })

  await t.test('should have valid rule structure', () => {
    rules.forEach((rule, index) => {
      assert.ok(rule.name, `rule at index ${index} should have a name`)
      assert.ok(rule.type, `rule at index ${index} should have a type`)
      assert.ok(rule.matcher, `rule at index ${index} should have a matcher`)
      assert.ok(Array.isArray(rule.matcher.required_span_kinds),
        `rule ${rule.name} should have required_span_kinds array`)
      assert.ok(Array.isArray(rule.matcher.required_attribute_keys),
        `rule ${rule.name} should have required_attribute_keys array`)
      assert.ok(Array.isArray(rule.attributes),
        `rule ${rule.name} should have attributes array`)
    })
  })

  await t.test('should have correct rule types', () => {
    const expectedTypes = {
      server: ['OtelHttpServer1_23', 'OtelHttpServerNextjs1_20', 'OtelHttpServer1_20', 'OtelRpcServer1_20', 'FallbackServer'],
      consumer: ['OtelMessagingConsumer1_30', 'OtelMessagingConsumer1_24', 'OtelMessagingConsumer1_17', 'FallbackConsumer'],
      db: [
        'OtelDbClientRedis1_40', 'OtelDbClientRedis1_24',
        'OtelDbClientMongo1_40', 'OtelDbClientMongo1_24',
        'OtelDbClient1_40', 'OtelDbClient1_24',
        'OtelDbClientRedis1_17', 'OtelDbClientMongo1_17',
        'OtelDbClientDynamo1_40', 'OtelDbClientDynamo1_17',
        'OtelDbClient1_17', 'OtelDbClientPrisma1_40'
      ],
      external: [
        'OtelHttpClient1_23', 'OtelHttpClient1_17',
        'OtelRpcClient1_23', 'OtelLambdaClient1_17',
        'OtelRpcClient1_17', 'FallbackClient'
      ],
      producer: ['Producer_1_30', 'Producer_1_24', 'ProducerSQS_1_17', 'Producer_1_17', 'FallbackProducer'],
      internal: ['Fallback']
    }

    for (const [type, expectedNames] of Object.entries(expectedTypes)) {
      const rulesOfType = rules.filter((rule) => rule.type === type)
      const namesOfType = rulesOfType.map((rule) => rule.name)
      assert.deepEqual(namesOfType, expectedNames, `should have correct rules for type ${type}`)
    }
  })

  await t.test('first rule should be OtelHttpServer1_23', () => {
    const firstRule = rules[0]
    assert.equal(firstRule.name, 'OtelHttpServer1_23')
    assert.equal(firstRule.type, 'server')
    assert.ok(firstRule.matcher.required_attribute_keys.includes('http.request.method'))
  })

  await t.test('last rule should be Fallback', () => {
    const lastRule = rules[rules.length - 1]
    assert.equal(lastRule.name, 'Fallback')
    assert.equal(lastRule.type, 'internal')
    assert.equal(lastRule.matcher.required_attribute_keys.length, 0)
  })

  await t.test('fallback rules should have no required attributes', () => {
    const fallbackRules = [
      'FallbackServer',
      'FallbackConsumer',
      'FallbackClient',
      'FallbackProducer',
      'Fallback'
    ]

    fallbackRules.forEach((fallbackName) => {
      const fallbackRule = rules.find((rule) => rule.name === fallbackName)
      assert.ok(fallbackRule, `${fallbackName} should exist`)
      assert.equal(fallbackRule.matcher.required_attribute_keys.length, 0, `${fallbackName} should have no required attribute keys`)
    })
  })

  await t.test('server rules should require server span kind', () => {
    const serverRules = rules.filter((rule) => rule.type === 'server')
    serverRules.forEach((rule) => {
      assert.ok(rule.matcher.required_span_kinds.includes('server'),
        `${rule.name} should require server span kind`)
    })
  })

  await t.test('consumer rules should require consumer span kind', () => {
    const consumerRules = rules.filter((rule) => rule.type === 'consumer')
    consumerRules.forEach((rule) => {
      assert.ok(rule.matcher.required_span_kinds.includes('consumer'),
        `${rule.name} should require consumer span kind`)
    })
  })

  await t.test('client rules should require client span kind', () => {
    const clientRules = rules.filter((rule) => ['db', 'external'].includes(rule.type))
    clientRules.forEach((rule) => {
      assert.ok(rule.matcher.required_span_kinds.includes('client'),
        `${rule.name} should require client span kind`)
    })
  })

  await t.test('producer rules should require producer span kind', () => {
    const producerRules = rules.filter((rule) => rule.type === 'producer')
    producerRules.forEach((rule) => {
      assert.ok(rule.matcher.required_span_kinds.includes('producer'),
        `${rule.name} should require producer span kind`)
    })
  })

  await t.test('internal rules should require internal span kind', () => {
    const internalRules = rules.filter((rule) => rule.type === 'internal')
    internalRules.forEach((rule) => {
      assert.ok(rule.matcher.required_span_kinds.includes('internal'),
        `${rule.name} should require internal span kind`)
    })
  })

  await t.test('specific rules should have expected matchers', () => {
    const otelHttpServer123 = rules.find((rule) => rule.name === 'OtelHttpServer1_23')
    assert.deepEqual(
      otelHttpServer123.matcher.required_attribute_keys,
      ['http.request.method'],
      'OtelHttpServer1_23 should require http.request.method'
    )

    const otelHttpServer120 = rules.find((rule) => rule.name === 'OtelHttpServer1_20')
    assert.deepEqual(
      otelHttpServer120.matcher.required_attribute_keys,
      ['http.method'],
      'OtelHttpServer1_20 should require http.method'
    )

    const otelDbClientMongo140 = rules.find((rule) => rule.name === 'OtelDbClientMongo1_40')
    assert.deepEqual(
      otelDbClientMongo140.matcher.required_attribute_keys,
      ['db.system.name', 'server.address', 'server.port'],
      'OtelDbClientMongo1_40 should require correct attributes'
    )
    assert.deepEqual(
      otelDbClientMongo140.matcher.attribute_conditions,
      { 'db.system.name': ['mongodb'] },
      'OtelDbClientMongo1_40 should have mongodb condition'
    )
  })

  await t.test('rules with attribute conditions should be properly configured', () => {
    const rulesWithConditions = rules.filter((rule) => rule.matcher.attribute_conditions)

    assert.ok(rulesWithConditions.length > 0, 'should have rules with attribute conditions')

    rulesWithConditions.forEach((rule) => {
      const conditions = rule.matcher.attribute_conditions
      for (const [key, values] of Object.entries(conditions)) {
        assert.ok(Array.isArray(values),
          `${rule.name} attribute condition for ${key} should be an array`)
        assert.ok(values.length > 0,
          `${rule.name} attribute condition for ${key} should not be empty`)
      }
    })
  })

  await t.test('transaction rules should have transaction configuration', () => {
    const transactionRules = rules.filter((rule) => ['server', 'consumer'].includes(rule.type))

    transactionRules.forEach((rule) => {
      assert.ok(rule.transaction, `${rule.name} should have transaction configuration`)
      assert.ok(rule.transaction.type, `${rule.name} should have transaction type`)
      assert.ok(rule.transaction.name, `${rule.name} should have transaction name configuration`)
    })
  })

  await t.test('segment rules should have segment configuration', () => {
    const segmentRules = rules.filter((rule) => ['db', 'external', 'producer'].includes(rule.type))

    segmentRules.forEach((rule) => {
      assert.ok(rule.segment, `${rule.name} should have segment configuration`)
      assert.ok(rule.segment.name, `${rule.name} should have segment name configuration`)
    })
  })

  await t.test('all rules should have unique names', () => {
    const names = rules.map((rule) => rule.name)
    const uniqueNames = new Set(names)
    assert.equal(names.length, uniqueNames.size, 'all rule names should be unique')
  })
})
