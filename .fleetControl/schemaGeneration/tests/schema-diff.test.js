/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  loadExisting,
  classifyChanges,
  recommendBump,
  applyBump,
  bumpVersionLine,
  renderChange
} = require('../schema-diff')

test('loadExisting', async (t) => {
  await t.test('missing file returns {}', () => {
    assert.deepStrictEqual(loadExisting(path.join(os.tmpdir(), 'does-not-exist-schema.json')), {})
  })

  await t.test('malformed JSON returns {}', () => {
    const file = path.join(os.tmpdir(), `schema-diff-test-malformed-${process.pid}.json`)
    fs.writeFileSync(file, '{ not json')
    try {
      assert.deepStrictEqual(loadExisting(file), {})
    } finally {
      fs.unlinkSync(file)
    }
  })

  await t.test('valid JSON is parsed', () => {
    const file = path.join(os.tmpdir(), `schema-diff-test-valid-${process.pid}.json`)
    fs.writeFileSync(file, JSON.stringify({ properties: { a: { type: 'string' } } }))
    try {
      assert.deepStrictEqual(loadExisting(file), { properties: { a: { type: 'string' } } })
    } finally {
      fs.unlinkSync(file)
    }
  })
})

test('classifyChanges: required', async (t) => {
  await t.test('a newly required property is breaking', () => {
    const changes = classifyChanges({ required: [] }, { required: ['app_name'] })
    assert.deepStrictEqual(changes, [
      { path: 'app_name', kind: 'required_added', severity: 'breaking', detail: 'now required' }
    ])
  })

  await t.test('a no-longer-required property is additive', () => {
    const changes = classifyChanges({ required: ['app_name'] }, { required: [] })
    assert.deepStrictEqual(changes, [
      { path: 'app_name', kind: 'required_removed', severity: 'additive', detail: 'no longer required' }
    ])
  })

  await t.test('unchanged required arrays produce no changes', () => {
    assert.deepStrictEqual(classifyChanges({ required: ['app_name'] }, { required: ['app_name'] }), [])
  })
})

test('classifyChanges: additionalProperties', async (t) => {
  await t.test('true -> false is breaking', () => {
    const changes = classifyChanges({ additionalProperties: true }, { additionalProperties: false })
    assert.strictEqual(changes.length, 1)
    assert.strictEqual(changes[0].severity, 'breaking')
    assert.strictEqual(changes[0].kind, 'additional_properties_tightened')
  })

  await t.test('false -> true is additive', () => {
    const changes = classifyChanges({ additionalProperties: false }, { additionalProperties: true })
    assert.strictEqual(changes.length, 1)
    assert.strictEqual(changes[0].severity, 'additive')
    assert.strictEqual(changes[0].kind, 'additional_properties_loosened')
  })

  await t.test('missing additionalProperties defaults to true (JSON Schema default), so no change is reported', () => {
    assert.deepStrictEqual(classifyChanges({}, { additionalProperties: true }), [])
  })

  // Regression: labels/instrumentation-style nodes use an object-shaped
  // additionalProperties to constrain dictionary values, not a boolean
  // toggle. This must never be misclassified as a breaking/additive change.
  await t.test('object-shaped additionalProperties on either side is skipped entirely', () => {
    const oldLabels = { additionalProperties: { type: 'string', maxLength: 255 } }
    const newLabelsTightened = { additionalProperties: { type: 'string', maxLength: 100 } }
    assert.deepStrictEqual(classifyChanges(oldLabels, newLabelsTightened), [])

    const oldBool = { additionalProperties: true }
    const newObjectShaped = { additionalProperties: { type: 'string' } }
    assert.deepStrictEqual(classifyChanges(oldBool, newObjectShaped), [])
  })
})

test('classifyChanges: properties', async (t) => {
  await t.test('a new property is additive', () => {
    const changes = classifyChanges({ properties: {} }, { properties: { app_name: { type: 'string' } } })
    assert.deepStrictEqual(changes, [
      { path: 'app_name', kind: 'property_added', severity: 'additive', detail: 'new property' }
    ])
  })

  await t.test('a removed property is breaking', () => {
    const changes = classifyChanges({ properties: { app_name: { type: 'string' } } }, { properties: {} })
    assert.deepStrictEqual(changes, [
      { path: 'app_name', kind: 'property_removed', severity: 'breaking', detail: 'property removed' }
    ])
  })

  await t.test('recurses into nested objects with their own properties map', () => {
    const oldSchema = {
      properties: {
        transaction_tracer: { type: 'object', properties: { enabled: { type: 'boolean' } } }
      }
    }
    const newSchema = {
      properties: {
        transaction_tracer: {
          type: 'object',
          properties: { enabled: { type: 'boolean' }, record_sql: { type: 'string' } }
        }
      }
    }
    const changes = classifyChanges(oldSchema, newSchema)
    assert.deepStrictEqual(changes, [
      { path: 'transaction_tracer.record_sql', kind: 'property_added', severity: 'additive', detail: 'new property' }
    ])
  })

  await t.test('a dictionary-shaped object (no properties map, e.g. labels) is diffed as a leaf, not recursed into', () => {
    const labels = { type: 'object', additionalProperties: { type: 'string', maxLength: 255 }, default: {} }
    // Only the leaf-level fields (type/enum/default/description) are compared for such nodes.
    const changed = { ...labels, description: 'now documented' }
    const changes = classifyChanges({ properties: { labels } }, { properties: { labels: changed } })
    assert.deepStrictEqual(changes, [
      { path: 'labels', kind: 'description_changed', severity: 'cosmetic', detail: 'description changed' }
    ])
  })
})

