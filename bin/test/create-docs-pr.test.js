/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const SCRIPT_PATH = '../create-docs-pr'

tap.test('Create Docs PR script', (testHarness) => {
  testHarness.autoend()

  testHarness.test('getReleaseNotes', (t) => {
    t.autoend()

    let mockFs
    let script

    t.beforeEach(() => {
      mockFs = {
        readFile: sinon.stub()
      }
      script = proxyquire(SCRIPT_PATH, {
        fs: mockFs
      })
    })

    t.test('should return our release notes', async (t) => {
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

      t.equal(result.releaseDate, '2020-04-03')

      const body = result.body.split('\n')
      t.equal(body[0], '#### Stuff heading')
      t.equal(body[1], '* first commit')
      t.equal(body[4], '### Support statement:')

      t.end()
    })
  })

  testHarness.test('getFrontMatter', (t) => {
    t.autoend()

    let mockFs
    let script

    t.beforeEach(() => {
      mockFs = {
        readFile: sinon.stub()
      }
      script = proxyquire(SCRIPT_PATH, {
        fs: mockFs
      })
    })

    t.test('should throw an error if there is no frontmatter', async (t) => {
      mockFs.readFile.yields(null, JSON.stringify({ entries: [{ version: '1.2.3', changes: [] }] }))

      const func = () => script.getFrontMatter('v2.0.0', 'changelog.json')
      t.rejects(func, 'Unable to find 2.0.0 entry in changelog.json')

      t.end()
    })

    t.test('should return our formatted frontmatter', async (t) => {
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

      t.same(result, {
        security: '["one","two"]',
        bugfixes: '["five","six"]',
        features: '["three","four"]'
      })
      t.end()
    })
  })

  testHarness.test('formatReleaseNotes', (t) => {
    t.autoend()

    let script

    t.beforeEach(() => {
      script = proxyquire(SCRIPT_PATH, {})
    })

    t.test('should generate the release note markdown', (t) => {
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
        `releaseDate: '2020-04-03'`,
        'version: 2.0.0',
        `downloadLink: 'https://www.npmjs.com/package/newrelic'`,
        `security: ["upgraded a dep"]`,
        `bugs: ["fixed a bug"]`,
        `features: ["added new api method"]`,
        `---`,
        '',
        '## Notes',
        '',
        '#### Stuff',
        '* commit number one',
        '#### Things',
        '* commit number two'
      ].join('\n')

      t.equal(result, expected)

      t.end()
    })
  })
})
