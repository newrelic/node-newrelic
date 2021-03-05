'use strict'

const { exec } = require('child_process')

function getPushRemotes() {
  const promise = new Promise((resolve, reject) => {
    exec('git remote -v', (err, stdout) => {
      if (err) {
        return reject(err)
      }

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

      resolve(processedRemotes)
    })
  })

  return promise
}

function getLocalChanges() {
  const promise = new Promise((resolve, reject) => {
    exec('git status --short --porcelain', (err, stdout) => {
      if (err) {
        return reject(err)
      }

      const changes = stdout.split('\n').filter((line) => {
        return line.length > 0
      })

      resolve(changes)
    })
  })

  return promise
}

function getCurrentBranch() {
  const promise = new Promise((resolve, reject) => {
    exec('git branch --show-current', (err, stdout) => {
      if (err) {
        return reject(err)
      }

      const branch = stdout.trim()

      resolve(branch)
    })
  })

  return promise
}

function checkoutNewBranch(name) {
  const promise = new Promise((resolve, reject) => {
    exec(`git checkout -b ${name}`, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      const output = stdout.trim()

      resolve(output)
    })
  })

  return promise
}

function addAllFiles() {
  const promise = new Promise((resolve, reject) => {
    exec(`git add .`, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      const output = stdout.trim()

      resolve(output)
    })
  })

  return promise
}

function commit(message) {
  const promise = new Promise((resolve, reject) => {
    exec(`git commit -m "${message}"`, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      const output = stdout.trim()

      resolve(output)
    })
  })

  return promise
}

function pushToRemote(remote, branchName) {
  const promise = new Promise((resolve, reject) => {
    exec(`git push --set-upstream ${remote} ${branchName}`, (err, stdout) => {
      if (err) {
        return reject(err)
      }

      const output = stdout.trim()

      resolve(output)
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
  pushToRemote
}
