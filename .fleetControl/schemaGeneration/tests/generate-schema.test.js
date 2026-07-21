/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const {
  arrayOrDelimitedString,
  indexJSDocComments,
  extractAllowListEnum,
  hasComputedDefault,
  inferFromLiteral,
  isLeafDefinition,
  makeProperty,
  isExcluded,
  instrumentationSchema,
  walk,
  generateSchema,
  validateMetaSchema
} = require('../generate-schema')

const formatters = require('../../../lib/config/formatters')

/**
 * @param {object} [overrides] fields to override on the default test context
 * @returns {object} a fresh `ctx` object shaped like the one `generateSchema` builds
 */
function makeCtx(overrides = {}) {
  return {
    commentIndex: new Map(),
    missingDescriptions: [],
    suspiciousDefaults: [],
    excludeKeys: new Set(),
    typeOverrides: {},
    enumOverrides: {},
    ...overrides
  }
}

test('inferFromLiteral', async (t) => {
  await t.test('boolean', () => {
    const schema = {}
    inferFromLiteral(true, schema)
    assert.strictEqual(schema.type, 'boolean')
  })

  await t.test('number', () => {
    const schema = {}
    inferFromLiteral(0.1, schema)
    assert.strictEqual(schema.type, 'number')
  })

  await t.test('string', () => {
    const schema = {}
    inferFromLiteral('hello', schema)
    assert.strictEqual(schema.type, 'string')
  })

  await t.test('array gets an unconstrained items schema', () => {
    const schema = {}
    inferFromLiteral([], schema)
    assert.strictEqual(schema.type, 'array')
    assert.deepStrictEqual(schema.items, {})
  })

  await t.test('a real null default allows string or null, and is kept', () => {
    const schema = {}
    inferFromLiteral(null, schema)
    assert.deepStrictEqual(schema.type, ['string', 'null'])
  })

  await t.test('no default at all (undefined) falls back to string, with no null option', () => {
    const schema = {}
    inferFromLiteral(undefined, schema)
    assert.strictEqual(schema.type, 'string')
  })

  await t.test('plain object gets additionalProperties: true', () => {
    const schema = {}
    inferFromLiteral({ foo: 'bar' }, schema)
    assert.strictEqual(schema.type, 'object')
    assert.strictEqual(schema.additionalProperties, true)
  })
})

test('isLeafDefinition', async (t) => {
  await t.test('true for a node with default', () => {
    assert.ok(isLeafDefinition({ default: true }))
  })

  await t.test('true for a node with only env', () => {
    assert.ok(isLeafDefinition({ env: 'NEW_RELIC_HOME' }))
  })

  await t.test('false for a group node', () => {
    assert.ok(!isLeafDefinition({ level: { default: 'info' } }))
  })
})

test('extractAllowListEnum', async (t) => {
  await t.test('pulls values out of an allowList.bind call', () => {
    const block = "record_sql: {\n  formatter: allowList.bind(null, ['off', 'obfuscated', 'raw']),\n  default: 'obfuscated'\n},"
    assert.deepStrictEqual(extractAllowListEnum(block), ['off', 'obfuscated', 'raw'])
  })

  await t.test('empty when there is no allowList call', () => {
    assert.deepStrictEqual(extractAllowListEnum('formatter: boolean,\ndefault: true'), [])
  })
})

test('hasComputedDefault', async (t) => {
  await t.test('a require() call is computed', () => {
    assert.ok(hasComputedDefault("default: require('path').join(process.cwd(), 'x'),"))
  })

  await t.test('a property access is computed', () => {
    assert.ok(hasComputedDefault('default: process.env.AWS_LAMBDA_FUNCTION_NAME != null,'))
  })

  await t.test('literal values are not computed', () => {
    for (const block of [
      "default: 'obfuscated',",
      'default: true,',
      'default: false,',
      'default: null,',
      'default: 5,',
      'default: 60_000,',
      'default: [],',
      'default: {},'
    ]) {
      assert.ok(!hasComputedDefault(block), block)
    }
  })

  await t.test('no default: line at all is not computed', () => {
    assert.ok(!hasComputedDefault('formatter: boolean,\nenv: NEW_RELIC_FOO'))
  })
})

