/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
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
  subject: 'updated Thing to prevent modifications to inputs',
  merge: null,
  header: 'fix(thing)!: updated Thing to prevent modifications to inputs',
  body: 'Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output',
  footer: 'Fixes #1234, contributed by @someone',
  notes: [
    {
      title: 'BREAKING CHANGE',
      text: 'updated Thing to prevent modifications to inputs'
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

const exampleMarkdownNoSemverMajorCopy = `### v1.0.0 (2020-04-03)
#### ⚠ BREAKING CHANGES


* **thing:** updated Thing to prevent modifications to inputs

#### Bug fixes

* **thing:** updated Thing to prevent modifications to inputs ([#123](https://github.com/newrelic/node-newrelic/pull/123)), closes [1234](https://github.com/newrelic/testRepo/issues/1234)
    * Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output
`

const exampleMarkdown = `### v1.0.0 (2020-04-03)
#### ⚠ BREAKING CHANGES

This version of the Node.js agent is a SemVer MAJOR update and contains the following breaking changes. MAJOR versions may drop support for language runtimes that have reached End-of-Life according to the maintainer. Additionally, MAJOR versions may drop support for and remove certain instrumentation. For more details on these changes please see the [migration guide](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/update-nodejs-agent/).

* **thing:** updated Thing to prevent modifications to inputs

#### Bug fixes

* **thing:** updated Thing to prevent modifications to inputs ([#123](https://github.com/newrelic/node-newrelic/pull/123)), closes [1234](https://github.com/newrelic/node-newrelic/issues/1234)
    * Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output
`

test('Conventional Changelog Class', async (t) => {
  t.beforeEach((ctx) => {
    const clock = sinon.useFakeTimers(new Date('2020-04-03'))
    const mockGetPrByCommit = sinon.stub()
    const MockGithubSdk = sinon.stub().returns({
      getPullRequestByCommit: mockGetPrByCommit
    })

    const mockGitLog = new stream.Readable({ objectMode: true })

    const ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
      './github': MockGithubSdk,
      'git-raw-commits': sinon.stub().returns(mockGitLog)
    })
    ctx.nr = {
      clock,
      mockGetPrByCommit,
      mockGitLog,
      MockGithubSdk,
      ConventionalChangelog
    }
  })

  t.afterEach((ctx) => {
    ctx.nr.clock.restore()
  })

  await t.test('rankedGroupSort - should order a list of groupings based on rank', (t) => {
    const { ConventionalChangelog } = t.nr
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })

    const groupedCommits = [
      { title: 'Build system', commits: [] },
      { title: 'Miscellaneous chores', commits: [] },
      { title: 'Continuous integration', commits: [] },
      { title: 'Documentation', commits: [] },
      { title: 'Features', commits: [] },
      { title: 'Bug fixes', commits: [] },
      { title: 'Performance improvements', commits: [] },
      { title: 'Code refactoring', commits: [] },
      { title: 'Reverts', commits: [] },
      { title: 'Security improvements', commits: [] },
      { title: 'Styles', commits: [] },
      { title: 'Tests', commits: [] }
    ]

    groupedCommits.sort(changelog.rankedGroupSort)

    assert.equal(groupedCommits[0].title, 'Features')
    assert.equal(groupedCommits[1].title, 'Bug fixes')
    assert.equal(groupedCommits[2].title, 'Security improvements')
    assert.equal(groupedCommits[3].title, 'Performance improvements')
    assert.equal(groupedCommits[4].title, 'Code refactoring')
    assert.equal(groupedCommits[5].title, 'Reverts')
    assert.equal(groupedCommits[6].title, 'Documentation')
    assert.equal(groupedCommits[7].title, 'Miscellaneous chores')
    assert.equal(groupedCommits[8].title, 'Styles')
    assert.equal(groupedCommits[9].title, 'Tests')
    assert.equal(groupedCommits[10].title, 'Continuous integration')
    assert.equal(groupedCommits[11].title, 'Build system')
  })

  await t.test('getFormattedCommits - should get a list of commits', async (t) => {
    const { ConventionalChangelog, mockGetPrByCommit, mockGitLog } = t.nr
    mockGetPrByCommit.resolves({
      html_url: 'https://github.com/newrelic/node-newrelic/pull/123',
      number: 123
    })
    mockGitLog.push(
      [
        'fix(thing)!: updated Thing to prevent modifications to inputs (#123)',
        'Thing no longer mutates provided inputs, but instead clones inputs before performing modifications. Thing will now always return an entirely new output',
        'Fixes #1234, contributed by @someone'
      ].join('\n')
    )
    mockGitLog.push('this is a non-conventional commit that should be dropped')
    mockGitLog.push(null)

    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    const commits = await changelog.getFormattedCommits()

    assert.equal(commits.length, 1)

    const commit = commits[0]
    assert.deepEqual(commit, exampleCommit)
  })

  await t.test('addPullRequestMetadata - should add pr info if available', async (t) => {
    const { mockGetPrByCommit, ConventionalChangelog } = t.nr
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

    assert.deepEqual(commits[0].pr, {
      url: 'https://github.com/newrelic/node-newrelic/pull/345',
      id: 345
    })
    assert.ok(!commits[1].pr)
  })

  await t.test('generateJsonChangelog - should create the new JSON changelog entry', (t) => {
    const { ConventionalChangelog } = t.nr
    const commits = [
      { type: 'fix', subject: 'Fixed issue one' },
      { type: 'fix', subject: 'Fixed issue two' },
      { type: 'feat', subject: 'Added something new' },
      { type: 'security', subject: 'Bumped some dep' }
    ]
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })

    const jsonEntry = changelog.generateJsonChangelog(commits)
    assert.deepEqual(jsonEntry, exampleJson)
  })

  await t.test(
    'generateMarkdownChangelog - should create the new Markdown changelog entry',
    async (t) => {
      const { ConventionalChangelog } = t.nr
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
      const markdown = await changelog.generateMarkdownChangelog([exampleCommit])
      assert.equal(markdown, exampleMarkdown)
    }
  )

  await t.test(
    'generateMarkdownChangelog - should create the new Markdown changelog entry, skip semver major copy',
    async (t) => {
      const { ConventionalChangelog } = t.nr
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0', repo: 'testRepo' })
      const markdown = await changelog.generateMarkdownChangelog([exampleCommit])
      assert.equal(markdown, exampleMarkdownNoSemverMajorCopy)
    }
  )

  await t.test(
    'writeMarkdownChangelog - should not update the markdown file if notes already exist',
    async (t) => {
      const { MockGithubSdk, mockGitLog } = t.nr
      const mockReadFile = sinon.stub().resolves('### v1.0.0')
      const mockWriteFile = sinon.stub()

      const ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
        './github': MockGithubSdk,
        'git-raw-commits': sinon.stub().returns(mockGitLog),
        'node:fs/promises': {
          readFile: mockReadFile,
          writeFile: mockWriteFile
        }
      })
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
      await changelog.writeMarkdownChangelog(exampleMarkdown)

      assert.equal(mockWriteFile.callCount, 0)
    }
  )

  await t.test('writeMarkdownChangelog - should update the markdown file', async (t) => {
    const { MockGithubSdk, mockGitLog } = t.nr
    const mockReadFile = sinon.stub().resolves('### v0.9.0')
    const mockWriteFile = sinon.stub().resolves()

    const ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
      './github': MockGithubSdk,
      'git-raw-commits': sinon.stub().returns(mockGitLog),
      'node:fs/promises': {
        readFile: mockReadFile,
        writeFile: mockWriteFile
      }
    })
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    await changelog.writeMarkdownChangelog(exampleMarkdown)

    assert.equal(mockWriteFile.callCount, 1)
    assert.match(mockWriteFile.args[0][0], /NEWS\.md/)
    assert.equal(mockWriteFile.args[0][1], `${exampleMarkdown}\n### v0.9.0`)
    assert.equal(mockWriteFile.args[0][2], 'utf-8')
  })

  await t.test(
    'writeJsonChangelog - should not update the json file if notes already exist',
    async (t) => {
      const { MockGithubSdk, mockGitLog } = t.nr
      const mockReadFile = sinon
        .stub()
        .resolves(JSON.stringify({ entries: [{ version: '1.0.0' }] }))
      const mockWriteFile = sinon.stub()

      const ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
        './github': MockGithubSdk,
        'git-raw-commits': sinon.stub().returns(mockGitLog),
        'node:fs/promises': {
          readFile: mockReadFile,
          writeFile: mockWriteFile
        }
      })
      const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
      await changelog.writeJsonChangelog(exampleJson)

      assert.equal(mockWriteFile.callCount, 0)
    }
  )

  await t.test('writeJsonChangelog - should update the json file', async (t) => {
    const { MockGithubSdk, mockGitLog } = t.nr
    const mockReadFile = sinon.stub().resolves(JSON.stringify({ entries: [{ version: '0.9.0' }] }))
    const mockWriteFile = sinon.stub().resolves()

    const ConventionalChangelog = proxyquire(CHANGELOG_PATH, {
      './github': MockGithubSdk,
      'git-raw-commits': sinon.stub().returns(mockGitLog),
      'node:fs/promises': {
        readFile: mockReadFile,
        writeFile: mockWriteFile
      }
    })
    const changelog = new ConventionalChangelog({ newVersion: '1.0.0', previousVersion: '0.9.0' })
    await changelog.writeJsonChangelog(exampleJson)

    assert.equal(mockWriteFile.callCount, 1)
    assert.match(mockWriteFile.args[0][0], /changelog\.json/)
    assert.equal(
      mockWriteFile.args[0][1],
      JSON.stringify({ entries: [{ ...exampleJson }, { version: '0.9.0' }] }, null, 2)
    )
    assert.equal(mockWriteFile.args[0][2], 'utf-8')
  })
})
