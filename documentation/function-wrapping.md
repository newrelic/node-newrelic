# Function Wrapping

New Relic's agents work largely (but not exclusively) via [code instrumentation](https://en.wikipedia.org/wiki/Instrumentation_(computer_programming)). Agents replace function and method definitions with their own (i.e. monkey patch, wrap, etc.). These new functions and methods will call the original functions and methods they're replacing, but also take steps to time that original function or method call and create New Relic data products (metrics, events, traces, segments, etc) as needed and specified.

The Node.js agent has a leg up on other New Relic agents, in that replacing method definitions is a built in feature of the language.

This document will examine the agent's [Shim.wrap](https://github.com/newrelic/node-newrelic/blob/979994fd7250cad4f19ca4fe65a9a1b2d7ca9311/lib/shim/shim.js#L577-L635) method -- this is the method that other wrappers rely on for swapping out a javascript method definition with their own. Once you understand this method, you'll have the core building block you need to understand all the Shim helper methods related to function wrapping.

## Our Test Program

Normally, in order to use a shim helper you need to configure and setup an [instrumentation](./module-instrumentations.md). You can do that if you like, but this document will use the following test program.

```js
//File: test.js

const newrelic = require('newrelic');

// grab the agent instance from cache and manually
// require the shim library -- normally the agent
// will handle this for you
const agent = require.cache.__NR_cache.agent;
const Shim = require('newrelic/lib/shim/shim');

// do the same fnApply/apply shenangins as the shim library
// https://github.com/newrelic/node-newrelic/blob/v7.1.3/lib/shim/shim.js#L17-L19
const fnApply = Function.prototype.apply

// create a simple test object that
// will stand in for our module
const testObject = {};
testObject.helloWorld = function helloWorld(console) {
    console.log("Hello World! :)");
}
testObject.goodbyeWorld = function goodbyeWorld(console) {
    console.log("Goodbye World! :(");
}

// create an instance of a Shim, passing in fake
// values for the module name and module path,
// again, the agent normally takes care of
// this for you
shim = new Shim(agent, 'fake', '/path/to/fake.js')

// our wrappers will go here
// ...

// call our methods
testObject.helloWorld(console);
testObject.goodbyeWorld(console);
console.log("Done")

// exit early to avoid harvest loop
process.exit(1)
```

This program loads and mocks enough of the agent to creates a generic Shim object and call its wrap method. It also creates a simple object (testObject) with two methods (helloWorld and goodbyeWorld), and then calls those methods. In our examples below we'll be placing our wrapping code here

```js
// our wrappers will go here
// ...
```

and changing the behavior of the helloWorld and goodbyeWorld methods. Without any wrappers, this program will produce the following output.

```
Hello World! :)
Goodbye World! :(
```

By the end of this document, you'll be able to use the agent's wrap method to change the behavior of these methods to anything you'd like.

## The Basic Wrapper

We'll start with a basic wrapper. Let's replace the helloWorld method on testObject with one of our own.

```js
// our wrappers will go here
// ...

shim.wrap(testObject, 'helloWorld', function wrapCreator(){
    return function wrappedHelloWorld(console) {
        console.log("I am the new method!");
    }
});
```

Run our program with above `shim.wrap call`, and you should see the following output.

```
$ node test.js
I am the new method!
Goodbye World! :(
Done
```

The 'Hello World!' output's been replaced with the output from our wrapper.

In its most basic form, the wrap function takes three arguments

```js
shim.wrap(theObject, 'theMethodName', theWrapCreatorFunction)
```

The first argument is the object whose method we want to wrap. The second is the name of the method we want to wrap, and the third a function that will return the new function we want to use instead of the original. This distinction is worth repeating -- the function we pass to wrap is not our new function. Instead, the function we pass to wrap needs to do the work of creating our new function and returning it. We've named this function wrapCreator above -- but you can name this anything you like, or even use a lambda "arrow function" expression if you're so inclined.

## Wrap Multiple Methods

Next we're going to take a look at wrap's ability to replace more than one function definition at a time. Change your wrap call so it matches the following

```js
shim.wrap(testObject, ['helloWorld','goodbyeWorld'], function wrapCreator(){
  return function wrappedHelloWorld(console) {
    console.log("No, I am the new method!");
  }
});
```

Run the program, and you'll see both the helloWorld and goodbyeWorld method definitions have been changed.

```
$ node test.js
No, I am the new method!
No, I am the new method!
Done
```

All we've done above is change the second argument to wrap so that it's an array of method names.

```js
shim.wrap(..., ['helloWorld','goodbyeWorld'], ...);
```

By itself this feature isn't very useful -- but once you learn how to call the original method we're wrapping, this syntax can be super useful for performing the same sort of wrapping on a large number of object methods.

## Calling the Original Function

So far our examples have completely replaced the function they're wrapping. While this can be useful behavior, by itself it doesn't help us instrument other people's code. We need to be able to call the original function or method in order to preserve the original application's behavior. Fortunately, the agent's wrapper class can accommodate us.

The following code will replace the 'helloWorld' method with one of our own, but also call the original method.