test('indexJSDocComments', async (t) => {
  await t.test('single comment attached to its key', () => {
    const index = indexJSDocComments('/**\n * my comment\n */\nfoo: 1,\n')
    assert.strictEqual(index.get('foo').description, 'my comment')
  })

  await t.test('multi-line comment joined with spaces', () => {
    const index = indexJSDocComments('/**\n * line one\n * line two\n */\nfoo: 1,\n')
    assert.strictEqual(index.get('foo').description, 'line one line two')
  })

  await t.test('@ tags are dropped from the description', () => {
    const index = indexJSDocComments('/**\n * real text\n * @see https://example.com\n */\nfoo: 1,\n')
    assert.strictEqual(index.get('foo').description, 'real text')
  })

  await t.test(
    'blank line resets a pending comment (regression: a stale comment must not leak onto a later key)',
    () => {
      const source = [
        '/**',
        ' * A function that returns the definition',
        ' */',
        'const build = () => {',
        '  return {',
        '    newrelic_home: {',
        '      default: null',
        '    },',
        '  }',
        '}'
      ].join('\n')
      const index = indexJSDocComments(source)
      assert.strictEqual(index.get('newrelic_home').description, '')
    }
  )

  await t.test('nested keys are recorded under their full dotted path', () => {
    const source = [
      '/**',
      ' * parent doc',
      ' */',
      'outer: {',
      '  /**',
      '   * child doc',
      '   */',
      '  inner: 1,',
      '},'
    ].join('\n')
    const index = indexJSDocComments(source)
    assert.strictEqual(index.get('outer').description, 'parent doc')
    assert.strictEqual(index.get('outer.inner').description, 'child doc')
  })

  await t.test(
    "deep nesting and siblings retain full paths (regression: a leaf's own formatter:/default:/env: " +
      'lines must not corrupt the indentation stack for later siblings)',
    () => {
      const source = [
        '/**',
        ' * license desc',
        ' */',
        'license_key: \'\',',
        '/**',
        ' * agent desc',
        ' */',
        'agent_enabled: {',
        '  formatter: boolean,',
        '  default: true',
        '},',
        '/**',
        ' * kafka desc',
        ' */',
        'kafka: {',
        '  /**',
        '   * metrics desc',
        '   */',
        '  metrics: {',
        '    /**',
        '     * debug desc',
        '     */',
        '    debug: {',
        '      default: false',
        '    }',
        '  }',
        '},'
      ].join('\n')
      const index = indexJSDocComments(source)
      assert.strictEqual(index.get('license_key').description, 'license desc')
      assert.strictEqual(index.get('agent_enabled').description, 'agent desc')
      assert.strictEqual(index.get('kafka').description, 'kafka desc')
      assert.strictEqual(index.get('kafka.metrics').description, 'metrics desc')
      assert.strictEqual(index.get('kafka.metrics.debug').description, 'debug desc')
    }
  )

  await t.test('the recorded block captures a multi-line value literal', () => {
    const source = ['record_sql: {', "  formatter: allowList.bind(null, ['off', 'raw']),", '  default: \'off\'', '},'].join(
      '\n'
    )
    const index = indexJSDocComments(source)
    assert.match(index.get('record_sql').block, /allowList\.bind/)
  })

  await t.test(
    'a single-line /** ... */ comment closes on its own line ' +
      '(regression: it must not swallow the next key as comment body text)',
    () => {
      const source = ['/** Single-line doc. */', 'foo: 1,', '/**', ' * Multi-line doc.', ' */', 'bar: 2,'].join('\n')
      const index = indexJSDocComments(source)
      assert.strictEqual(index.get('foo').description, 'Single-line doc.')
      assert.strictEqual(index.get('bar').description, 'Multi-line doc.')
    }
  )
})

