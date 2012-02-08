/*
Copyright (C) 2011 by Adam Crabtree (dude@noderiety.com)
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/**
 * Shims built-in async functions and automatically wraps callbacks with "wrap"
 * @param {function} wrap The function to return the new callback
 */
module.exports = function hook(wrap) {
    if (alreadyRequired) throw new Error("This should only be required and used once");
    alreadyRequired = true;

    // Wrap setTimeout and setInterval
    ["setTimeout", "setInterval"].forEach(function (name) {
        var original = this[name];
        this[name] = function (callback) {
            arguments[0] = wrap(callback, name);
            return original.apply(this, arguments);
        };
    });

    // Wrap process.nextTick
    var nextTick = process.nextTick;
    process.nextTick = function wrappedNextTick(callback) {
        arguments[0] = wrap(callback, 'process.nextTick');
        return nextTick.apply(this, arguments);
    };

    // Wrap FS module async functions
    var FS = require('fs');
    Object.keys(FS).forEach(function (name) {
        // If it has a *Sync counterpart, it's probably async
        if (!FS.hasOwnProperty(name + "Sync")) return;
        var original = FS[name];
        FS[name] = function () {
            var i = arguments.length - 1;
            if (typeof arguments[i] === 'function') {
                arguments[i] = wrap(arguments[i], 'fs.'+name);
            }
            return original.apply(this, arguments); 
        };
    });

    // Wrap EventEmitters
    var EventEmitter = require('events').EventEmitter;
    var onEvent = EventEmitter.prototype.on;
    EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (type, callback) {
        var newCallback = wrap(callback, 'EventEmitter.on');
        if (newCallback !== callback) {
            callback.wrappedCallback = newCallback;
            arguments[1] = newCallback;
        }
        return onEvent.apply(this, arguments);
    };
    var removeEvent = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.removeListener = function (type, callback) {
        if (callback && callback.hasOwnProperty("wrappedCallback")) {
            arguments[1] = callback.wrappedCallback;
        }
        return removeEvent.apply(this, arguments);
    };
}

var alreadyRequired;
