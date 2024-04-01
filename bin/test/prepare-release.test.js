/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { getReleaseDate } = require('../prepare-release')

tap.test('Prepare Release script', (testHarness) => {
  testHarness.autoend()

  testHarness.test('generateConventionalReleaseNotes', (t) => {
    t.autoend()

    let mockConventionalCommands
    let MockConventionalChangelog
    let mockGithubCommands
    let MockGithubSdk
    let script

    t.beforeEach(() => {
      mockConventionalCommands = {
        getFormattedCommits: sinon.stub(),
        generateMarkdownChangelog: sinon.stub(),
        generateJsonChangelog: sinon.stub(),
        writeMarkdownChangelog: sinon.stub(),
        writeJsonChangelog: sinon.stub()
      }
      MockConventionalChangelog = sinon.stub().returns(mockConventionalCommands)

      mockGithubCommands = {
        getLatestRelease: sinon.stub()
      }
      MockGithubSdk = sinon.stub().returns(mockGithubCommands)

      script = proxyquire('../prepare-release', {
        './github': MockGithubSdk,
        './conventional-changelog': MockConventionalChangelog
      })
    })

    t.test('should return the markdown and json generated notes', async (t) => {
      mockGithubCommands.getLatestRelease.resolves({ tag_name: 'v1.2.3' })
      const expectedCommits = [{ title: 'stuff: commit number one' }]
      mockConventionalCommands.getFormattedCommits.resolves(expectedCommits)
      const expectedMarkdown = `
      ### v2.0.0

      #### Stuff
        * commit number 1

      ### v1.2.3
      `
      mockConventionalCommands.generateMarkdownChangelog.resolves(expectedMarkdown)
      const expectedJson = {
        entries: [
          { version: '2.0.0', changes: [{ type: 'stuff', subject: 'commit number one' }] },
          { version: '1.2.3', changes: [] }
        ]
      }
      mockConventionalCommands.generateJsonChangelog.resolves(expectedJson)

      const [markdown, json] = await script.generateConventionalReleaseNotes({
        owner: 'org',
        repo: 'repo',
        newVersion: '2.0.0',
        markdownChangelog: 'NEWS.md',
        generateJsonChangelog: true
      })

      t.same(json, expectedJson)
      t.equal(markdown, expectedMarkdown)

      t.ok(MockGithubSdk.calledWith('org', 'repo'))
      t.ok(
        MockConventionalChangelog.calledWith({
          org: 'org',
          repo: 'repo',
          newVersion: '2.0.0',
          previousVersion: '1.2.3'
        })
      )

      t.equal(mockConventionalCommands.getFormattedCommits.callCount, 1)

      t.ok(mockConventionalCommands.generateMarkdownChangelog.calledWith(expectedCommits))
      t.ok(mockConventionalCommands.generateJsonChangelog.calledWith(expectedCommits))

      t.ok(mockConventionalCommands.writeMarkdownChangelog.calledWith(expectedMarkdown, 'NEWS.md'))
      t.ok(mockConventionalCommands.writeJsonChangelog.calledWith(expectedJson))
    })

    t.test(
      'should not generate json file updates when generateJsonChangelog is false',
      async (t) => {
        mockGithubCommands.getLatestRelease.resolves({ tag_name: 'v1.2.3' })
        const expectedCommits = [{ title: 'stuff: commit number one' }]
        mockConventionalCommands.getFormattedCommits.resolves(expectedCommits)
        const expectedMarkdown = `
      ### v2.0.0

      #### Stuff
        * commit number 1

      ### v1.2.3
      `
        mockConventionalCommands.generateMarkdownChangelog.resolves(expectedMarkdown)
        const expectedJson = {
          entries: [
            { version: '2.0.0', changes: [{ type: 'stuff', subject: 'commit number one' }] },
            { version: '1.2.3', changes: [] }
          ]
        }
        mockConventionalCommands.generateJsonChangelog.resolves(expectedJson)

        const [markdown, json] = await script.generateConventionalReleaseNotes({
          owner: 'org',
          repo: 'repo',
          newVersion: '2.0.0',
          markdownChangelog: 'NEWS.md'
        })

        t.same(json, undefined)
        t.equal(markdown, expectedMarkdown)

        t.ok(mockConventionalCommands.generateMarkdownChangelog.calledWith(expectedCommits))
        t.ok(
          mockConventionalCommands.writeMarkdownChangelog.calledWith(expectedMarkdown, 'NEWS.md')
        )
        t.equal(mockConventionalCommands.generateJsonChangelog.callCount, 0)
        t.equal(mockConventionalCommands.writeJsonChangelog.callCount, 0)
      }
    )
  })

  testHarness.test('isValid', (t) => {
    t.autoend()

    let mockGitCommands
    let script

    t.beforeEach(() => {
      mockGitCommands = {
        getPushRemotes: sinon.stub(),
        getLocalChanges: sinon.stub(),
        getCurrentBranch: sinon.stub()
      }

      script = proxyquire('../prepare-release', {
        './git-commands': mockGitCommands
      })
    })

    t.test('should return true if force mode enabled', async (t) => {
      const result = await script.isValid({ force: true })

      t.equal(result, true)
      t.end()
    })

    t.test('should return true when all checks pass', async (t) => {
      mockGitCommands.getPushRemotes.resolves({ origin: 'stuff' })
      mockGitCommands.getLocalChanges.resolves([])
      mockGitCommands.getCurrentBranch.resolves('test-branch')

      const result = await script.isValid({ force: false, branch: 'test-branch', remote: 'origin' })

      t.equal(result, true)
      t.end()
    })

    t.test('should return false if one check fails', async (t) => {
      mockGitCommands.getPushRemotes.resolves({ origin: 'stuff' })
      mockGitCommands.getLocalChanges.resolves(['stuff'])
      mockGitCommands.getCurrentBranch.resolves('another-branch')

      const result = await script.isValid({
        force: false,
        branch: 'another-branch',
        remote: 'origin'
      })

      t.equal(result, false)
      t.end()
    })
  })
})

tap.test('getReleaseDate', async (t) => {
  t.beforeEach(async (t) => {
    t.context.now = Date.now
    Date.now = function now() {
      return new Date('2023-11-08T22:45:00.000-05:00').getTime()
    }
  })

  t.afterEach(async (t) => {
    Date.now = t.context.now
  })

  t.test('returns the correct string', async (t) => {
    const expected = '2023-11-08'
    const found = getReleaseDate()
    t.equal(found, expected)
  })
})