```js
shim.wrap(testObject, 'helloWorld',
  function wrapCreator(shimThatWrapped, originalMethod){
    return function wrappedHelloWorld(console) {
      //call the original method using the apply function
      const originalReturn = fnApply.call(originalMethod, this, [console]);
      console.log("Hello Again");
      return originalReturn;
    }
  }
);
```

With the above in place, your program output will look like the following

```
$ node test.js
Hello World! :)
Hello Again
Goodbye World! :(
Done
```

As you can see, our program called the original method (i.e. we see 'Hello World!' output), but also called our new function definition (i.e. we see the 'Hello Again') output.

The wrap creator function has a number of optional parameters/arguments. We've used two of them above

```js
//...
function wrapCreator(shimThatWrapped, originalMethod){
//...
```

We'll describe all the possible arguments to the wrap creator momentarily, but it's the second argument (originalMethod) that we're interested in right now. This will be a reference to the method we're wrapping. With this reference, we can then call the method in our new method using [javascript's apply](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply).

```js
const fnApply = Function.prototype.apply
//...
return function wrappedHelloWorld(console) {
  //call the original method using the apply function
  const originalReturn = fnApply.call(originalMethod, this, [console]);
  console.log("Hello Again");
  return originalReturn;
}
```

The `fnApply` variable is a direct reference to `Function.prototype.apply`. While agent instrumentation may often use `originalMethod.apply()` to call the original method, it is sometimes beneficial to use `Function.apply` to avoid bumping into other JavaScript frameworks that change a function's prototype.

## Wrap Creator Function Args

There are three arguments you can use with the wrap creator function. Consider the following code.

```js
shim.wrap(testObject, 'helloWorld',
  function wrapCreator(shimThatWrapped, originalMethod, whichProperty){
    console.log(
      "I am returning a function that will wrap the " + "\n" +
      whichProperty + " method of an object.\n"
    );

    return function wrappedHelloWorld(console) {
      // call the original method using the apply function
      // IMPORTANT -- when writing instrumentation, don't call
      // the `apply` method directly -- instead use the cached
      // fnApply in the shim library
      const originalReturn = fnApply.call(originalMethod, this, [console]);
      console.log("Hello Arguments");
      return originalReturn;
    }
  }
);
```

Here we see the 'wrapCreator' function has three arguments.

**shimThatWrapped**

The first argument is the shim object itself. The agent passes this value into our wrap creator function so we don't need to rely on closure to access other helper methods on the shim object.

**originalMethod**

The second argument, as previously discussed, is the original method. The one we're wrapping. With access to the original function, we can call it using javascript's apply function (available in the fnApply variable), and then have our wrapper return the original return value.

```js
return function wrappedHelloWorld(console) {
  //...
  var originalReturn = fnApply.call(originalMethod, this, [console]);
  console.log("Hello Arguments");
  return originalReturn;
}
```

This preserves the original behavior of the application, while allowing us to take whatever action extra actions we want.

**whichProperty**

The third argument to the wrapper function is the name of the property we're wrapping. This can be useful if you're wrapping multiple methods via the second argument to wrap, but your logic requires you to know which method the end-user-programmer is calling.

## Extra Arguments to Wrap Creator

There's one final feature of the wrap function you'll want to be aware of, and that's the ability to have the agent pass extra arguments to the wrap creator function. Consider the following wrap call:

```js
shim.wrap(
  testObject,
  'helloWorld',
  function wrapCreator(shimThatWrapped, originalMethod, whichProperty, extraOne, extraTwo) {
    console.log(extraOne);
    console.log(extraTwo);
    return function wrappedHelloWorld(console) {
      //call the original method using the apply function
      return fnApply.call(originalMethod, this, [console]);
    }
  },
  ["extra1", "extra2"]
);
```

Here we've passed a fourth argument to the wrap method.

```js
shim.wrap(...,...,...,["extra1", "extra2"])
```

This fourth argument should be an array. The agent will pass each value of this array as an additional argument to the wrap creator function. You can see this with the extraOne and extraTwo parameters of the wrap creator

```js
function wrapCreator(..., ..., ..., extraOne, extraTwo) {
  console.log(extraOne);
  console.log(extraTwo);
  return function wrappedHelloWorld(console) {
    //call the original method using the apply function
    return fnApply.call(originalMethod, this, [console]);
  }
//...
```

## Further Code to Look At

Once you've mastered the basic wrapper, you'll be ready to investigate the implementation of more substantial agent wrappers. Here's a few places to start

* [Uses wrap to wrap an object constructor functions (i.e. "a class")](https://github.com/newrelic/node-newrelic/blob/v7.1.3/lib/shim/shim.js#L763-L823)
* [Uses wrap to create a segment recorder](https://github.com/newrelic/node-newrelic/blob/v7.1.3/lib/shim/shim.js#L889-L1045)
* [Uses wrap to wrap a middleware mounter method](https://github.com/newrelic/node-newrelic/blob/v7.1.3/lib/shim/webframework-shim.js#L412-L516)