test('classifyChanges: leaf type signature', async (t) => {
  // Regression: a plain type is trivially fine with naive equality, but
  // array-valued `type` (nullable unions like Node's trusted_account_key:
  // ["string", "number", "null"]) and anyOf shapes (like app_name) must not
  // false-positive as changed just because each run produces a fresh
  // array/object instance — the comparison has to be structural.
  await t.test('an unchanged type signature produces no change, whether plain, array-valued, or anyOf', () => {
    const plain = { type: 'string' }
    assert.deepStrictEqual(classifyChanges({ properties: { k: plain } }, { properties: { k: plain } }), [])

    const arrayValued = { type: ['string', 'number', 'null'] }
    assert.deepStrictEqual(
      classifyChanges({ properties: { trusted_account_key: arrayValued } }, { properties: { trusted_account_key: arrayValued } }),
      []
    )

    const anyOf = { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }] }
    assert.deepStrictEqual(classifyChanges({ properties: { app_name: anyOf } }, { properties: { app_name: anyOf } }), [])
  })

  await t.test('a real type-signature change is caught, whether array-valued or anyOf-based', () => {
    const arrayChanges = classifyChanges(
      { properties: { k: { type: ['string', 'null'] } } },
      { properties: { k: { type: ['string', 'number', 'null'] } } }
    )
    assert.strictEqual(arrayChanges.length, 1)
    assert.strictEqual(arrayChanges[0].kind, 'type_changed')
    assert.strictEqual(arrayChanges[0].severity, 'breaking')

    const anyOfChanges = classifyChanges(
      { properties: { k: { anyOf: [{ type: 'array' }, { type: 'string' }] } } },
      { properties: { k: { type: 'string' } } }
    )
    assert.strictEqual(anyOfChanges.length, 1)
    assert.strictEqual(anyOfChanges[0].kind, 'type_changed')
    assert.strictEqual(anyOfChanges[0].severity, 'breaking')
  })
})

test('classifyChanges: leaf enum', async (t) => {
  await t.test('introducing an enum is breaking', () => {
    const changes = classifyChanges({ properties: { k: { type: 'string' } } }, { properties: { k: { type: 'string', enum: ['a', 'b'] } } })
    assert.strictEqual(changes.length, 1)
    assert.strictEqual(changes[0].kind, 'enum_introduced')
    assert.strictEqual(changes[0].severity, 'breaking')
  })

  await t.test('removing an enum entirely is additive', () => {
    const changes = classifyChanges({ properties: { k: { type: 'string', enum: ['a', 'b'] } } }, { properties: { k: { type: 'string' } } })
    assert.strictEqual(changes.length, 1)
    assert.strictEqual(changes[0].kind, 'enum_removed_entirely')
    assert.strictEqual(changes[0].severity, 'additive')
  })

  await t.test('removing one enum value is breaking, adding one is additive, both can happen at once', () => {
    const old = { properties: { k: { type: 'string', enum: ['a', 'b'] } } }
    const next = { properties: { k: { type: 'string', enum: ['a', 'c'] } } }
    const changes = classifyChanges(old, next)
    const kinds = changes.map((c) => c.kind).sort()
    assert.deepStrictEqual(kinds, ['enum_value_added', 'enum_value_removed'])
    assert.strictEqual(changes.find((c) => c.kind === 'enum_value_removed').severity, 'breaking')
    assert.strictEqual(changes.find((c) => c.kind === 'enum_value_added').severity, 'additive')
  })

  await t.test('unchanged enum produces no change', () => {
    const prop = { type: 'string', enum: ['a', 'b'] }
    assert.deepStrictEqual(classifyChanges({ properties: { k: prop } }, { properties: { k: prop } }), [])
  })
})

