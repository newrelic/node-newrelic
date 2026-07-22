/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { removeModules } = require('#testlib/cache-buster.js')

const SCRIPT_PATH = '../pending-prs'

function afterEach() {
  removeModules(['commander'])
}

const MockSlackApp = { client: { chat: { postMessage: sinon.stub() } } }
const MockSlackBolt = { App: sinon.stub().returns(MockSlackApp) }

test('Pending PRs script', async (t) => {
  await t.test('areEnvVarsSet', async (t) => {
    t.beforeEach((ctx) => {
      const script = proxyquire(SCRIPT_PATH, {
        './github': sinon.stub(),
        '@slack/bolt': MockSlackBolt
      })
      ctx.nr = { script }
    })

    t.afterEach(afterEach)

    await t.test('should return true when all required env vars are set', (t) => {
      const { script } = t.nr
      const savedEnv = {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        SLACK_CHANNEL: process.env.SLACK_CHANNEL,
        SLACK_TOKEN: process.env.SLACK_TOKEN,
        SLACK_SECRET: process.env.SLACK_SECRET
      }
      process.env.GITHUB_TOKEN = 'token'
      process.env.SLACK_CHANNEL = 'channel'
      process.env.SLACK_TOKEN = 'slack-token'
      process.env.SLACK_SECRET = 'secret'

      t.after(() => {
        Object.assign(process.env, savedEnv)
        for (const [k, v] of Object.entries(savedEnv)) {
          if (v === undefined) delete process.env[k]
        }
      })

      const result = script.areEnvVarsSet(false)

      assert.equal(result, true)
    })

    await t.test('should return true for dry-run when only GITHUB_TOKEN is set', (t) => {
      const { script } = t.nr
      const saved = process.env.GITHUB_TOKEN
      process.env.GITHUB_TOKEN = 'token'
      delete process.env.SLACK_CHANNEL
      delete process.env.SLACK_TOKEN
      delete process.env.SLACK_SECRET

      t.after(() => {
        if (saved !== undefined) process.env.GITHUB_TOKEN = saved
        else delete process.env.GITHUB_TOKEN
      })

      const result = script.areEnvVarsSet(true)

      assert.equal(result, true)
    })

    await t.test('should return false when required env vars are missing', (t) => {
      const { script } = t.nr
      const saved = {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        SLACK_CHANNEL: process.env.SLACK_CHANNEL,
        SLACK_TOKEN: process.env.SLACK_TOKEN,
        SLACK_SECRET: process.env.SLACK_SECRET
      }
      delete process.env.GITHUB_TOKEN
      delete process.env.SLACK_CHANNEL
      delete process.env.SLACK_TOKEN
      delete process.env.SLACK_SECRET

      t.after(() => {
        for (const [k, v] of Object.entries(saved)) {
          if (v !== undefined) process.env[k] = v
        }
      })

      const result = script.areEnvVarsSet(false)

      assert.equal(result, false)
    })
  })

  await t.test('createSlackMessage', async (t) => {
    t.beforeEach((ctx) => {
      const script = proxyquire(SCRIPT_PATH, {
        './github': sinon.stub(),
        '@slack/bolt': MockSlackBolt
      })
      ctx.nr = { script }
    })

    t.afterEach(afterEach)

    await t.test('should include the repo name, PR count, and release info', (t) => {
      const { script } = t.nr
      const prs = ['<https://github.com/newrelic/foo/pull/1 | (1) feat: add thing>']
      const latestRelease = { name: 'v1.2.3', published_at: '2024-01-01' }

      const result = script.createSlackMessage(prs, latestRelease, 'node-newrelic')

      assert.ok(result.includes('node-newrelic'))
      assert.ok(result.includes('1 PRs'))
      assert.ok(result.includes('v1.2.3'))
      assert.ok(result.includes('2024-01-01'))
      assert.ok(result.includes(prs[0]))
    })

    await t.test('should include all PRs in the message', (t) => {
      const { script } = t.nr
      const prs = [
        '<https://github.com/newrelic/foo/pull/1 | (1) fix: first>',
        '<https://github.com/newrelic/foo/pull/2 | (2) feat: second>'
      ]
      const latestRelease = { name: 'v1.0.0', published_at: '2024-01-01' }

      const result = script.createSlackMessage(prs, latestRelease, 'node-newrelic')

      assert.ok(result.includes('2 PRs'))
      assert.ok(result.includes(prs[0]))
      assert.ok(result.includes(prs[1]))
    })
  })

  await t.test('findMergedPRs', async (t) => {
    t.beforeEach((ctx) => {
      const mockGithubCommands = {
        getLatestRelease: sinon.stub(),
        getTagByName: sinon.stub(),
        getCommit: sinon.stub(),
        getMergedPullRequestsSince: sinon.stub()
      }
      const MockGithubSdk = sinon.stub().returns(mockGithubCommands)
      const script = proxyquire(SCRIPT_PATH, {
        './github': MockGithubSdk,
        '@slack/bolt': MockSlackBolt
      })
      ctx.nr = { mockGithubCommands, MockGithubSdk, script }
    })

    t.afterEach(afterEach)

    await t.test('should return formatted prs and latestRelease', async (t) => {
      const { mockGithubCommands, script } = t.nr
      const latestRelease = { name: 'v1.2.3', tag_name: 'v1.2.3', published_at: '2024-01-01', target_commitish: 'main' }
      mockGithubCommands.getLatestRelease.resolves(latestRelease)
      mockGithubCommands.getTagByName.resolves({ commit: { sha: 'abc123' } })
      mockGithubCommands.getCommit.resolves({ commit: { committer: { date: '2024-01-01T00:00:00Z' } } })
      mockGithubCommands.getMergedPullRequestsSince.resolves([
        { number: 2, title: 'feat: new thing', html_url: 'https://github.com/newrelic/foo/pull/2', labels: [], merge_commit_sha: 'def456' },
        { number: 1, title: 'fix: old thing', html_url: 'https://github.com/newrelic/foo/pull/1', labels: [], merge_commit_sha: 'ghi789' }
      ])

      const result = await script.findMergedPRs('node-newrelic', [])

      assert.equal(result.latestRelease, latestRelease)
      assert.equal(result.prs.length, 2)
      assert.ok(result.prs[0].includes('(1)'))
      assert.ok(result.prs[1].includes('(2)'))
    })

    await t.test('should filter out PRs with ignored labels', async (t) => {
      const { mockGithubCommands, script } = t.nr
      mockGithubCommands.getLatestRelease.resolves({ name: 'v1.2.3', tag_name: 'v1.2.3', published_at: '2024-01-01', target_commitish: 'main' })
      mockGithubCommands.getTagByName.resolves({ commit: { sha: 'abc123' } })
      mockGithubCommands.getCommit.resolves({ commit: { committer: { date: '2024-01-01T00:00:00Z' } } })
      mockGithubCommands.getMergedPullRequestsSince.resolves([
        { number: 1, title: 'chore: ignored', html_url: 'https://github.com/foo/1', labels: [{ name: 'skip-changelog' }], merge_commit_sha: 'aaa' },
        { number: 2, title: 'feat: kept', html_url: 'https://github.com/foo/2', labels: [], merge_commit_sha: 'bbb' }
      ])

      const result = await script.findMergedPRs('node-newrelic', ['skip-changelog'])

      assert.equal(result.prs.length, 1)
      assert.ok(result.prs[0].includes('(2)'))
    })

    await t.test('should filter out the PR whose commit sha matches the release tag', async (t) => {
      const { mockGithubCommands, script } = t.nr
      mockGithubCommands.getLatestRelease.resolves({ name: 'v1.2.3', tag_name: 'v1.2.3', published_at: '2024-01-01', target_commitish: 'main' })
      mockGithubCommands.getTagByName.resolves({ commit: { sha: 'tag-sha' } })
      mockGithubCommands.getCommit.resolves({ commit: { committer: { date: '2024-01-01T00:00:00Z' } } })
      mockGithubCommands.getMergedPullRequestsSince.resolves([
        { number: 1, title: 'chore: release notes', html_url: 'https://github.com/foo/1', labels: [], merge_commit_sha: 'tag-sha' },
        { number: 2, title: 'feat: real work', html_url: 'https://github.com/foo/2', labels: [], merge_commit_sha: 'other-sha' }
      ])

      const result = await script.findMergedPRs('node-newrelic', [])

      assert.equal(result.prs.length, 1)
      assert.ok(result.prs[0].includes('(2)'))
    })
  })
})