test('makeProperty', async (t) => {
  await t.test('boolean leaf with a description', () => {
    const ctx = makeCtx()
    const p = makeProperty(
      'agent_enabled',
      'agent_enabled',
      { formatter: formatters.boolean, default: true },
      { description: 'Enable the thing', block: '' },
      ctx
    )
    assert.strictEqual(p.type, 'boolean')
    assert.strictEqual(p.default, true)
    assert.strictEqual(p.description, 'Enable the thing')
  })

  await t.test('leaf with no source comment is recorded in missingDescriptions', () => {
    const ctx = makeCtx()
    const p = makeProperty('count', 'count', { formatter: formatters.int, default: 42 }, undefined, ctx)
    assert.strictEqual(p.type, 'integer')
    assert.strictEqual(p.default, 42)
    assert.ok(!('description' in p))
    assert.deepStrictEqual(ctx.missingDescriptions, ['count'])
  })

  await t.test('a real null default is kept, not dropped like a computed one', () => {
    const ctx = makeCtx()
    const p = makeProperty('newrelic_home', 'newrelic_home', { env: 'NEW_RELIC_HOME', default: null }, undefined, ctx)
    assert.deepStrictEqual(p.type, ['string', 'null'])
    assert.strictEqual(p.default, null)
  })

  await t.test('a leaf whose source default is computed, not literal, is recorded in suspiciousDefaults', () => {
    const ctx = makeCtx()
    const block = "filepath: {\n  default: require('path').join(process.cwd(), 'x.log'),\n  formatter: boolean\n},"
    makeProperty('logging.filepath', 'filepath', { formatter: formatters.boolean, default: '/some/path' }, { description: 'doc', block }, ctx)
    assert.deepStrictEqual(ctx.suspiciousDefaults, ['logging.filepath'])
  })

  await t.test('an overridden path never reaches the computed-default check', () => {
    const ctx = makeCtx({ typeOverrides: { 'logging.filepath': { type: 'string' } } })
    const block = "filepath: {\n  default: require('path').join(process.cwd(), 'x.log'),\n},"
    makeProperty('logging.filepath', 'filepath', { default: '/some/path' }, { description: 'doc', block }, ctx)
    assert.deepStrictEqual(ctx.suspiciousDefaults, [])
  })

  await t.test('array formatter gets string items and keeps its default', () => {
    const ctx = makeCtx()
    const p = makeProperty(
      'error_collector.ignore_classes',
      'ignore_classes',
      { formatter: formatters.array, default: ['FooException'] },
      undefined,
      ctx
    )
    assert.strictEqual(p.type, 'array')
    assert.deepStrictEqual(p.items, { type: 'string' })
    assert.deepStrictEqual(p.default, ['FooException'])
  })

  await t.test('bare string literal leaf', () => {
    const ctx = makeCtx()
    const p = makeProperty('host', 'host', '', { description: 'doc', block: '' }, ctx)
    assert.strictEqual(p.type, 'string')
    assert.strictEqual(p.default, '')
  })

  await t.test('allowList formatter extracts its enum from the source block', () => {
    const ctx = makeCtx()
    const boundAllowList = formatters.allowList.bind(null, ['off', 'obfuscated', 'raw'])
    const block = "record_sql: {\n  formatter: allowList.bind(null, ['off', 'obfuscated', 'raw']),\n  default: 'obfuscated'\n},"
    const p = makeProperty(
      'transaction_tracer.record_sql',
      'record_sql',
      { formatter: boundAllowList, default: 'obfuscated' },
      { description: 'doc', block },
      ctx
    )
    assert.strictEqual(p.type, 'string')
    assert.deepStrictEqual(p.enum, ['off', 'obfuscated', 'raw'])
    assert.strictEqual(p.default, 'obfuscated')
  })

  await t.test('type override takes precedence over formatter inference', () => {
    const ctx = makeCtx({ typeOverrides: { app_name: arrayOrDelimitedString([]) } })
    const p = makeProperty(
      'app_name',
      'app_name',
      { formatter: () => {}, default: [] },
      { description: 'Array of application names.', block: '' },
      ctx
    )
    assert.deepStrictEqual(p.anyOf, [{ type: 'array', items: { type: 'string' } }, { type: 'string' }])
    assert.strictEqual(p.description, 'Array of application names.')
  })

  await t.test('enum override matches by full dotted path', () => {
    const ctx = makeCtx({ enumOverrides: { 'logging.level': ['off', 'info', 'debug'] } })
    const p = makeProperty('logging.level', 'level', { default: 'info' }, undefined, ctx)
    assert.strictEqual(p.type, 'string')
    assert.deepStrictEqual(p.enum, ['off', 'info', 'debug'])
    assert.strictEqual(p.default, 'info')
  })

  await t.test('enum override falls back to matching by flat key', () => {
    const ctx = makeCtx({ enumOverrides: { level: ['off', 'info', 'debug'] } })
    const p = makeProperty('some.other.path.level', 'level', { default: 'info' }, undefined, ctx)
    assert.deepStrictEqual(p.enum, ['off', 'info', 'debug'])
  })
})

