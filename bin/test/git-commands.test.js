/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire').noPreserveCache()
const sinon = require('sinon')

const SCRIPT_PATH = '../git-commands'

test('git-commands', async (t) => {
  t.beforeEach((ctx) => {
    const sandbox = sinon.createSandbox()
    const execStub = sandbox.stub()
    const gitCommands = proxyquire(SCRIPT_PATH, {
      child_process: { exec: execStub }
    })
    ctx.nr = { execStub, gitCommands, sandbox }
  })

  t.afterEach((ctx) => {
    ctx.nr.sandbox.restore()
  })

  await t.test('getPushRemotes', async (t) => {
    await t.test('returns an object mapping remote names to their push URLs', async (t) => {
      const { execStub, gitCommands } = t.nr
      const stdout = [
        'origin\thttps://github.com/user/repo.git (fetch)',
        'origin\thttps://github.com/user/repo.git (push)',
        'upstream\thttps://github.com/other/repo.git (fetch)',
        'upstream\thttps://github.com/other/repo.git (push)'
      ].join('\n')
      execStub.yields(null, stdout)

      const result = await gitCommands.getPushRemotes()

      assert.deepEqual(result, {
        origin: 'https://github.com/user/repo.git (push)',
        upstream: 'https://github.com/other/repo.git (push)'
      })
    })

    await t.test('excludes fetch-only entries', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, 'origin\thttps://github.com/user/repo.git (fetch)\n')

      const result = await gitCommands.getPushRemotes()

      assert.deepEqual(result, {})
    })

    await t.test('skips lines without a tab separator', async (t) => {
      const { execStub, gitCommands } = t.nr
      const stdout = 'invalid line\norigin\thttps://github.com/user/repo.git (push)\n'
      execStub.yields(null, stdout)

      const result = await gitCommands.getPushRemotes()

      assert.deepEqual(result, {
        origin: 'https://github.com/user/repo.git (push)'
      })
    })

    await t.test('returns an empty object when there are no remotes', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      const result = await gitCommands.getPushRemotes()

      assert.deepEqual(result, {})
    })

    await t.test('calls git remote -v', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.getPushRemotes()

      assert.ok(execStub.calledWith('git remote -v'))
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('not a git repo'))

      await assert.rejects(gitCommands.getPushRemotes(), /not a git repo/)
    })
  })

  await t.test('getLocalChanges', async (t) => {
    await t.test('returns a list of changed file status lines', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, ' M lib/foo.js\n?? lib/bar.js\n')

      const result = await gitCommands.getLocalChanges()

      assert.deepEqual(result, [' M lib/foo.js', '?? lib/bar.js'])
    })

    await t.test('filters out empty lines', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '\n\n')

      const result = await gitCommands.getLocalChanges()

      assert.deepEqual(result, [])
    })

    await t.test('filters out lines containing the agent sub-repo path', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, ' M lib/foo.js\n M agent-repo/something.js\n')

      const result = await gitCommands.getLocalChanges()

      assert.deepEqual(result, [' M lib/foo.js'])
    })

    await t.test('does not filter lines containing docs-website due to short-circuit in filter expression', async (t) => {
      // `AGENT_SUB_REPO || DOCS_SUB_REPO` evaluates to 'agent-repo' since it is truthy,
      // so docs-website lines are never filtered out.
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, ' M docs-website/file.md\n M lib/foo.js\n')

      const result = await gitCommands.getLocalChanges()

      assert.deepEqual(result, [' M docs-website/file.md', ' M lib/foo.js'])
    })

    await t.test('returns an empty array when there are no changes', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      const result = await gitCommands.getLocalChanges()

      assert.deepEqual(result, [])
    })

    await t.test('calls git status --short --porcelain', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.getLocalChanges()

      assert.ok(execStub.calledWith('git status --short --porcelain'))
    })
  })

  await t.test('getCurrentBranch', async (t) => {
    await t.test('returns the current branch name with whitespace trimmed', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, 'my-feature-branch\n')

      const result = await gitCommands.getCurrentBranch()

      assert.equal(result, 'my-feature-branch')
    })

    await t.test('calls git branch --show-current', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, 'main\n')

      await gitCommands.getCurrentBranch()

      assert.ok(execStub.calledWith('git branch --show-current'))
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('git error'))

      await assert.rejects(gitCommands.getCurrentBranch(), /git error/)
    })
  })

  await t.test('checkoutNewBranch', async (t) => {
    await t.test('calls git checkout -b with the provided branch name', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, "Switched to a new branch 'feature-x'\n")

      await gitCommands.checkoutNewBranch('feature-x')

      assert.ok(execStub.calledWith('git checkout -b feature-x'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, "Switched to a new branch 'new-branch'\n")

      const result = await gitCommands.checkoutNewBranch('new-branch')

      assert.equal(result, "Switched to a new branch 'new-branch'")
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('branch already exists'))

      await assert.rejects(gitCommands.checkoutNewBranch('existing-branch'), /branch already exists/)
    })
  })

  await t.test('addAllFiles', async (t) => {
    await t.test('calls git add . excluding the agent sub-repo', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.addAllFiles()

      assert.ok(execStub.calledWith("git add . ':!agent-repo'"))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '  \n')

      const result = await gitCommands.addAllFiles()

      assert.equal(result, '')
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('add failed'))

      await assert.rejects(gitCommands.addAllFiles(), /add failed/)
    })
  })

  await t.test('addFiles', async (t) => {
    await t.test('joins the files array and calls git add', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.addFiles(['lib/foo.js', 'lib/bar.js'])

      assert.ok(execStub.calledWith('git add lib/foo.js lib/bar.js'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '  \n')

      const result = await gitCommands.addFiles(['file.js'])

      assert.equal(result, '')
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('pathspec did not match'))

      await assert.rejects(gitCommands.addFiles(['missing.js']), /pathspec did not match/)
    })
  })

  await t.test('commit', async (t) => {
    await t.test('calls git commit -m with the provided message', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '[main abc1234] chore: update\n')

      await gitCommands.commit('chore: update')

      assert.ok(execStub.calledWith('git commit -m "chore: update"'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '[main abc1234] chore: update\n')

      const result = await gitCommands.commit('chore: update')

      assert.equal(result, '[main abc1234] chore: update')
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('nothing to commit'))

      await assert.rejects(gitCommands.commit('empty commit'), /nothing to commit/)
    })
  })

  await t.test('pushToRemote', async (t) => {
    await t.test('calls git push --set-upstream with the remote and branch name', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, 'Branch set up to track remote branch.\n')

      await gitCommands.pushToRemote('origin', 'feature-x')

      assert.ok(execStub.calledWith('git push --set-upstream origin feature-x'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, 'Branch set up to track remote branch.\n')

      const result = await gitCommands.pushToRemote('origin', 'main')

      assert.equal(result, 'Branch set up to track remote branch.')
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('push rejected'))

      await assert.rejects(gitCommands.pushToRemote('origin', 'main'), /push rejected/)
    })
  })

  await t.test('createAnnotatedTag', async (t) => {
    await t.test('calls git tag -a with the name and message', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.createAnnotatedTag('v1.0.0', 'Release v1.0.0')

      assert.ok(execStub.calledWith('git tag -a v1.0.0 -m Release v1.0.0'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '  ')

      const result = await gitCommands.createAnnotatedTag('v1.0.0', 'Release v1.0.0')

      assert.equal(result, '')
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('tag already exists'))

      await assert.rejects(gitCommands.createAnnotatedTag('v1.0.0', 'msg'), /tag already exists/)
    })
  })

  await t.test('pushTags', async (t) => {
    await t.test('calls git push --tags', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.pushTags()

      assert.ok(execStub.calledWith('git push --tags'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, 'Everything up-to-date\n')

      const result = await gitCommands.pushTags()

      assert.equal(result, 'Everything up-to-date')
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('push failed'))

      await assert.rejects(gitCommands.pushTags(), /push failed/)
    })
  })

  await t.test('checkout', async (t) => {
    await t.test('calls git checkout with the branch name', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, "Switched to branch 'main'\n")

      await gitCommands.checkout('main')

      assert.ok(execStub.calledWith('git checkout main'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, "Switched to branch 'main'\n")

      const result = await gitCommands.checkout('main')

      assert.equal(result, "Switched to branch 'main'")
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('pathspec did not match any file'))

      await assert.rejects(gitCommands.checkout('nonexistent'), /pathspec did not match any file/)
    })
  })

  await t.test('clone', async (t) => {
    await t.test('calls git clone with joined args, url, and destination name', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.clone('https://github.com/user/repo.git', 'my-repo', ['--depth=1', '--sparse'])

      assert.ok(execStub.calledWith('git clone --depth=1 --sparse https://github.com/user/repo.git my-repo'))
    })

    await t.test('returns trimmed output', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, "Cloning into 'my-repo'...\n")

      const result = await gitCommands.clone('https://example.com/repo.git', 'my-repo', [])

      assert.equal(result, "Cloning into 'my-repo'...")
    })

    await t.test('handles an empty args array', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.clone('https://example.com/repo.git', 'dest', [])

      assert.ok(execStub.calledWith('git clone  https://example.com/repo.git dest'))
    })

    await t.test('rejects when exec returns an error', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(new Error('repository not found'))

      await assert.rejects(
        gitCommands.clone('https://example.com/missing.git', 'repo', []),
        /repository not found/
      )
    })
  })

  await t.test('sparseCloneRepo', async (t) => {
    await t.test('calls clone, setSparseCheckoutFolders, and checkout in order', async (t) => {
      const { execStub, gitCommands, sandbox } = t.nr
      sandbox.stub(process, 'chdir')
      execStub.yields(null, '')

      const repoInfo = {
        name: 'my-repo',
        repository: 'https://example.com/repo.git',
        branch: 'main'
      }
      await gitCommands.sparseCloneRepo(repoInfo, ['src', 'docs'])

      assert.equal(execStub.callCount, 3)

      const cloneCmd = execStub.getCall(0).args[0]
      assert.ok(cloneCmd.startsWith('git clone'), `expected clone, got: ${cloneCmd}`)
      assert.ok(cloneCmd.includes('--filter=blob:none'))
      assert.ok(cloneCmd.includes('--no-checkout'))
      assert.ok(cloneCmd.includes('--depth 1'))
      assert.ok(cloneCmd.includes('--sparse'))
      assert.ok(cloneCmd.includes('--branch=main'))
      assert.ok(cloneCmd.includes('https://example.com/repo.git'))
      assert.ok(cloneCmd.includes('my-repo'))

      const sparseCmd = execStub.getCall(1).args[0]
      assert.ok(sparseCmd.includes('git sparse-checkout set --no-cone src docs'), `unexpected sparse cmd: ${sparseCmd}`)

      const checkoutCmd = execStub.getCall(2).args[0]
      assert.ok(checkoutCmd.includes('git checkout main'), `unexpected checkout cmd: ${checkoutCmd}`)
    })

    await t.test('changes into the cloned repo directory and back out', async (t) => {
      const { execStub, gitCommands, sandbox } = t.nr
      const chdirStub = sandbox.stub(process, 'chdir')
      execStub.yields(null, '')

      const repoInfo = {
        name: 'my-repo',
        repository: 'https://example.com/repo.git',
        branch: 'main'
      }
      await gitCommands.sparseCloneRepo(repoInfo, ['src'])

      assert.equal(chdirStub.callCount, 2)
      assert.equal(chdirStub.firstCall.args[0], 'my-repo')
      assert.equal(chdirStub.secondCall.args[0], '..')
    })

    await t.test('rejects when clone fails', async (t) => {
      const { execStub, gitCommands, sandbox } = t.nr
      sandbox.stub(process, 'chdir')
      execStub.yields(new Error('clone failed'))

      const repoInfo = {
        name: 'repo',
        repository: 'https://example.com/repo.git',
        branch: 'main'
      }

      await assert.rejects(gitCommands.sparseCloneRepo(repoInfo, []), /clone failed/)
    })
  })

  await t.test('setUser', async (t) => {
    await t.test('calls git config for user.name and user.email', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.yields(null, '')

      await gitCommands.setUser('Test User', 'test@example.com')

      assert.equal(execStub.callCount, 2)
      assert.ok(execStub.calledWith('git config user.name Test User'))
      assert.ok(execStub.calledWith('git config user.email test@example.com'))
    })

    await t.test('returns the joined output of both config calls', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.onCall(0).yields(null, 'name-result')
      execStub.onCall(1).yields(null, 'email-result')

      const result = await gitCommands.setUser('Alice', 'alice@example.com')

      assert.equal(result, 'name-result email-result')
    })

    await t.test('rejects when the user.name config call fails', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.onCall(0).yields(new Error('config error'))

      await assert.rejects(gitCommands.setUser('Name', 'email@example.com'), /config error/)
    })

    await t.test('rejects when the user.email config call fails', async (t) => {
      const { execStub, gitCommands } = t.nr
      execStub.onCall(0).yields(null, '')
      execStub.onCall(1).yields(new Error('email config error'))

      await assert.rejects(gitCommands.setUser('Name', 'email@example.com'), /email config error/)
    })
  })
})
