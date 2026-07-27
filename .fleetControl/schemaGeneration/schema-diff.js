/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')

// Change kinds grouped by the version bump they force. Highest severity wins.
const SEVERITY_RANK = { breaking: 3, additive: 2, cosmetic: 1 }
const BUMP_FOR_SEVERITY = { breaking: 'major', additive: 'minor', cosmetic: 'patch' }

/**
 * Parse a schema JSON file into an object. Missing or malformed files yield
 * `{}` so a bootstrap run (no baseline schema yet) is handled by the caller.
 */
function loadExisting(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

function change(path, kind, severity, detail) {
  return { path, kind, severity, detail }
}

function dotted(path, key) {
  return path ? `${path}.${key}` : key
}

// Canonical (sorted-key) stringify, so two structurally-identical values
// compare equal regardless of object key order. Used for type signatures and
// defaults, which can be arrays (`type: ['string', 'null']`) or objects.
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const entries = keys.map((key) => stableStringifyEntry(key, value[key]))
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function stableStringifyEntry(key, value) {
  return `${JSON.stringify(key)}:${stableStringify(value)}`
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b)
}

// A property's type is either a plain `type`, an array of types (nullable
// unions like `['string', 'null']`), or an `anyOf` (e.g. app_name's
// array-or-delimited-string shape). `anyOf` takes precedence since a
// property with both would mean `anyOf` is what actually constrains it.
function typeSignature(prop) {
  return prop.anyOf || prop.type
}

function describeType(signature) {
  if (typeof signature === 'string') {
    return signature
  }
  if (Array.isArray(signature) && signature.every((entry) => typeof entry === 'string')) {
    return signature.join('|')
  }
  return 'array-or-string'
}

/**
 * Compare two schema nodes' `required` arrays. Applied at every recursion
 * level (root and each nested object), not just the root.
 */
function requiredChanges(oldNode, newNode, path) {
  const oldRequired = new Set(oldNode.required || [])
  const newRequired = new Set(newNode.required || [])
  const changes = []

  for (const key of [...newRequired].sort()) {
    if (!oldRequired.has(key)) {
      changes.push(change(dotted(path, key), 'required_added', 'breaking', 'now required'))
    }
  }
  for (const key of [...oldRequired].sort()) {
    if (!newRequired.has(key)) {
      changes.push(change(dotted(path, key), 'required_removed', 'additive', 'no longer required'))
    }
  }
  return changes
}

/**
 * Compare two schema nodes' `additionalProperties`. Only fires when both
 * sides are actual booleans — several nodes here (`labels`, the dynamic
 * `instrumentation` map) use an object-shaped `additionalProperties` to
 * constrain dictionary values, which isn't a true/false toggle and isn't
 * classified by this check.
 */
function additionalPropertiesChanges(oldNode, newNode, path) {
  const oldValue = Object.prototype.hasOwnProperty.call(oldNode, 'additionalProperties')
    ? oldNode.additionalProperties
    : true
  const newValue = Object.prototype.hasOwnProperty.call(newNode, 'additionalProperties')
    ? newNode.additionalProperties
    : true

  if (typeof oldValue !== 'boolean' || typeof newValue !== 'boolean') {
    return []
  }
  if (oldValue === true && newValue === false) {
    return [change(path || '<root>', 'additional_properties_tightened', 'breaking', 'additionalProperties: true -> false')]
  }
  if (oldValue === false && newValue === true) {
    return [change(path || '<root>', 'additional_properties_loosened', 'additive', 'additionalProperties: false -> true')]
  }
  return []
}

function typeChanges(oldProp, newProp, path) {
  const oldSignature = typeSignature(oldProp)
  const newSignature = typeSignature(newProp)
  if (deepEqual(oldSignature, newSignature)) {
    return []
  }
  return [change(path, 'type_changed', 'breaking', `${describeType(oldSignature)} -> ${describeType(newSignature)}`)]
}

function enumChanges(oldProp, newProp, path) {
  const oldEnum = oldProp.enum
  const newEnum = newProp.enum
  if (deepEqual(oldEnum, newEnum)) {
    return []
  }
  if (oldEnum === undefined) {
    return [change(path, 'enum_introduced', 'breaking', `enum added: ${newEnum.join(', ')}`)]
  }
  if (newEnum === undefined) {
    return [change(path, 'enum_removed_entirely', 'additive', 'enum constraint removed')]
  }

  const changes = []
  const removed = oldEnum.filter((value) => !newEnum.includes(value))
  const added = newEnum.filter((value) => !oldEnum.includes(value))
  if (removed.length) {
    changes.push(change(path, 'enum_value_removed', 'breaking', `enum values removed: ${removed.join(', ')}`))
  }
  if (added.length) {
    changes.push(change(path, 'enum_value_added', 'additive', `enum values added: ${added.join(', ')}`))
  }
  return changes
}

