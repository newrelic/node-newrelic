/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { removeModules } = require('#testlib/cache-buster.js')

const SCRIPT_PATH = '../create-github-release'

const SUPPORT_STATEMENT_HEADER = '### Support statement:'

function afterEach() {
  removeModules(['commander'])
}

test('Create GitHub Release script', async (t) => {
  await t.test('getReleaseNotes', async (t) => {
    t.beforeEach((ctx) => {
      const mockFs = {
        readFile: sinon.stub()
      }
      const script = proxyquire(SCRIPT_PATH, {
        fs: mockFs,
        './github': sinon.stub()
      })
      ctx.nr = { mockFs, script }
    })

    t.afterEach(afterEach)

    await t.test('should return release notes body with support statement appended', async (t) => {
      const { mockFs, script } = t.nr
      const fileContent = [
        '### v1.2.3 (2021-02-24)',
        '',
        '#### Bug fixes',
        '* Fixed a thing',
        '',
        '### v1.2.2 (2021-01-01)',
        '',
        '#### Old changes',
        '* Old thing'
      ].join('\n')

      mockFs.readFile.yields(null, fileContent)

      const result = await script.getReleaseNotes('v1.2.3', 'NEWS.md')

      assert.ok(result.includes('#### Bug fixes'))
      assert.ok(result.includes('* Fixed a thing'))
      assert.ok(result.includes(SUPPORT_STATEMENT_HEADER))
    })

    await t.test('should strip the version heading line from the body', async (t) => {
      const { mockFs, script } = t.nr
      const fileContent = [
        '### v1.2.3 (2021-02-24)',
        '',
        '#### Features',
        '* Added something',
        '',
        '### v1.2.2 (2021-01-01)',
        '',
        '#### Other',
        '* Other thing'
      ].join('\n')

      mockFs.readFile.yields(null, fileContent)

      const result = await script.getReleaseNotes('v1.2.3', 'NEWS.md')

      assert.ok(!result.startsWith('v1.2.3'))
      assert.ok(result.startsWith('#### Features'))
    })

    await t.test('should throw when tag is not the first line of the file', async (t) => {
      const { mockFs, script } = t.nr
      const fileContent = [
        '### v1.2.2 (2021-01-01)',
        '',
        '#### Old changes',
        '* Old thing'
      ].join('\n')

      mockFs.readFile.yields(null, fileContent)

      await assert.rejects(
        () => script.getReleaseNotes('v1.2.3', 'NEWS.md'),
        { message: 'Current tag (### v1.2.3) not first line of release notes.' }
      )
    })

    await t.test('should return notes when tag is the only section in the changelog', async (t) => {
      const { mockFs, script } = t.nr
      const fileContent = [
        '### v1.2.3 (2021-02-24)',
        '',
        '#### Bug fixes',
        '* Only entry, no next release heading'
      ].join('\n')

      mockFs.readFile.yields(null, fileContent)

      const result = await script.getReleaseNotes('v1.2.3', 'NEWS.md')

      assert.ok(result.includes('#### Bug fixes'))
      assert.ok(result.includes('* Only entry'))
      assert.ok(result.includes(SUPPORT_STATEMENT_HEADER))
    })
  })
})
