/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const stream = require('node:stream')
const CHANGELOG_PATH = '../conventional-changelog.js'

const exampleJson = {
  version: '1.0.0',
  changes: {
    security: ['Bumped some dep'],
    features: ['Added something new'],
    bugfixes: ['Fixed issue one', 'Fixed issue two']
  }
}

const exampleCommit = {
  type: 'fix',
  scope: 'thing',
  subject: 'updated Thing to prevent accidental modifications to inputs',
  merge: null,
  header: 'fix(thing)!: updated Thing to prevent accidental modifications to inputs',
  body: 'Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output',
  footer: 'Fixes #1234, contributed by @someone',
  notes: [
    {
      title: 'BREAKING CHANGE',
      text: 'updated Thing to prevent accidental modifications to inputs'
    }
  ],
  references: [
    {
      action: 'Fixes',
      owner: null,
      repository: null,
      issue: '1234',
      raw: '#1234',
      prefix: '#'
    }
  ],
  mentions: ['someone'],
  revert: null,
  pr: {
    url: 'https://github.com/newrelic/node-newrelic/pull/123',
    id: 123
  }
}

const exampleMarkdown = `### v1.0.0 (2020-04-03)
#### ⚠ BREAKING CHANGES

* **thing:** updated Thing to prevent accidental modifications to inputs

#### Bug Fixes

* **thing:** updated Thing to prevent accidental modifications to inputs
  ([#123](https://github.com/newrelic/node-newrelic/pull/123)), closes [1234](https://github.com/newrelic/node-newrelic/issues/1234)
    * Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output
`

