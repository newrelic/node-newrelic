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
  return remotes.reduce((remotePairs, currentRemote) => {
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
}

async function getLocalChanges() {
  const stdout = await execAsPromise('git status --short --porcelain')
  return stdout.split('\n').filter((line) => {
    return line.length > 0 && !line.includes(AGENT_SUB_REPO || DOCS_SUB_REPO)
  })
}

async function getCurrentBranch() {
  const stdout = await execAsPromise('git branch --show-current')
  return stdout.trim()
}

async function checkoutNewBranch(name) {
  const stdout = await execAsPromise(`git checkout -b ${name}`)
  return stdout.trim()
}

async function addAllFiles() {
  const stdout = await execAsPromise(`git add . ':!${AGENT_SUB_REPO}'`)
  return stdout.trim()
}

async function addFiles(files) {
  files = files.join(' ')
  const stdout = await execAsPromise(`git add ${files}`)
  return stdout.trim()
}

async function commit(message) {
  const stdout = await execAsPromise(`git commit -m "${message}"`)
  return stdout.trim()
}

async function pushToRemote(remote, branchName) {
  const stdout = await execAsPromise(`git push --set-upstream ${remote} ${branchName}`)
  return stdout.trim()
}

async function createAnnotatedTag(name, message) {
  const stdout = await execAsPromise(`git tag -a ${name} -m ${message}`)
  return stdout.trim()
}

async function pushTags() {
  const stdout = await execAsPromise('git push --tags')
  return stdout.trim()
}

async function checkout(branchName) {
  const stdout = await execAsPromise(`git checkout ${branchName}`)
  return stdout.trim()
}

async function clone(url, name, args) {
  const argsString = args.join(' ')
  const stdout = await execAsPromise(`git clone ${argsString} ${url} ${name}`)
  return stdout.trim()
}

async function setSparseCheckoutFolders(folders) {
  const foldersString = folders.join(' ')

  const stdout = await execAsPromise(`git sparse-checkout set --no-cone ${foldersString}`)
  return stdout.trim()
}

async function sparseCloneRepo(repoInfo, checkoutFiles) {
  const { name, repository, branch } = repoInfo

  const cloneOptions = [
    '--filter=blob:none',
    '--no-checkout',
    '--depth 1',
    '--sparse',
    `--branch=${branch}`
  ]
  await clone(repository, name, cloneOptions)
  process.chdir(name)

  await setSparseCheckoutFolders(checkoutFiles)

  await checkout(branch)

  process.chdir('..')
}

function execAsPromise(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: '${command}'`)

    exec(command, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      return resolve(stdout)
    })
  })
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
