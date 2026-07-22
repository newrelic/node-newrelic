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

const { findLatestReleaseTag, extractVersion, previousRelease, applyWrite, decideBump, parseArgs, main } = require('../bump-schema-version')

test('findLatestReleaseTag', async (t) => {
  await t.test('picks the first v-prefixed semver tag, ignoring non-matching entries', () => {
    const tagLines = ['v14.3.0-pre1', 'not-a-tag', 'v14.3.0', 'v14.2.1']
    assert.strictEqual(findLatestReleaseTag(tagLines), 'v14.3.0')
  })

  await t.test('trims whitespace on each line', () => {
    assert.strictEqual(findLatestReleaseTag(['  v1.0.0  ']), 'v1.0.0')
  })

  await t.test('returns null when nothing matches', () => {
    assert.strictEqual(findLatestReleaseTag(['not-a-tag', 'v1.2.3-rc.1', '']), null)
  })

  await t.test('returns null for an empty list', () => {
    assert.strictEqual(findLatestReleaseTag([]), null)
  })
})

test('extractVersion', async (t) => {
  await t.test('reads version from the first configurationDefinitions entry', () => {
    const yamlText = 'configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n    version: 1.2.3\n    schema: ./schemas/config.json\n'
    assert.strictEqual(extractVersion(yamlText), '1.2.3')
  })

  await t.test('returns null when configurationDefinitions is missing', () => {
    assert.strictEqual(extractVersion('unrelated: true\n'), null)
  })

  await t.test('returns null when configurationDefinitions is empty', () => {
    assert.strictEqual(extractVersion('configurationDefinitions: []\n'), null)
  })

  await t.test('returns null when the version field is missing from the entry', () => {
    assert.strictEqual(extractVersion('configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n'), null)
  })
})

// Records calls and returns a canned value — used to verify previousRelease/
// main call their injected collaborators with the right arguments, and only
// when expected, without touching real git or the real filesystem.
function makeSpy(returnValue) {
  const fn = (...args) => {
    fn.calls.push(args)
    return typeof returnValue === 'function' ? returnValue(...args) : returnValue
  }
  fn.calls = []
  return fn
}

function makeGitShowStub(responses) {
  return makeSpy((..._args) => responses.shift())
}

test('previousRelease', async (t) => {
  await t.test('no tag is a bootstrap case, and gitShow is never called', () => {
    const gitShow = makeGitShowStub([])
    const result = previousRelease(null, { gitShow })
    assert.deepStrictEqual(result, { baselineSchema: null, starterVersion: null })
    assert.strictEqual(gitShow.calls.length, 0)
  })

  await t.test('missing schema at the ref is a bootstrap case', () => {
    const gitShow = makeGitShowStub([null, 'configurationDefinitions:\n  - version: 1.0.0\n'])
    assert.deepStrictEqual(previousRelease('v0.0.0', { gitShow }), { baselineSchema: null, starterVersion: null })
  })

  await t.test('missing configurationDefinitions.yml at the ref is a bootstrap case', () => {
    const gitShow = makeGitShowStub(['{"properties":{}}', null])
    assert.deepStrictEqual(previousRelease('v0.0.0', { gitShow }), { baselineSchema: null, starterVersion: null })
  })

  await t.test('malformed JSON at the ref is a bootstrap case, not a thrown error', () => {
    const gitShow = makeGitShowStub(['this is not valid json', 'configurationDefinitions:\n  - version: 1.0.0\n'])
    assert.deepStrictEqual(previousRelease('v0.0.0', { gitShow }), { baselineSchema: null, starterVersion: null })
  })

  await t.test('a configurationDefinitions.yml with no version field yields a null starterVersion, even though the schema parsed fine', () => {
    const gitShow = makeGitShowStub(['{"properties":{}}', 'configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n'])
    const result = previousRelease('v0.0.0', { gitShow })
    assert.deepStrictEqual(result.baselineSchema, { properties: {} })
    assert.strictEqual(result.starterVersion, null)
  })

  await t.test('both present and valid returns the parsed schema and version, querying both paths at the given ref', () => {
    const gitShow = makeGitShowStub(['{"properties":{"app_name":{"type":"string"}}}', 'configurationDefinitions:\n  - version: 1.2.3\n'])
    const result = previousRelease('v1.2.3', { gitShow })
    assert.deepStrictEqual(result.baselineSchema, { properties: { app_name: { type: 'string' } } })
    assert.strictEqual(result.starterVersion, '1.2.3')
    assert.deepStrictEqual(gitShow.calls, [
      ['v1.2.3', '.fleetControl/schemas/config.json'],
      ['v1.2.3', '.fleetControl/configurationDefinitions.yml']
    ])
  })
})