test('isExcluded', async (t) => {
  await t.test('exact path match', () => {
    assert.ok(isExcluded('agent_control', new Set(['agent_control'])))
  })

  await t.test('descendant of an excluded path', () => {
    assert.ok(isExcluded('agent_control.health.frequency', new Set(['agent_control'])))
  })

  await t.test('unrelated path is not excluded', () => {
    assert.ok(!isExcluded('agent_enabled', new Set(['agent_control'])))
  })

  await t.test('does not exclude an unrelated sibling with a shared prefix', () => {
    assert.ok(!isExcluded('agent_control_other', new Set(['agent_control'])))
  })
})

test('walk', async (t) => {
  await t.test('excludes a key at its own path', () => {
    const ctx = makeCtx({ excludeKeys: new Set(['agent_control']) })
    const schema = walk({ enabled: { formatter: formatters.boolean, default: false } }, ['agent_control'], ctx)
    assert.strictEqual(schema, null)
  })

  await t.test('excludes only the named descendant, keeping its siblings', () => {
    const ctx = makeCtx({ excludeKeys: new Set(['security.agent']) })
    const security = {
      enabled: { formatter: formatters.boolean, default: true },
      agent: { enabled: { formatter: formatters.boolean, default: false } }
    }
    const schema = walk(security, ['security'], ctx)
    assert.ok('enabled' in schema.properties)
    assert.ok(!('agent' in schema.properties))
  })

  await t.test('descriptions attach to both group and leaf nodes', () => {
    const ctx = makeCtx({
      commentIndex: new Map([
        ['outer', { description: 'outer description', block: '' }],
        ['outer.inner', { description: 'inner description', block: '' }]
      ])
    })
    const schema = walk({ inner: { formatter: formatters.boolean, default: true } }, ['outer'], ctx)
    assert.strictEqual(schema.description, 'outer description')
    assert.strictEqual(schema.properties.inner.description, 'inner description')
  })

  await t.test('every group node allows additional properties', () => {
    const ctx = makeCtx()
    const schema = walk({ inner: { formatter: formatters.boolean, default: true } }, ['outer'], ctx)
    assert.strictEqual(schema.additionalProperties, true)
  })
})

test('instrumentationSchema', () => {
  const schema = instrumentationSchema({ description: 'toggle stanza' })
  assert.strictEqual(schema.type, 'object')
  assert.strictEqual(schema.description, 'toggle stanza')
  assert.deepStrictEqual(schema.additionalProperties.properties.enabled, {
    type: 'boolean',
    default: true,
    description: 'Whether instrumentation for this module is active.'
  })
})

test('generateSchema (integration, synthetic fixture)', async (t) => {
  const definition = {
    app_name: { formatter: () => {}, default: [] },
    license_key: '',
    logging: {
      level: { default: 'info' }
    },
    error_collector: {
      enabled: { formatter: formatters.boolean, default: true }
    },
    agent_control: {
      enabled: { formatter: formatters.boolean, default: false }
    }
  }

  const defaultConfigSourceText = [
    '/**',
    ' * Array of application names.',
    ' */',
    'app_name: {',
    '  default: []',
    '},',
    'license_key: \'\',',
    '/**',
    ' * Stale comment that must not leak into the next key.',
    ' */',
    '',
    '/**',
    ' * Real description for error_collector.',
    ' */',
    'error_collector: {',
    '  enabled: {',
    '    formatter: boolean,',
    '    default: true',
    '  }',
    '},',
    'agent_control: {',
    '  enabled: {',
    '    formatter: boolean,',
    '    default: false',
    '  }',
    '},'
  ].join('\n')

  const { schema, missingDescriptions } = generateSchema({
    definition,
    defaultConfigSourceText,
    excludeKeys: new Set(['agent_control']),
    typeOverrides: { app_name: arrayOrDelimitedString([]) },
    enumOverrides: {}
  })

  await t.test('top-level required fields', () => {
    assert.deepStrictEqual(schema.required, ['app_name', 'license_key'])
  })

  await t.test('app_name uses the type override', () => {
    assert.deepStrictEqual(schema.properties.app_name.anyOf, [
      { type: 'array', items: { type: 'string' } },
      { type: 'string' }
    ])
  })

  await t.test('agent_control is excluded', () => {
    assert.ok(!('agent_control' in schema.properties))
  })

  await t.test(
    "a stale JSDoc block doesn't leak into error_collector's description " +
      '(regression: proves the blank-line reset survives the full generateSchema pipeline, ' +
      'not just indexJSDocComments in isolation)',
    () => {
      assert.ok(schema.properties.error_collector.description.includes('Real description'))
      assert.ok(!schema.properties.error_collector.description.includes('Stale comment'))
    }
  )

  await t.test('logging.level with no source comment is flagged as missing', () => {
    assert.ok(missingDescriptions.includes('logging.level'))
  })
})

