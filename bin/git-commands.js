'use strict'

const { exec } = require('child_process')

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
    return line.length > 0
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
  const stdout = await execAsPromise(`git add .`)
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

function execAsPromise(command) {
  const promise = new Promise((resolve, reject) => {
    console.log(`Executing: '${command}'`)

    exec(command, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      resolve(stdout)
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
  pushTags
}
