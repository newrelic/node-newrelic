function generateShim(next, name, location) {
	console.log("In generate shim");
//	console.log(arguments);
//	console.log(arguments[0]);
	var tx;
	try {
		tx = globalMofo;
	} catch (e) {}

	var self;
	/*
	var res = findToken();
	if (!res) return next;
	var stack = res.stack;
	*/
	var token; // = res.token;

	// _TOKEN_ is the new callback and calls the real callback, next() 
	function _TOKEN_() {
		try {
			console.log(tx);
		} catch (e) {}
		try {
			return next.apply(self, arguments);
		} catch (err) {
			if (!(err instanceof Error)) {
				err = new Error(''+err);
			}

			var catchFn;
			token = _TOKEN_;
			err.stack = filterInternalFrames(err.stack);
			while(token.token) {
				if (token.stack) {
					err.stack += '\n    ----------------------------------------\n' +
						'    at '+token.orig+'\n' +
						token.stack.substring(token.stack.indexOf("\n") + 1)
				}
				catchFn = token = token.token;
			}

			catchFn(err);
		}
	}

	_TOKEN_.orig = name;
//	_TOKEN_.stack = stack;
//	_TOKEN_.token = token;

	return function() {
		self = this;
		_TOKEN_.apply(token, arguments);
	};
}

globalMofo = "testeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

var testDude = 'edfefe';
var NRTransaction = "test";

function globalEval() {
	return eval('NRTransaction');
}

require('./lib/hook.js')(generateShim);

function test2() {
	console.log('test2');
}

function dude() 
{	
	this.test = 'hey';
	console.log('testing 123');
	globalMofo = "oooooh noooooooo";
	this.go = function() {		
	}
	
	setTimeout(test2, 2);
}

//console.log(dude);

setTimeout(dude, 200);

globalMofo = "testeeeeeeeeeeeeeee22222222222222222222222222222";

setTimeout(dude, 2);

