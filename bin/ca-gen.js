#!/usr/bin/env node
'use strict'
/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

const CERT_PATH = path.join(__dirname, '..', '..', 'SSL_CA_cert_bundle', '*.pem')

const OUTFILE =
  path.join(__dirname, '..', 'lib', 'collector', 'ssl', 'certificates')

const HEADER =
  `/**\n
   * certificates.js - CA bundle for SSL communication with RPM.\n
   *\n
   * This file contains the X509 certificates used to communicate with New Relic\n
   * over SSL.\n
   */\n\n`

class Certificate {
  constructor(name, body) {
    this.name = name
    this.body = body
  }

  toEntry() {
    let output = `  // ${this.name}\n`
    const rawPEM = this.body.split('\n')

    for (let i = 0; i < rawPEM.length; i++) {
      const line = rawPEM[i]
      // some Thawte certificates have Windows line endings
      line = line.replace('\r', '')
      if (line.match(/END CERTIFICATE/)) {
        output += `  "${line}\\n"`
        break
      }
      output += `  "${line}\\n" +\n`
    }

    return output
  }
}

function loadCerts(root, callback) {
  glob(root, (error, files) => {
    if (error) {
      return callback(error, null)
    }

    const certificates = []
    console.log(`Loading ${files.length} certficates.`)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const certificate = new Certificate(
        path.basename(file, '.pem'),
        fs.readFileSync(file, 'ascii')
      )

      certificates.push(certificate)
    }

    callback(null, certificates)
  })
}

function dumpCerts(error, certs) {
  if (error) {
    console.log(`got ${error.message} reading certs--bailing out`)
    process.exit(1)
  }

  fs.writeFileSync(
    OUTFILE,
    HEADER +
    'module.exports = [\n' +
    certs.map((cert) => cert.toEntry()).join(',\n\n') +
    '\n]\n'
  )
}

loadCerts(CERT_PATH, dumpCerts)
