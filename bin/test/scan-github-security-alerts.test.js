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

const SCRIPT_PATH = '../scan-github-security-alerts'

function beforeEach(ctx) {
  const sandox = sinon.createSandbox()
  console.log = sandox.stub()
  console.error = sandox.stub()
  const octokit = { request: sandox.stub() }
  const MockOctokitRest = { Octokit: sandox.stub().returns(octokit) }
  const slackApp = { client: { chat: { postMessage: sandox.stub() } } }
  const MockSlackBolt = { App: sandox.stub().returns(slackApp) }
  const script = proxyquire(SCRIPT_PATH, {
    '@octokit/rest': MockOctokitRest,
    '@slack/bolt': MockSlackBolt
  })
  ctx.nr = { script, sandox, octokit, slackApp }
}

function afterEach(ctx) {
  removeModules(['commander'])
  ctx.nr.sandox.restore()
}

test('scan-github-security-alerts', async (t) => {
  await t.test('areEnvVarsSet', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should return true when all required env vars are set', (t) => {
      const { script } = t.nr
      const saved = {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        SLACK_CHANNEL: process.env.SLACK_CHANNEL,
        SLACK_TOKEN: process.env.SLACK_TOKEN,
        SLACK_SECRET: process.env.SLACK_SECRET
      }
      process.env.GITHUB_TOKEN = 'token'
      process.env.SLACK_CHANNEL = 'slack-channel'
      process.env.SLACK_TOKEN = 'slack-token'
      process.env.SLACK_SECRET = 'secret'

      t.after(() => {
        for (const [k, v] of Object.entries(saved)) {
          if (v !== undefined) process.env[k] = v
          else delete process.env[k]
        }
      })

      assert.equal(script.areEnvVarsSet(false), true)
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

      assert.equal(script.areEnvVarsSet(true), true)
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

      assert.equal(script.areEnvVarsSet(false), false)
    })
  })

  await t.test('fetchSecretScanningAlerts', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should return alert data on success', async (t) => {
      const { script, octokit } = t.nr
      const alerts = [
        { number: 3, html_url: 'https://github.com/newrelic/node-newrelic/security/secret-scanning/3', secret_type: 'github_personal_access_token', secret_type_display_name: 'GitHub Personal Access Token' }
      ]
      octokit.request.resolves({ data: alerts })
      const result = await script.fetchSecretScanningAlerts(octokit, 'node-newrelic')

      assert.deepEqual(result, alerts)
      assert.equal(octokit.request.firstCall.args[0], 'GET /repos/{owner}/{repo}/secret-scanning/alerts')
      assert.equal(octokit.request.firstCall.args[1].repo, 'node-newrelic')
      assert.equal(octokit.request.firstCall.args[1].state, 'open')
    })

    await t.test('should return empty array when secret scanning is not enabled (404)', async (t) => {
      const { script, octokit } = t.nr
      octokit.request.rejects(Object.assign(new Error('Not Found'), { status: 404 }))

      const result = await script.fetchSecretScanningAlerts(octokit, 'node-newrelic')

      assert.deepEqual(result, [])
    })

    await t.test('should rethrow non-404 errors', async (t) => {
      const { script, octokit } = t.nr
      octokit.request.rejects(Object.assign(new Error('Server Error'), { status: 500 }))

      await assert.rejects(
        () => script.fetchSecretScanningAlerts(octokit, 'node-newrelic'),
        /Server Error/
      )
    })
  })

  await t.test('fetchCodeScanningAlerts', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should return alert data on success', async (t) => {
      const { script, octokit } = t.nr
      const alerts = [
        {
          number: 75,
          html_url: 'https://github.com/newrelic/node-newrelic/security/code-scanning/75',
          rule: { id: 'js/incomplete-url-scheme-check', description: 'Incomplete URL scheme check', severity: 'high' },
          tool: { name: 'CodeQL' }
        }
      ]
      octokit.request.resolves({ data: alerts })

      const result = await script.fetchCodeScanningAlerts(octokit, 'node-newrelic')

      assert.deepEqual(result, alerts)
      assert.equal(octokit.request.firstCall.args[0], 'GET /repos/{owner}/{repo}/code-scanning/alerts')
      assert.equal(octokit.request.firstCall.args[1].repo, 'node-newrelic')
      assert.equal(octokit.request.firstCall.args[1].state, 'open')
    })

    await t.test('should return empty array when code scanning is not enabled (404)', async (t) => {
      const { script, octokit } = t.nr
      octokit.request.rejects(Object.assign(new Error('Not Found'), { status: 404 }))

      const result = await script.fetchCodeScanningAlerts(octokit, 'node-newrelic')

      assert.deepEqual(result, [])
    })

    await t.test('should rethrow non-404 errors', async (t) => {
      const { script, octokit } = t.nr
      octokit.request.rejects(Object.assign(new Error('Forbidden'), { status: 403 }))

      await assert.rejects(
        () => script.fetchCodeScanningAlerts(octokit, 'node-newrelic'),
        /Forbidden/
      )
    })
  })

  await t.test('buildSecretAlertBlocks', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)
      const alert = {
        number: 3,
        html_url: 'https://github.com/newrelic/node-newrelic/security/secret-scanning/3',
        secret_type: 'github_personal_access_token',
        secret_type_display_name: 'GitHub Personal Access Token'
      }
      ctx.nr.alert = alert
    })

    t.afterEach(afterEach)

    await t.test('should set the header to "Secret Scanning Alert"', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildSecretAlertBlocks('node-newrelic', alert)
      const header = blocks.find((b) => b.type === 'header')

      assert.equal(header.text.text, 'Secret Scanning Alert')
    })

    await t.test('should include a linked repository field', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildSecretAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const repoField = section.fields.find((f) => f.text.includes('Repository'))

      assert.ok(repoField.text.includes('https://github.com/newrelic/node-newrelic'))
      assert.ok(repoField.text.includes('newrelic/node-newrelic'))
    })

    await t.test('should include the secret type display name in the details field', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildSecretAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const detailField = section.fields.find((f) => f.text.includes('Details'))

      assert.ok(detailField.text.includes('GitHub Personal Access Token'))
    })

    await t.test('should fall back to secret_type when secret_type_display_name is absent', (t) => {
      const { script } = t.nr
      const alert = {
        number: 3,
        html_url: 'https://github.com/newrelic/node-newrelic/security/secret-scanning/3',
        secret_type: 'github_personal_access_token',
        secret_type_display_name: null
      }
      const blocks = script.buildSecretAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const detailField = section.fields.find((f) => f.text.includes('Details'))

      assert.ok(detailField.text.includes('github_personal_access_token'))
    })

    await t.test('should include a button linking to the alert', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildSecretAlertBlocks('node-newrelic', alert)
      const actions = blocks.find((b) => b.type === 'actions')
      const button = actions.elements[0]

      assert.equal(button.type, 'button')
      assert.equal(button.text.text, 'Alert #3')
      assert.equal(button.url, alert.html_url)
    })
  })

  await t.test('buildCodeAlertBlocks', async (t) => {
    t.beforeEach((ctx) => {
      beforeEach(ctx)
      const alert = {
        number: 75,
        html_url: 'https://github.com/newrelic/node-newrelic/security/code-scanning/75',
        rule: { id: 'js/incomplete-url-scheme-check', description: 'Incomplete URL scheme check', severity: 'high' },
        tool: { name: 'CodeQL' }
      }
      ctx.nr.alert = alert
    })

    t.afterEach(afterEach)

    await t.test('should set the header to "Code Scanning Alert"', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildCodeAlertBlocks('node-newrelic', alert)
      const header = blocks.find((b) => b.type === 'header')

      assert.equal(header.text.text, 'Code Scanning Alert')
    })

    await t.test('should include a linked repository field', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildCodeAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const repoField = section.fields.find((f) => f.text.includes('Repository'))

      assert.ok(repoField.text.includes('https://github.com/newrelic/node-newrelic'))
      assert.ok(repoField.text.includes('newrelic/node-newrelic'))
    })

    await t.test('should include rule description, uppercased severity, and tool name in the details field', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildCodeAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const detailField = section.fields.find((f) => f.text.includes('Details'))

      assert.ok(detailField.text.includes('Incomplete URL scheme check'))
      assert.ok(detailField.text.includes('HIGH'))
      assert.ok(detailField.text.includes('CodeQL'))
    })

    await t.test('should fall back to rule.id when rule.description is absent', (t) => {
      const { script } = t.nr
      const alert = {
        number: 75,
        html_url: 'https://github.com/newrelic/node-newrelic/security/code-scanning/75',
        rule: { id: 'js/incomplete-url-scheme-check', description: null, severity: 'high' },
        tool: { name: 'CodeQL' }
      }
      const blocks = script.buildCodeAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const detailField = section.fields.find((f) => f.text.includes('Details'))

      assert.ok(detailField.text.includes('js/incomplete-url-scheme-check'))
    })

    await t.test('should fall back to "UNKNOWN" when rule.severity is absent', (t) => {
      const { script } = t.nr
      const alert = {
        number: 75,
        html_url: 'https://github.com/newrelic/node-newrelic/security/code-scanning/75',
        rule: { id: 'js/some-rule', description: 'Some rule', severity: null },
        tool: { name: 'CodeQL' }
      }
      const blocks = script.buildCodeAlertBlocks('node-newrelic', alert)
      const section = blocks.find((b) => b.type === 'section')
      const detailField = section.fields.find((f) => f.text.includes('Details'))

      assert.ok(detailField.text.includes('UNKNOWN'))
    })

    await t.test('should include a button linking to the alert', (t) => {
      const { script, alert } = t.nr
      const blocks = script.buildCodeAlertBlocks('node-newrelic', alert)
      const actions = blocks.find((b) => b.type === 'actions')
      const button = actions.elements[0]

      assert.equal(button.type, 'button')
      assert.equal(button.text.text, 'Alert #75')
      assert.equal(button.url, alert.html_url)
    })
  })

  await t.test('scanSecretAlerts', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should post to Slack for each open alert', async (t) => {
      const { script, octokit, slackApp } = t.nr
      const alerts = [
        { number: 3, html_url: 'https://github.com/newrelic/node-newrelic/security/secret-scanning/3', secret_type: 'github_personal_access_token', secret_type_display_name: 'GitHub Personal Access Token' },
        { number: 4, html_url: 'https://github.com/newrelic/node-newrelic/security/secret-scanning/4', secret_type: 'npm_access_token', secret_type_display_name: 'npm Access Token' }
      ]
      octokit.request.resolves({ data: alerts })

      await script.scanSecretAlerts({ app: slackApp, octokit, repo: 'node-newrelic', isDryRun: false })

      assert.equal(slackApp.client.chat.postMessage.callCount, 2)
      const firstCall = slackApp.client.chat.postMessage.firstCall.args[0]
      assert.ok(firstCall.blocks.some((b) => b.type === 'header' && b.text.text === 'Secret Scanning Alert'))
    })

    await t.test('should not post to Slack when dry-run is true', async (t) => {
      const { script, octokit, slackApp } = t.nr
      octokit.request.resolves({ data: [
        { number: 3, html_url: 'https://example.com/3', secret_type: 'github_personal_access_token', secret_type_display_name: 'GitHub Personal Access Token' }
      ] })

      await script.scanSecretAlerts({ app: slackApp, octokit, repo: 'node-newrelic', isDryRun: true })

      assert.equal(slackApp.client.chat.postMessage.callCount, 0)
    })

    await t.test('should not post to Slack when there are no open alerts', async (t) => {
      const { script, octokit, slackApp } = t.nr
      octokit.request.resolves({ data: [] })

      await script.scanSecretAlerts({ app: slackApp, octokit, repo: 'node-newrelic', isDryRun: false })

      assert.equal(slackApp.client.chat.postMessage.callCount, 0)
    })
  })

  await t.test('scanCodeAlerts', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should post to Slack for each open alert', async (t) => {
      const { script, octokit, slackApp } = t.nr
      const alerts = [
        {
          number: 75,
          html_url: 'https://github.com/newrelic/node-newrelic/security/code-scanning/75',
          rule: { id: 'js/incomplete-url-scheme-check', description: 'Incomplete URL scheme check', severity: 'high' },
          tool: { name: 'CodeQL' }
        },
        {
          number: 76,
          html_url: 'https://github.com/newrelic/node-newrelic/security/code-scanning/76',
          rule: { id: 'js/prototype-pollution', description: 'Prototype pollution', severity: 'critical' },
          tool: { name: 'CodeQL' }
        }
      ]
      octokit.request.resolves({ data: alerts })

      await script.scanCodeAlerts({ app: slackApp, octokit, repo: 'node-newrelic', isDryRun: false })

      assert.equal(slackApp.client.chat.postMessage.callCount, 2)
      const firstCall = slackApp.client.chat.postMessage.firstCall.args[0]
      assert.ok(firstCall.blocks.some((b) => b.type === 'header' && b.text.text === 'Code Scanning Alert'))
    })

    await t.test('should not post to Slack when dry-run is true', async (t) => {
      const { script, octokit, slackApp } = t.nr
      octokit.request.resolves({ data: [
        {
          number: 75,
          html_url: 'https://example.com/75',
          rule: { id: 'js/some-rule', description: 'Some rule', severity: 'high' },
          tool: { name: 'CodeQL' }
        }
      ] })

      await script.scanCodeAlerts({ app: slackApp, octokit, repo: 'node-newrelic', isDryRun: true })

      assert.equal(slackApp.client.chat.postMessage.callCount, 0)
    })

    await t.test('should not post to Slack when there are no open alerts', async (t) => {
      const { script, octokit, slackApp } = t.nr
      octokit.request.resolves({ data: [] })

      await script.scanCodeAlerts({ app: slackApp, octokit, repo: 'node-newrelic', isDryRun: false })

      assert.equal(slackApp.client.chat.postMessage.callCount, 0)
    })
  })
})