tap.test('Conventional Changelog Class', (testHarness) => {
  testHarness.autoend()

  let clock
  let MockGithubSdk
  let mockGetPrByCommit
  let mockGitLog
  let ConventionalChangelog

  testHarness.beforeEach(() => {
    clock = sinon.useFakeTimers(new Date('2020-04-03'))
    mockGetPrByCommit = sinon.stub()
    MockGithubSdk = sinon.stub().returns({
      getPullRequestByCommit: mockGetPrByCommit
    })

    mockGitLog = new stream.Readable({ objectMode: true })

    ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
      './github': MockGithubSdk,
      'git-raw-commits': sinon.stub().returns(mockGitLog)
    })
  })

  testHarness.afterEach(() => {
    clock.restore()
  })

  testHarness.test('rankedGroupSort - should order a list of groupings based on rank', (t) => {
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })

    const groupedCommits = [
      { title: 'Build System', commits: [] },
      { title: 'Miscellaneous Chores', commits: [] },
      { title: 'Continuous Integration', commits: [] },
      { title: 'Documentation', commits: [] },
      { title: 'Features', commits: [] },
      { title: 'Bug Fixes', commits: [] },
      { title: 'Performance Improvements', commits: [] },
      { title: 'Code Refactoring', commits: [] },
      { title: 'Reverts', commits: [] },
      { title: 'Security Improvements', commits: [] },
      { title: 'Styles', commits: [] },
      { title: 'Tests', commits: [] }
    ]

    groupedCommits.sort(changelog.rankedGroupSort)

    t.equal(groupedCommits[0].title, 'Features')
    t.equal(groupedCommits[1].title, 'Bug Fixes')
    t.equal(groupedCommits[2].title, 'Security Improvements')
    t.equal(groupedCommits[3].title, 'Performance Improvements')
    t.equal(groupedCommits[4].title, 'Code Refactoring')
    t.equal(groupedCommits[5].title, 'Reverts')
    t.equal(groupedCommits[6].title, 'Documentation')
    t.equal(groupedCommits[7].title, 'Miscellaneous Chores')
    t.equal(groupedCommits[8].title, 'Styles')
    t.equal(groupedCommits[9].title, 'Tests')
    t.equal(groupedCommits[10].title, 'Continuous Integration')
    t.equal(groupedCommits[11].title, 'Build System')

    t.end()
  })

  testHarness.test('getFormattedCommits - should get a list of commits', async (t) => {
    mockGetPrByCommit.resolves({
      html_url: 'https://github.com/newrelic/node-newrelic/pull/123',
      number: 123
    })
    mockGitLog.push(
      [
        'fix(thing)!: updated Thing to prevent accidental modifications to inputs',
        'Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output',
        'Fixes #1234, contributed by @someone'
      ].join('\n')
    )
    mockGitLog.push('this is a non-conventional commit that should be dropped')
    mockGitLog.push(null)

    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    const commits = await changelog.getFormattedCommits()

    t.equal(commits.length, 1)

    const commit = commits[0]
    t.same(commit, exampleCommit)

    t.end()
  })

  testHarness.test('addPullRequestMetadata - should add pr info if available', async (t) => {
    mockGetPrByCommit
      .onCall(0)
      .resolves({
        html_url: 'https://github.com/newrelic/node-newrelic/pull/345',
        number: 345
      })
      .onCall(1)
      .resolves(null)
    const commits = [
      {
        hash: 'commit-one'
      },
      {
        hash: 'commit-two'
      }
    ]

    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    await changelog.addPullRequestMetadata(commits)

    t.same(commits[0].pr, {
      url: 'https://github.com/newrelic/node-newrelic/pull/345',
      id: 345
    })
    t.notOk(commits[1].pr)

    t.end()
  })

  testHarness.test('generateJsonChangelog - should create the new JSON changelog entry', (t) => {
    const commits = [
      { type: 'fix', subject: 'Fixed issue one (#1234)' },
      { type: 'fix', subject: ' Fixed issue two' },
      { type: 'feat', subject: 'Added something new ' },
      { type: 'security', subject: ' Bumped some dep (#4567)' }
    ]
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })

    const jsonEntry = changelog.generateJsonChangelog(commits)
    t.same(jsonEntry, exampleJson)
    t.end()
  })

  testHarness.test(
    'generateMarkdownChangelog - should create the new Markdown changelog entry',
    async (t) => {
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
      const markdown = await changelog.generateMarkdownChangelog([exampleCommit])
      t.equal(markdown, exampleMarkdown)
      t.end()
    }
  )

  testHarness.test(
    'writeMarkdownChangelog - should not update the markdown file if notes already exist',
    async (t) => {
      const mockReadFile = sinon.stub().resolves('### v1.0.0')
      const mockWriteFile = sinon.stub()

      ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
        './github': MockGithubSdk,
        'git-raw-commits': sinon.stub().returns(mockGitLog),
        'node:fs/promises': {
          readFile: mockReadFile,
          writeFile: mockWriteFile
        }
      })
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
      await changelog.writeMarkdownChangelog(exampleMarkdown)

      t.equal(mockWriteFile.callCount, 0)
      t.end()
    }
  )

  testHarness.test('writeMarkdownChangelog - should update the markdown file', async (t) => {
    const mockReadFile = sinon.stub().resolves('### v0.9.0')
    const mockWriteFile = sinon.stub().resolves()

    ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
      './github': MockGithubSdk,
      'git-raw-commits': sinon.stub().returns(mockGitLog),
      'node:fs/promises': {
        readFile: mockReadFile,
        writeFile: mockWriteFile
      }
    })
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    await changelog.writeMarkdownChangelog(exampleMarkdown)

    t.equal(mockWriteFile.callCount, 1)
    t.match(mockWriteFile.args[0][0], 'NEWS.md')
    t.equal(mockWriteFile.args[0][1], `${exampleMarkdown}\n### v0.9.0`)
    t.equal(mockWriteFile.args[0][2], 'utf-8')
    t.end()
  })

  testHarness.test(
    'writeJsonChangelog - should not update the json file if notes already exist',
    async (t) => {
      const mockReadFile = sinon
        .stub()
        .resolves(JSON.stringify({ entries: [{ version: '1.0.0' }] }))
      const mockWriteFile = sinon.stub()

      ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
        './github': MockGithubSdk,
        'git-raw-commits': sinon.stub().returns(mockGitLog),
        'node:fs/promises': {
          readFile: mockReadFile,
          writeFile: mockWriteFile
        }
      })
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
      await changelog.writeJsonChangelog(exampleJson)

      t.equal(mockWriteFile.callCount, 0)
      t.end()
    }
  )

  testHarness.test('writeJsonChangelog - should update the json file', async (t) => {
    const mockReadFile = sinon.stub().resolves(JSON.stringify({ entries: [{ version: '0.9.0' }] }))
    const mockWriteFile = sinon.stub().resolves()

    ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
      './github': MockGithubSdk,
      'git-raw-commits': sinon.stub().returns(mockGitLog),
      'node:fs/promises': {
        readFile: mockReadFile,
        writeFile: mockWriteFile
      }
    })
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    await changelog.writeJsonChangelog(exampleJson)

    t.equal(mockWriteFile.callCount, 1)
    t.match(mockWriteFile.args[0][0], 'changelog.json')
    t.equal(
      mockWriteFile.args[0][1],
      JSON.stringify({ entries: [{ ...exampleJson }, { version: '0.9.0' }] }, null, 2)
    )
    t.equal(mockWriteFile.args[0][2], 'utf-8')
    t.end()
  })
})