test('applyWrite', async (t) => {
  function tmpConfigDef(contents) {
    const file = path.join(os.tmpdir(), `bump-schema-version-test-${process.pid}-${Math.random().toString(36).slice(2)}.yml`)
    fs.writeFileSync(file, contents)
    return file
  }

  await t.test('writes the new version and returns true when it differs from what is on disk', () => {
    const configDefPath = tmpConfigDef(
      'configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n    version: 1.0.0\n    schema: ./schemas/config.json\n'
    )
    try {
      assert.strictEqual(applyWrite({ newVersion: '2.0.0' }, { configDefPath }), true)
      assert.match(fs.readFileSync(configDefPath, 'utf8'), /version: 2\.0\.0/)
    } finally {
      fs.unlinkSync(configDefPath)
    }
  })

  await t.test('is a no-op and returns false when the on-disk version already matches', () => {
    const configDefPath = tmpConfigDef(
      'configurationDefinitions:\n  - platform: KUBERNETESCLUSTER\n    version: 2.0.0\n    schema: ./schemas/config.json\n'
    )
    try {
      const before = fs.readFileSync(configDefPath, 'utf8')
      assert.strictEqual(applyWrite({ newVersion: '2.0.0' }, { configDefPath }), false)
      assert.strictEqual(fs.readFileSync(configDefPath, 'utf8'), before)
    } finally {
      fs.unlinkSync(configDefPath)
    }
  })
})

test('decideBump', async (t) => {
  await t.test('no baseline schema is a first release, regardless of currentSchema', () => {
    const result = decideBump({ baselineSchema: null, currentSchema: { properties: {} }, starterVersion: '1.0.0' })
    assert.deepStrictEqual(result, { action: 'first_release', bump: 'none', changes: [] })
  })

  await t.test('a baseline with no starterVersion is also a first release', () => {
    const result = decideBump({ baselineSchema: { properties: {} }, currentSchema: { properties: {} }, starterVersion: null })
    assert.strictEqual(result.action, 'first_release')
  })

  await t.test('an unchanged schema against a real baseline is no_change', () => {
    const schema = { properties: { app_name: { type: 'string' } } }
    const result = decideBump({ baselineSchema: schema, currentSchema: schema, starterVersion: '1.0.0' })
    assert.strictEqual(result.action, 'no_change')
    assert.strictEqual(result.bump, 'none')
  })

  await t.test('a breaking change recommends a major bump applied to the starter version', () => {
    const baseline = { properties: { transaction_threshold: { type: 'number' } } }
    const current = { properties: { transaction_threshold: { type: ['number', 'string'] } } }
    const result = decideBump({ baselineSchema: baseline, currentSchema: current, starterVersion: '1.4.2' })
    assert.strictEqual(result.action, 'bump')
    assert.strictEqual(result.bump, 'major')
    assert.strictEqual(result.oldVersion, '1.4.2')
    assert.strictEqual(result.newVersion, '2.0.0')
    assert.strictEqual(result.changes.length, 1)
  })

  await t.test('an additive-only change recommends a minor bump', () => {
    const baseline = { properties: {} }
    const current = { properties: { new_setting: { type: 'string' } } }
    const result = decideBump({ baselineSchema: baseline, currentSchema: current, starterVersion: '1.4.2' })
    assert.strictEqual(result.bump, 'minor')
    assert.strictEqual(result.newVersion, '1.5.0')
  })
})

