
exports.initialize = function(agent, trace, mongodb) {
	
	function addFunctionProxy(name) {
		var originalFunction = mongodb.Collection.prototype[name];
		mongodb.Collection.prototype[name] = function() {			
	        var tx = agent.getTransaction();
	        if (!tx) {
	            return originalFunction.apply(this, arguments);
	        }
	        var tracer = new trace.Tracer(tx, 'mongodb/' + name);
	        var callbackIndex = arguments.length-1;
			if (callbackIndex < 0) {
				try {
					return originalFunction.apply(this, arguments);
				} finally {
					tracer.finish();
				}
			}
	        
	        var args = Array.prototype.slice.call(arguments);
	        
	        // Proxy the callback so we know when the call has ended.
	        var origCallback = args[callbackIndex];

	        var newCallback = function() {
	        	tracer.finish();
	            return origCallback.apply(this,arguments);
	        };

	        args[callbackIndex] = newCallback;

	        // call the original function.
			originalFunction.apply(this, args);
		};
	}
	
    // Proxy the CRUD functions.
    ['insert','find','update','remove','save'].forEach(function(name) {
            addFunctionProxy(name);
        });
};