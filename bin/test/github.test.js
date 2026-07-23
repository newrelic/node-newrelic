/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire').noPreserveCache()
const sinon = require('sinon')

test('Github', async (t) => {
  t.beforeEach((ctx) => {
    const mockOctokit = {
      repos: {
        getLatestRelease: sinon.stub(),
        getReleaseByTag: sinon.stub(),
        createRelease: sinon.stub(),
        listTags: sinon.stub(),
        getCommit: sinon.stub(),
        listPullRequestsAssociatedWithCommit: sinon.stub(),
        updateRelease: sinon.stub()
      },
      pulls: {
        list: sinon.stub(),
        create: sinon.stub()
      },
      actions: {
        listWorkflowRuns: sinon.stub()
      }
    }

    const Github = proxyquire('../github', {
      '@octokit/rest': { Octokit: sinon.stub().returns(mockOctokit) }
    })

    const github = new Github('testowner', 'testrepo')
    ctx.nr = { mockOctokit, Github, github }
  })

  t.afterEach(() => {
    sinon.restore()
  })

  await t.test('getLatestRelease', async (t) => {
    await t.test('returns release data', async (t) => {
      const { mockOctokit, github } = t.nr
      const expected = { id: 1, tag_name: 'v1.0.0' }
      mockOctokit.repos.getLatestRelease.resolves({ data: expected })

      const result = await github.getLatestRelease()

      assert.deepEqual(result, expected)
      assert.deepEqual(mockOctokit.repos.getLatestRelease.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo'
      })
    })
  })

  await t.test('getReleaseByTag', async (t) => {
    await t.test('returns release data for the given tag', async (t) => {
      const { mockOctokit, github } = t.nr
      const expected = { id: 2, tag_name: 'v2.0.0' }
      mockOctokit.repos.getReleaseByTag.resolves({ data: expected })

      const result = await github.getReleaseByTag('v2.0.0')

      assert.deepEqual(result, expected)
      assert.deepEqual(mockOctokit.repos.getReleaseByTag.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo',
        tag: 'v2.0.0'
      })
    })
  })

  await t.test('createRelease', async (t) => {
    await t.test('creates a release and returns its data', async (t) => {
      const { mockOctokit, github } = t.nr
      const expected = { id: 3, tag_name: 'v3.0.0' }
      mockOctokit.repos.createRelease.resolves({ data: expected })

      const result = await github.createRelease('v3.0.0', 'v3.0.0', 'release notes')

      assert.deepEqual(result, expected)
      assert.deepEqual(mockOctokit.repos.createRelease.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo',
        tag_name: 'v3.0.0',
        name: 'v3.0.0',
        body: 'release notes'
      })
    })
  })

  await t.test('getTagByName', async (t) => {
    await t.test('returns the tag when found on the first page', async (t) => {
      const { mockOctokit, github } = t.nr
      const tags = [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]
      mockOctokit.repos.listTags.resolves({ data: tags })

      const result = await github.getTagByName('v2.0.0')

      assert.deepEqual(result, { name: 'v2.0.0' })
      assert.equal(mockOctokit.repos.listTags.callCount, 1)
    })

    await t.test('paginates until the tag is found', async (t) => {
      const { mockOctokit, github } = t.nr
      const page1 = Array.from({ length: 100 }, (_, i) => { return { name: `v${i}.0.0` } })
      const page2 = [{ name: 'v100.0.0' }, { name: 'v101.0.0' }]
      mockOctokit.repos.listTags
        .onFirstCall().resolves({ data: page1 })
        .onSecondCall().resolves({ data: page2 })

      const result = await github.getTagByName('v101.0.0')

      assert.deepEqual(result, { name: 'v101.0.0' })
      assert.equal(mockOctokit.repos.listTags.callCount, 2)
    })

    await t.test('returns null when the tag is not found', async (t) => {
      const { mockOctokit, github } = t.nr
      mockOctokit.repos.listTags.resolves({ data: [{ name: 'v1.0.0' }] })

      const result = await github.getTagByName('v99.0.0')

      assert.equal(result, null)
    })
  })

  await t.test('getCommit', async (t) => {
    await t.test('returns commit data for the given sha', async (t) => {
      const { mockOctokit, github } = t.nr
      const expected = { sha: 'abc123', commit: { message: 'chore: update' } }
      mockOctokit.repos.getCommit.resolves({ data: expected })

      const result = await github.getCommit('abc123')

      assert.deepEqual(result, expected)
      assert.deepEqual(mockOctokit.repos.getCommit.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo',
        ref: 'abc123'
      })
    })
  })

  await t.test('getMergedPullRequestsSince', async (t) => {
    await t.test('returns only PRs merged after the given date', async (t) => {
      const { mockOctokit, github } = t.nr
      const prs = [
        { number: 1, merged_at: '2023-06-01T00:00:00Z', merge_commit_sha: 'aaa' },
        { number: 2, merged_at: '2022-12-01T00:00:00Z', merge_commit_sha: 'bbb' },
        { number: 3, merged_at: '2023-03-01T00:00:00Z', merge_commit_sha: 'ccc' }
      ]
      mockOctokit.pulls.list.resolves({ data: prs })

      const result = await github.getMergedPullRequestsSince('2023-01-01T00:00:00Z')

      assert.equal(result.length, 2)
      assert.ok(result.some((pr) => pr.number === 1))
      assert.ok(result.some((pr) => pr.number === 3))
    })

    await t.test('excludes PRs that were not merged', async (t) => {
      const { mockOctokit, github } = t.nr
      const prs = [
        { number: 1, merged_at: null, merge_commit_sha: 'aaa' },
        { number: 2, merged_at: '2023-06-01T00:00:00Z', merge_commit_sha: 'bbb' }
      ]
      mockOctokit.pulls.list.resolves({ data: prs })

      const result = await github.getMergedPullRequestsSince('2023-01-01T00:00:00Z')

      assert.equal(result.length, 1)
      assert.equal(result[0].number, 2)
    })

    await t.test('paginates while pages contain recently merged PRs', async (t) => {
      const { mockOctokit, github } = t.nr
      const page1 = Array.from({ length: 50 }, (_, i) => { return { number: i + 1, merged_at: '2023-06-01T00:00:00Z', merge_commit_sha: `sha${i}` } })
      mockOctokit.pulls.list
        .onFirstCall().resolves({ data: page1 })
        .onSecondCall().resolves({ data: [] })

      const result = await github.getMergedPullRequestsSince('2023-01-01T00:00:00Z')

      assert.equal(result.length, 50)
      assert.equal(mockOctokit.pulls.list.callCount, 2)
    })

    await t.test('stops paginating when a page has no recently merged PRs', async (t) => {
      const { mockOctokit, github } = t.nr
      const page1 = Array.from({ length: 50 }, (_, i) => { return { number: i + 1, merged_at: '2023-06-01T00:00:00Z', merge_commit_sha: `sha${i}` } })
      const page2 = Array.from({ length: 50 }, (_, i) => { return { number: i + 51, merged_at: '2022-06-01T00:00:00Z', merge_commit_sha: `sha${i + 50}` } })
      mockOctokit.pulls.list
        .onFirstCall().resolves({ data: page1 })
        .onSecondCall().resolves({ data: page2 })

      const result = await github.getMergedPullRequestsSince('2023-01-01T00:00:00Z')

      assert.equal(result.length, 50)
      assert.equal(mockOctokit.pulls.list.callCount, 2)
    })
  })

  await t.test('getPullRequestByCommit', async (t) => {
    await t.test('returns the first associated PR', async (t) => {
      const { mockOctokit, github } = t.nr
      const prs = [{ number: 10, title: 'feat: stuff' }, { number: 11, title: 'other' }]
      mockOctokit.repos.listPullRequestsAssociatedWithCommit.resolves({ data: prs })

      const result = await github.getPullRequestByCommit('abc123')

      assert.deepEqual(result, prs[0])
      assert.deepEqual(mockOctokit.repos.listPullRequestsAssociatedWithCommit.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo',
        commit_sha: 'abc123'
      })
    })

    await t.test('returns undefined when no PRs are associated', async (t) => {
      const { mockOctokit, github } = t.nr
      mockOctokit.repos.listPullRequestsAssociatedWithCommit.resolves({ data: [] })

      const result = await github.getPullRequestByCommit('abc123')

      assert.equal(result, undefined)
    })
  })

  await t.test('getLatestWorkflowRun', async (t) => {
    await t.test('returns the first (most recent) workflow run', async (t) => {
      const { mockOctokit, github } = t.nr
      const runs = [{ id: 100, status: 'completed' }, { id: 99, status: 'completed' }]
      mockOctokit.actions.listWorkflowRuns.resolves({ data: { workflow_runs: runs } })

      const result = await github.getLatestWorkflowRun('ci.yml', 'main')

      assert.deepEqual(result, runs[0])
      assert.deepEqual(mockOctokit.actions.listWorkflowRuns.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo',
        workflow_id: 'ci.yml',
        branch: 'main',
        per_page: 5
      })
    })
  })

  await t.test('createPR', async (t) => {
    await t.test('calls the API with the provided options', async (t) => {
      const { mockOctokit, github } = t.nr
      mockOctokit.pulls.create.resolves({ data: { number: 42 } })

      await github.createPR({
        head: 'feat-branch',
        base: 'main',
        title: 'feat: new',
        body: 'description',
        draft: true
      })

      assert.deepEqual(mockOctokit.pulls.create.firstCall.args[0], {
        owner: 'testowner',
        repo: 'testrepo',
        head: 'feat-branch',
        base: 'main',
        title: 'feat: new',
        body: 'description',
        draft: true
      })
    })
  })

  await t.test('updateRelease', async (t) => {
    await t.test('returns the API response on success', async (t) => {
      const { mockOctokit, github } = t.nr
      const expected = { data: { id: 1, body: 'updated notes' } }
      mockOctokit.repos.updateRelease.resolves(expected)

      const result = await github.updateRelease({ id: 1, body: 'updated notes' })

      assert.deepEqual(result, expected)
      assert.equal(mockOctokit.repos.updateRelease.callCount, 1)
    })

    await t.test('retries on failure and resolves when a subsequent attempt succeeds', async (t) => {
      const { mockOctokit, github } = t.nr
      const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] })
      const expected = { data: { id: 1 } }
      mockOctokit.repos.updateRelease
        .onFirstCall().rejects(new Error('network error'))
        .onSecondCall().resolves(expected)

      const promise = github.updateRelease({ id: 1, body: 'notes' })
      await clock.tickAsync(2000)
      const result = await promise

      assert.deepEqual(result, expected)
      assert.equal(mockOctokit.repos.updateRelease.callCount, 2)
    })

    await t.test('throws after exceeding max retries', async (t) => {
      const { mockOctokit, github } = t.nr
      const clock = sinon.useFakeTimers({ toFake: ['setTimeout'] })
      mockOctokit.repos.updateRelease.rejects(new Error('persistent error'))

      const promise = github.updateRelease({ id: 1, body: 'notes' })
      // Register the rejection handler before ticking so Node doesn't see an unhandled rejection
      const assertion = assert.rejects(promise, /Unable to update release with backoff/)
      // tick through all three retry waits: 2s, 4s, 8s
      await clock.tickAsync(14000)
      await assertion
    })
  })
})
