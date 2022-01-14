/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { exec } = require('child_process')
// in CI we clone `node-newrelic` for reusable workflows
// we do not want it to be part of `git status` nor adding via `git add .`
const AGENT_SUB_REPO = 'agent-repo'
const DOCS_SUB_REPO = 'docs-website'

async function getPushRemotes() {
  const stdout = await execAsPromise('git remote -v')

  const remotes = stdout.split('\n')
  const processedRemotes = remotes.reduce((remotePairs, currentRemote) => {
    const parts = currentRemote.split('\t')
    if (parts.length < 2) {
      return remotePairs
    }

    const [name, url] = parts
    if (url.indexOf('(push)') >= 0) {
      remotePairs[name] = url
    }

    return remotePairs
  }, {})

  return processedRemotes
}

async function getLocalChanges() {
  const stdout = await execAsPromise('git status --short --porcelain')
  const changes = stdout.split('\n').filter((line) => {
    return line.length > 0 && !line.includes(AGENT_SUB_REPO || DOCS_SUB_REPO)
  })

  return changes
}

async function getCurrentBranch() {
  const stdout = await execAsPromise('git branch --show-current')
  const branch = stdout.trim()

  return branch
}

async function checkoutNewBranch(name) {
  const stdout = await execAsPromise(`git checkout -b ${name}`)
  const output = stdout.trim()

  return output
}

async function addAllFiles() {
  const stdout = await execAsPromise(`git add . ':!${AGENT_SUB_REPO}'`)
  const output = stdout.trim()

  return output
}

async function addFiles(files) {
  files = files.join(' ')
  const stdout = await execAsPromise(`git add ${files}`)
  const output = stdout.trim()

  return output
}

async function commit(message) {
  const stdout = await execAsPromise(`git commit -m "${message}"`)
  const output = stdout.trim()

  return output
}

async function pushToRemote(remote, branchName) {
  const stdout = await execAsPromise(`git push --set-upstream ${remote} ${branchName}`)
  const output = stdout.trim()

  return output
}

async function createAnnotatedTag(name, message) {
  const stdout = await execAsPromise(`git tag -a ${name} -m ${message}`)
  const output = stdout.trim()

  return output
}

async function pushTags() {
  const stdout = await execAsPromise('git push --tags')
  const output = stdout.trim()

  return output
}

async function checkout(branchName) {
  const stdout = await execAsPromise(`git checkout ${branchName}`)
  const output = stdout.trim()

  return output
}

async function clone(url, name, args) {
  const argsString = args.join(' ')
  const stdout = await execAsPromise(`git clone ${argsString} ${url} ${name}`)
  const output = stdout.trim()

  return output
}

async function setSparseCheckoutFolders(folders) {
  const foldersString = folders.join(' ')

  const stdout = await execAsPromise(`git sparse-checkout set ${foldersString}`)
  const output = stdout.trim()

  return output
}

async function sparseCloneRepo(repoInfo, checkoutFiles) {
  const { name, repository, branch } = repoInfo

  const cloneOptions = ['--filter=blob:none', '--no-checkout', '--depth 1', '--sparse']
  await clone(repository, name, cloneOptions)
  process.chdir(name)

  await setSparseCheckoutFolders(checkoutFiles)

  await checkout(branch)

  process.chdir('..')
}

function execAsPromise(command) {
  const promise = new Promise((resolve, reject) => {
    console.log(`Executing: '${command}'`)

    exec(command, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      return resolve(stdout)
    })
  })

  return promise
}

module.exports = {
  getPushRemotes,
  getLocalChanges,
  getCurrentBranch,
  checkoutNewBranch,
  addAllFiles,
  commit,
  pushToRemote,
  createAnnotatedTag,
  pushTags,
  checkout,
  clone,
  sparseCloneRepo,
  addFiles
}
