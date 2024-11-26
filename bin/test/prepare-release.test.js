/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { getReleaseDate } = require('../prepare-release')

test('Prepare Release script', async (t) => {
  await t.test('generateConventionalReleaseNotes', async (t) => {
    t.beforeEach((ctx) => {
      const mockConventionalCommands = {
        getFormattedCommits: sinon.stub(),
        generateMarkdownChangelog: sinon.stub(),
        generateJsonChangelog: sinon.stub(),
        writeMarkdownChangelog: sinon.stub(),
        writeJsonChangelog: sinon.stub()
      }
      const MockConventionalChangelog = sinon.stub().returns(mockConventionalCommands)

      const mockGithubCommands = {
        getLatestRelease: sinon.stub()
      }
      const MockGithubSdk = sinon.stub().returns(mockGithubCommands)

      const script = proxyquire('../prepare-release', {
        './github': MockGithubSdk,
        './conventional-changelog': MockConventionalChangelog
      })
      ctx.nr = {
        mockConventionalCommands,
        MockConventionalChangelog,
        mockGithubCommands,
        MockGithubSdk,
        script
      }
    })

    await t.test('should return the markdown and json generated notes', async (t) => {
      const {
        mockGithubCommands,
        MockConventionalChangelog,
        MockGithubSdk,
        mockConventionalCommands,
        script
      } = t.nr
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

      assert.deepEqual(json, expectedJson)
      assert.equal(markdown, expectedMarkdown)

      assert.ok(MockGithubSdk.calledWith('org', 'repo'))
      assert.ok(
        MockConventionalChangelog.calledWith({
          org: 'org',
          repo: 'repo',
          newVersion: '2.0.0',
          previousVersion: '1.2.3'
        })
      )

      assert.equal(mockConventionalCommands.getFormattedCommits.callCount, 1)

      assert.ok(mockConventionalCommands.generateMarkdownChangelog.calledWith(expectedCommits))
      assert.ok(mockConventionalCommands.generateJsonChangelog.calledWith(expectedCommits))

      assert.ok(
        mockConventionalCommands.writeMarkdownChangelog.calledWith(expectedMarkdown, 'NEWS.md')
      )
      assert.ok(mockConventionalCommands.writeJsonChangelog.calledWith(expectedJson))
    })

    await t.test(
      'should not generate json file updates when generateJsonChangelog is false',
      async (t) => {
        const { mockGithubCommands, mockConventionalCommands, script } = t.nr
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

        assert.deepEqual(json, undefined)
        assert.equal(markdown, expectedMarkdown)

        assert.ok(mockConventionalCommands.generateMarkdownChangelog.calledWith(expectedCommits))
        assert.ok(
          mockConventionalCommands.writeMarkdownChangelog.calledWith(expectedMarkdown, 'NEWS.md')
        )
        assert.equal(mockConventionalCommands.generateJsonChangelog.callCount, 0)
        assert.equal(mockConventionalCommands.writeJsonChangelog.callCount, 0)
      }
    )
  })

  await t.test('isValid', async (t) => {
    t.beforeEach((ctx) => {
      const mockGitCommands = {
        getPushRemotes: sinon.stub(),
        getLocalChanges: sinon.stub(),
        getCurrentBranch: sinon.stub()
      }

      const script = proxyquire('../prepare-release', {
        './git-commands': mockGitCommands
      })
      ctx.nr = {
        mockGitCommands,
        script
      }
    })

    await t.test('should return true if force mode enabled', async (t) => {
      const { script } = t.nr
      const result = await script.isValid({ force: true })

      assert.equal(result, true)
    })

    await t.test('should return true when all checks pass', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getPushRemotes.resolves({ origin: 'stuff' })
      mockGitCommands.getLocalChanges.resolves([])
      mockGitCommands.getCurrentBranch.resolves('test-branch')

      const result = await script.isValid({ force: false, branch: 'test-branch', remote: 'origin' })

      assert.equal(result, true)
    })

    await t.test('should return false if one check fails', async (t) => {
      const { mockGitCommands, script } = t.nr
      mockGitCommands.getPushRemotes.resolves({ origin: 'stuff' })
      mockGitCommands.getLocalChanges.resolves(['stuff'])
      mockGitCommands.getCurrentBranch.resolves('another-branch')

      const result = await script.isValid({
        force: false,
        branch: 'another-branch',
        remote: 'origin'
      })

      assert.equal(result, false)
    })
  })
})

test('getReleaseDate', async (t) => {
  t.beforeEach(async (ctx) => {
    const now = Date.now
    Date.now = function now() {
      return new Date('2023-11-08T22:45:00.000-05:00').getTime()
    }
    ctx.nr = { now }
  })

  t.afterEach(async (ctx) => {
    Date.now = ctx.nr.now
  })

  await t.test('returns the correct string', async () => {
    const expected = '2023-11-08'
    const found = getReleaseDate()
    assert.equal(found, expected)
  })
})
