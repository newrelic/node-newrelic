#!/usr/bin/env node

console.log('I am stdout')
console.error('I am stderr')

if (process.send) {
  process.send('hello')
}