test('generateSchema (integration, real agent config)', async (t) => {
  const { schema, missingDescriptions, suspiciousDefaults } = generateSchema()

  await t.test('required fields', () => {
    assert.deepStrictEqual(schema.required, ['app_name', 'license_key'])
  })

  await t.test('top level allows additional properties, for forward compatibility', () => {
    assert.strictEqual(schema.additionalProperties, true)
  })

  await t.test('excluded stanzas are absent', () => {
    assert.ok(!('agent_control' in schema.properties))
    assert.ok(!('sampler' in schema.properties.distributed_tracing.properties))
    assert.ok(!('diagnostics' in schema.properties.logging.properties))
    assert.ok(!('insecure' in schema.properties.infinite_tracing.properties.trace_observer.properties))
    assert.ok(!('feature_flag' in schema.properties))
    assert.ok(!('ssl' in schema.properties))
  })

  await t.test('the dynamic instrumentation map is present', () => {
    assert.strictEqual(schema.properties.instrumentation.type, 'object')
    assert.ok(schema.properties.instrumentation.additionalProperties)
  })

  await t.test(
    'app_name keeps its real default (regression: the production TYPE_OVERRIDES entry ' +
      'must actually pass it through, not just the arrayOrDelimitedString helper in isolation)',
    () => {
      assert.deepStrictEqual(schema.properties.app_name.default, [])
    }
  )

  await t.test('license_key is required, non-empty, and uses the real source description', () => {
    assert.strictEqual(schema.properties.license_key.type, 'string')
    assert.strictEqual(schema.properties.license_key.minLength, 1)
    assert.ok(!('default' in schema.properties.license_key))
    assert.match(schema.properties.license_key.description, /must be set/i)
  })

  await t.test('serverless DT ids accept string or number, not just string', () => {
    for (const key of ['trusted_account_key', 'primary_application_id', 'account_id']) {
      assert.deepStrictEqual(schema.properties[key].type, ['string', 'number', 'null'])
      assert.strictEqual(schema.properties[key].default, null)
    }
  })

  await t.test('labels enforces the limits its own description states', () => {
    const labels = schema.properties.labels
    assert.strictEqual(labels.maxProperties, 64)
    assert.strictEqual(labels.propertyNames.maxLength, 255)
    assert.strictEqual(labels.additionalProperties.maxLength, 255)
    assert.strictEqual(labels.additionalProperties.type, 'string')
  })

  await t.test('attributes.value_size_limit enforces the maximum its own description states', () => {
    const limit = schema.properties.attributes.properties.value_size_limit
    assert.strictEqual(limit.type, 'integer')
    assert.strictEqual(limit.default, 256)
    assert.strictEqual(limit.maximum, 4096)
  })

  await t.test(
    'serverless_mode.enabled has no default (real default depends on the deploy ' +
      'environment, not whichever machine ran the generator) and explains the ' +
      'auto-detection in its own description, since the source comment does not',
    () => {
      const enabled = schema.properties.serverless_mode.properties.enabled
      assert.strictEqual(enabled.type, 'boolean')
      assert.ok(!('default' in enabled))
      assert.match(enabled.description, /AWS_LAMBDA_FUNCTION_NAME/)
    }
  )

  await t.test('a genuinely string-only null default keeps the narrower type', () => {
    assert.deepStrictEqual(schema.properties.newrelic_home.type, ['string', 'null'])
  })

  await t.test('missingDescriptions only ever names real config paths', () => {
    assert.ok(Array.isArray(missingDescriptions))
    assert.ok(missingDescriptions.every((p) => typeof p === 'string' && p.length > 0))
  })

  await t.test(
    'no un-overridden computed defaults slipped through (regression: a new config key with a ' +
      'require()/process.-computed default needs a TYPE_OVERRIDES entry, same as logging.filepath ' +
      'and serverless_mode.enabled)',
    () => {
      assert.deepStrictEqual(suspiciousDefaults, [])
    }
  )

  await t.test('validates against the Draft 2020-12 meta-schema', () => {
    assert.ok(validateMetaSchema(schema))
  })
})