test('parseArgs', async (t) => {
  await t.test('no args returns defaults', () => {
    assert.deepStrictEqual(parseArgs([]), { since: null, write: false })
  })

  await t.test('--since=<ref> is captured', () => {
    assert.deepStrictEqual(parseArgs(['--since=v14.2.0']), { since: 'v14.2.0', write: false })
  })

  await t.test('--write sets write to true', () => {
    assert.deepStrictEqual(parseArgs(['--write']), { since: null, write: true })
  })

  await t.test('an unknown flag throws', () => {
    assert.throws(() => parseArgs(['--bogus']), /Unknown flag: --bogus/)
  })
})

test('main', async (t) => {
  await t.test('no tag available (no --since, no latest tag) never loads the current schema or previousRelease', () => {
    const previousReleaseSpy = makeSpy()
    const loadCurrentSchema = makeSpy()
    main({
      argv: [],
      latestReleaseTag: () => null,
      previousRelease: previousReleaseSpy,
      loadCurrentSchema,
      applyWrite: makeSpy()
    })
    assert.strictEqual(previousReleaseSpy.calls.length, 0)
    assert.strictEqual(loadCurrentSchema.calls.length, 0)
  })

  await t.test('applyWrite is never called for a bootstrap result, an unchanged schema, or a dry-run diff', () => {
    const bootstrapApplyWrite = makeSpy()
    main({
      argv: ['--since=v0.0.0'],
      previousRelease: () => { return { baselineSchema: null, starterVersion: null } },
      loadCurrentSchema: () => { return { properties: {} } },
      applyWrite: bootstrapApplyWrite
    })
    assert.strictEqual(bootstrapApplyWrite.calls.length, 0)

    const unchangedSchema = { properties: { app_name: { type: 'string' } } }
    const noChangeApplyWrite = makeSpy()
    main({
      argv: ['--since=v0.0.0'],
      previousRelease: () => { return { baselineSchema: unchangedSchema, starterVersion: '1.0.0' } },
      loadCurrentSchema: () => unchangedSchema,
      applyWrite: noChangeApplyWrite
    })
    assert.strictEqual(noChangeApplyWrite.calls.length, 0)

    const dryRunApplyWrite = makeSpy()
    main({
      argv: ['--since=v0.0.0'],
      previousRelease: () => { return { baselineSchema: { properties: {} }, starterVersion: '1.0.0' } },
      loadCurrentSchema: () => { return { properties: { new_setting: { type: 'string' } } } },
      applyWrite: dryRunApplyWrite
    })
    assert.strictEqual(dryRunApplyWrite.calls.length, 0)
  })

  await t.test('a real diff with --write calls applyWrite with the computed bump result', () => {
    const applyWriteSpy = makeSpy(true)
    main({
      argv: ['--since=v0.0.0', '--write'],
      previousRelease: () => { return { baselineSchema: { properties: {} }, starterVersion: '1.0.0' } },
      loadCurrentSchema: () => { return { properties: { new_setting: { type: 'string' } } } },
      applyWrite: applyWriteSpy
    })
    assert.strictEqual(applyWriteSpy.calls.length, 1)
    assert.strictEqual(applyWriteSpy.calls[0][0].bump, 'minor')
    assert.strictEqual(applyWriteSpy.calls[0][0].newVersion, '1.1.0')
  })

  await t.test('--since takes precedence over latestReleaseTag, which is never called', () => {
    const latestReleaseTagSpy = makeSpy('v-should-not-be-used')
    main({
      argv: ['--since=v9.9.9'],
      latestReleaseTag: latestReleaseTagSpy,
      previousRelease: (tag) => {
        assert.strictEqual(tag, 'v9.9.9')
        return { baselineSchema: null, starterVersion: null }
      },
      loadCurrentSchema: () => { return { properties: {} } },
      applyWrite: makeSpy()
    })
    assert.strictEqual(latestReleaseTagSpy.calls.length, 0)
  })

  await t.test('an unknown flag throws before any collaborator runs', () => {
    const previousReleaseSpy = makeSpy()
    assert.throws(
      () => main({
        argv: ['--bogus'],
        previousRelease: previousReleaseSpy,
        loadCurrentSchema: makeSpy(),
        applyWrite: makeSpy()
      }),
      /Unknown flag: --bogus/
    )
    assert.strictEqual(previousReleaseSpy.calls.length, 0)
  })
})
