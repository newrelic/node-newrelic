/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const SCRIPT_PATH = '../create-docs-pr'

test('Create Docs PR script', async (t) => {
  await t.test('getReleaseNotes', async (t) => {
    t.beforeEach((ctx) => {
      const mockFs = {
        readFile: sinon.stub()
      }
      const script = proxyquire(SCRIPT_PATH, {
        fs: mockFs
      })
      ctx.nr = {
        mockFs,
        script
      }
    })

    await t.test('should return our release notes', async (t) => {
      const { mockFs, script } = t.nr
      const expectedMarkdown = [
        '### v1.2.3 (2020-04-03)',
        '',
        '#### Stuff heading',
        '* first commit',
        '',
        '### v1.2.2 (2020-01-01)',
        '',
        '#### Things heading',
        '* second commit'
      ].join('\n')

      mockFs.readFile.yields(null, expectedMarkdown)

      const result = await script.getReleaseNotes('v1.2.3', 'NEWS.md')

      assert.equal(result.releaseDate, '2020-04-03')

      const body = result.body.split('\n')
      assert.equal(body[0], '#### Stuff heading')
      assert.equal(body[1], '* first commit')
      assert.equal(body[4], '### Support statement:')
    })
  })

  await t.test('getFrontMatter', async (t) => {
    t.beforeEach((ctx) => {
      const mockFs = {
        readFile: sinon.stub()
      }
      const script = proxyquire(SCRIPT_PATH, {
        fs: mockFs
      })
      ctx.nr = {
        mockFs,
        script
      }
    })

    await t.test('should throw an error if there is no frontmatter', async (t) => {
      const { mockFs, script } = t.nr
      mockFs.readFile.yields(null, JSON.stringify({ entries: [{ version: '1.2.3', changes: [] }] }))

      const func = () => script.getFrontMatter('v2.0.0', 'changelog.json')
      await assert.rejects(func, { message: 'Unable to find 2.0.0 entry in changelog.json' })
    })

    await t.test('should return our formatted frontmatter', async (t) => {
      const { mockFs, script } = t.nr
      mockFs.readFile.yields(
        null,
        JSON.stringify({
          entries: [
            {
              version: '2.0.0',
              changes: {
                security: ['one', 'two'],
                features: ['three', 'four'],
                bugfixes: ['five', 'six']
              }
            }
          ]
        })
      )

      const result = await script.getFrontMatter('v2.0.0', 'changelog.json')

      assert.deepEqual(result, {
        security: '["one","two"]',
        bugfixes: '["five","six"]',
        features: '["three","four"]'
      })
    })

    await t.test('should return empty arrays if missing changes', async (t) => {
      const { mockFs, script } = t.nr
      mockFs.readFile.yields(
        null,
        JSON.stringify({
          entries: [
            {
              version: '2.0.0',
              changes: {}
            }
          ]
        })
      )

      const result = await script.getFrontMatter('v2.0.0', 'changelog.json')

      assert.deepEqual(result, {
        security: '[]',
        bugfixes: '[]',
        features: '[]'
      })
    })
  })

  await t.test('formatReleaseNotes', async (t) => {
    t.beforeEach((ctx) => {
      const script = proxyquire(SCRIPT_PATH, {})
      ctx.nr = { script }
    })

    await t.test('should generate the release note markdown', (t) => {
      const { script } = t.nr
      const markdown = [
        '#### Stuff',
        '* commit number one',
        '#### Things',
        '* commit number two'
      ].join('\n')

      const frontmatter = {
        security: '["upgraded a dep"]',
        bugfixes: '["fixed a bug"]',
        features: '["added new api method"]'
      }
      const result = script.formatReleaseNotes('2020-04-03', 'v2.0.0', markdown, frontmatter)

      const expected = [
        '---',
        'subject: Node.js agent',
        "releaseDate: '2020-04-03'",
        'version: 2.0.0',
        "downloadLink: 'https://www.npmjs.com/package/newrelic'",
        'security: ["upgraded a dep"]',
        'bugs: ["fixed a bug"]',
        'features: ["added new api method"]',
        '---',
        '',
        '## Notes',
        '',
        '#### Stuff',
        '* commit number one',
        '#### Things',
        '* commit number two'
      ].join('\n')

      assert.equal(result, expected)
    })
  })
})