function defaultChanges(oldProp, newProp, path) {
  const hasOld = Object.prototype.hasOwnProperty.call(oldProp, 'default')
  const hasNew = Object.prototype.hasOwnProperty.call(newProp, 'default')
  if (!hasOld && !hasNew) {
    return []
  }
  if (hasOld === hasNew && deepEqual(oldProp.default, newProp.default)) {
    return []
  }

  const oldRepr = hasOld ? JSON.stringify(oldProp.default) : 'none'
  const newRepr = hasNew ? JSON.stringify(newProp.default) : 'none'
  return [change(path, 'default_changed', 'additive', `default changed: ${oldRepr} -> ${newRepr}`)]
}

function descriptionChanges(oldProp, newProp, path) {
  if (oldProp.description === newProp.description) {
    return []
  }
  return [change(path, 'description_changed', 'cosmetic', 'description changed')]
}

function classifyLeaf(oldProp, newProp, path) {
  return [
    ...typeChanges(oldProp, newProp, path),
    ...enumChanges(oldProp, newProp, path),
    ...defaultChanges(oldProp, newProp, path),
    ...descriptionChanges(oldProp, newProp, path)
  ]
}

/**
 * Walk two schema nodes in parallel and return a list of change records:
 * `{ path, kind, severity, detail }`. Recurses into properties that are
 * `type: 'object'` on both sides with their own `properties` map (a fixed
 * shape); everything else — including dictionary-shaped objects like
 * `labels` that constrain values via `additionalProperties` instead of
 * naming properties — is classified as a leaf.
 */
function classifyChanges(oldSchema, newSchema, path = '') {
  const changes = [
    ...requiredChanges(oldSchema, newSchema, path),
    ...additionalPropertiesChanges(oldSchema, newSchema, path)
  ]

  const oldProps = oldSchema.properties || {}
  const newProps = newSchema.properties || {}
  const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)])

  for (const key of [...keys].sort()) {
    const childPath = dotted(path, key)
    if (!Object.prototype.hasOwnProperty.call(oldProps, key)) {
      changes.push(change(childPath, 'property_added', 'additive', 'new property'))
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(newProps, key)) {
      changes.push(change(childPath, 'property_removed', 'breaking', 'property removed'))
      continue
    }

    const oldChild = oldProps[key]
    const newChild = newProps[key]
    if (oldChild.type === 'object' && newChild.type === 'object' && oldChild.properties && newChild.properties) {
      changes.push(...classifyChanges(oldChild, newChild, childPath))
    } else {
      changes.push(...classifyLeaf(oldChild, newChild, childPath))
    }
  }

  return changes
}

/** Highest-severity bump implied by a list of change records. */
function recommendBump(changes) {
  let highest = null
  for (const entry of changes) {
    const rank = SEVERITY_RANK[entry.severity]
    if (rank && (highest === null || rank > SEVERITY_RANK[highest])) {
      highest = entry.severity
    }
  }
  return highest ? BUMP_FOR_SEVERITY[highest] : 'none'
}

/** Apply a bump kind to a semver `X.Y.Z` string. `'none'` returns it unchanged. */
function applyBump(version, bump) {
  if (bump === 'none') {
    return version
  }

  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version))
  if (!match) {
    throw new Error(`not a semver version: ${version}`)
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`unknown bump kind: ${bump}`)
  }
}

/**
 * Replace the single `version:` line in configurationDefinitions.yml text.
 * Throws unless exactly one such line exists, so a malformed file can't be
 * silently half-updated.
 */
function bumpVersionLine(yamlText, newVersion) {
  const pattern = /^([ \t]*version:[ \t]*)(\S+)([ \t]*)$/gm
  const matches = yamlText.match(pattern)
  if (!matches || matches.length !== 1) {
    throw new Error(`expected exactly 1 'version:' line, found ${matches ? matches.length : 0}`)
  }
  return yamlText.replace(pattern, (_match, prefix, _oldVersion, suffix) => `${prefix}${newVersion}${suffix}`)
}

function symbolForChange(kind) {
  if (kind === 'property_added') {
    return '+'
  }
  if (kind === 'property_removed') {
    return '-'
  }
  return '~'
}

/** One-line human rendering: + added, - removed, ~ modified. */
function renderChange(entry) {
  return `${symbolForChange(entry.kind)} ${entry.path}: ${entry.detail}`
}

module.exports = {
  loadExisting,
  classifyChanges,
  recommendBump,
  applyBump,
  bumpVersionLine,
  renderChange,
  typeSignature,
  deepEqual
}