test('classifyChanges: leaf default and description', async (t) => {
  await t.test('a changed default is additive', () => {
    const changes = classifyChanges({ properties: { k: { type: 'string', default: 'a' } } }, { properties: { k: { type: 'string', default: 'b' } } })
    assert.deepStrictEqual(changes, [{ path: 'k', kind: 'default_changed', severity: 'additive', detail: 'default changed: "a" -> "b"' }])
  })

  await t.test('gaining a default (previously absent) is treated as a default change', () => {
    const changes = classifyChanges({ properties: { k: { type: 'string' } } }, { properties: { k: { type: 'string', default: 'b' } } })
    assert.strictEqual(changes.length, 1)
    assert.strictEqual(changes[0].kind, 'default_changed')
  })

  await t.test('a default that is structurally equal (e.g. two distinct {} objects) is not a change', () => {
    const changes = classifyChanges({ properties: { labels: { type: 'object', default: {} } } }, { properties: { labels: { type: 'object', default: {} } } })
    assert.deepStrictEqual(changes, [])
  })

  await t.test('an absent default on both sides is not a change', () => {
    assert.deepStrictEqual(classifyChanges({ properties: { k: { type: 'string' } } }, { properties: { k: { type: 'string' } } }), [])
  })

  await t.test('a changed description is cosmetic', () => {
    const changes = classifyChanges({ properties: { k: { type: 'string', description: 'a' } } }, { properties: { k: { type: 'string', description: 'b' } } })
    assert.deepStrictEqual(changes, [{ path: 'k', kind: 'description_changed', severity: 'cosmetic', detail: 'description changed' }])
  })
})

test('recommendBump', async (t) => {
  await t.test('no changes recommends none', () => {
    assert.strictEqual(recommendBump([]), 'none')
  })

  await t.test('breaking wins over additive and cosmetic', () => {
    const changes = [{ severity: 'cosmetic' }, { severity: 'additive' }, { severity: 'breaking' }]
    assert.strictEqual(recommendBump(changes), 'major')
  })

  await t.test('additive wins over cosmetic when there is no breaking change', () => {
    assert.strictEqual(recommendBump([{ severity: 'cosmetic' }, { severity: 'additive' }]), 'minor')
  })

  await t.test('cosmetic alone recommends patch', () => {
    assert.strictEqual(recommendBump([{ severity: 'cosmetic' }]), 'patch')
  })
})

test('applyBump', async (t) => {
  await t.test('major/minor/patch each bump the right segment and reset everything after it', () => {
    assert.strictEqual(applyBump('1.2.3', 'major'), '2.0.0')
    assert.strictEqual(applyBump('1.2.3', 'minor'), '1.3.0')
    assert.strictEqual(applyBump('1.2.3', 'patch'), '1.2.4')
  })

  await t.test("'none' returns the version unchanged", () => {
    assert.strictEqual(applyBump('1.2.3', 'none'), '1.2.3')
  })

  await t.test('throws on a non-semver version', () => {
    assert.throws(() => applyBump('not-a-version', 'major'), /not a semver version/)
  })

  await t.test('throws on an unknown bump kind', () => {
    assert.throws(() => applyBump('1.2.3', 'gigantic'), /unknown bump kind/)
  })
})

test('bumpVersionLine', async (t) => {
  await t.test('replaces the single version line, preserving indentation and trailing content', () => {
    const yamlText = 'configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n    version: 1.0.0\n    schema: ./schemas/config.json\n'
    assert.strictEqual(
      bumpVersionLine(yamlText, '2.0.0'),
      'configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n    version: 2.0.0\n    schema: ./schemas/config.json\n'
    )
  })

  await t.test('throws when there is no version line', () => {
    assert.throws(() => bumpVersionLine('configurationDefinitions:\n  - schema: x\n', '2.0.0'), /expected exactly 1/)
  })

  await t.test('throws when there is more than one version line', () => {
    const yamlText = 'a:\n  - version: 1.0.0\nb:\n  - version: 1.0.0\n'
    assert.throws(() => bumpVersionLine(yamlText, '2.0.0'), /expected exactly 1/)
  })
})

test('renderChange', async (t) => {
  await t.test('picks the right symbol per kind: + added, - removed, ~ everything else', () => {
    assert.strictEqual(renderChange({ path: 'k', kind: 'property_added', detail: 'new property' }), '+ k: new property')
    assert.strictEqual(renderChange({ path: 'k', kind: 'property_removed', detail: 'property removed' }), '- k: property removed')
    assert.strictEqual(
      renderChange({ path: 'k', kind: 'default_changed', detail: 'default changed: 1 -> 2' }),
      '~ k: default changed: 1 -> 2'
    )
  })
})
