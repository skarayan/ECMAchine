/*
 * Modify toString behavior of lists to Lisp style
 */
Array.prototype.toString = function() {
	var sexp = '(' + this.join(' ') + ')';
	return sexp;
};

function clone(obj){
    if(obj == null || typeof(obj) != 'object')
        return obj;
    var temp = new obj.constructor(); 
    for(var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

/*
 * Parses S-expression into a nested list
 */
function parse(sexp) {
	var isInt = function(value) {
	  if ((parseFloat(value) == parseInt(value)) && !isNaN(value)){
	      return true;
	  } else { 
	      return false;
	  }
	};
	
	var tokenize = function(sexp) {
        var sexp = sexp.substring(1, sexp.length-1);
        var openParens = 0;
   		var tokens = [];
		var currentToken = '';                                        
        for (var i = 0; i < sexp.length; i++) {
        	if (sexp[i] == ' ' && openParens == 0) {
        		tokens.push(currentToken);
                currentToken = '';
        	} else {
        		currentToken += sexp[i];
        		if (sexp[i] == '(') {
        			openParens++;
        		} else if (sexp[i] == ')') {
        			openParens--;
        		}
        	}
        }
		tokens.push(currentToken);        
    	return tokens;
    };
    
    // do ( and ) match?
	if (sexp.split('(').length != sexp.split(')').length) { 
		throw 'Parse Error: Parentheses do not match'; 
	}
    
    // trim
    sexp = sexp.replace(/\n\.\./g, " ") // "\n.." => " "
    sexp = sexp.replace(/\s+/g, " "); // eg "  " => " "
    sexp = sexp.replace(/\s+\)/g, ")"); // eg " )" => ")"
    sexp = sexp.replace(/\(\s+/g, "("); // eg "( " => "("
    console.log(sexp);
	
	if (sexp == '()') {
		return [];
	} else if (sexp[0] == '(') {
		var parsed_sexp = [];
		var tokens = tokenize(sexp);
		for (var i = 0; i < tokens.length; i++) {
			parsed_sexp.push(parse(tokens[i]));
		}
		return parsed_sexp;
	} else if (isInt(sexp)) {
		return parseInt(sexp);
	} else {
		return sexp;
	}
}

/*
 * Evaluates a parsed S-expression, Lisp-style
 */
function evaluate(sexp, environment, noArgEvaluation) {
	var builtInFunctions = [
		'+', '-', '*', '/', '>', '<', '=', 'and', 'begin', 'car', 'cdr', 'cond', 'cons', 
			'define', 'if', 'lambda', 'length', 'list', 'map', 'not', 'or', 'quote', 'filter',
		'ls', 'cd', 'read', 'exec', 'mkdir', 'new', 'save', 'help', 'append', 'path', 
			'rm', 'mv', 'cp', 'file?', 'dir?', 'time', 'do-nothing',
		'processes', 'start', 'peek', 'kill', 'overlay'
	];
	var controlFlowStatements = ['if', 'cond', 'quote', 'begin', 'define', 'lambda', 'λ', 'map', 'filter'];
	
	//console.log(sexp); // for debugging
	
	if (typeof sexp != 'object') { // atom
		if (sexp == '#t') {
			return true;
		} else if (sexp == '#f') {
			return false;
		} else if (typeof sexp == 'number') { // number
			return sexp;
		} else if (sexp[0] == "'") { // string literal
			return parse(sexp.slice(1));
		} else if (builtInFunctions.indexOf(sexp) > -1) { // built-in function
			return sexp;
		} else { // variable
			return environment[sexp];
		}
	}
	
	var func = sexp[0];
	
	if (func.lambda || controlFlowStatements.indexOf(func) > -1 || noArgEvaluation) {
		// lambda or control flow statement: don't evaluate arguments
		var args = sexp.slice(1);
	} else {
		// evaluate arguments
		var args = [];
		for (var i = 1; i < sexp.length; i++) {
			var evaluatedArg = evaluate(sexp[i], environment);
			if (evaluatedArg !== undefined) {
				args.push(evaluatedArg);
			} else {
				throw 'Parse Error: Cannot evaluate token "' + sexp[i] + '"';
			}
		}
	}
	
	if (func.lambda) {
		// Lambda function
		
		var lambdaEnvironment = clone(func.environment);
		if (func.arguments.length > args.length) {
			throw 'Error: Not enough arguments passed to lambda: expected ' + func.arguments.length + ' but received ' + args.length;
			return 'Error';
		}
		for (var i = 0; i < func.arguments.length; i++) {
			// if method call or quoted string, evaluate
			if (typeof args[i] == 'object' || (args[i][0] && args[i][0] == "'")) {
				args[i] = evaluate(args[i], environment);
			}
			lambdaEnvironment[func.arguments[i]] = args[i];
		}
		return evaluate(func.body, lambdaEnvironment);
	} else if (typeof func == 'string') {
		// Built-in function
		switch(func) {
			// Arithmetic
			case '+':
				args = args.map(function (arg) {
					if (typeof arg == 'string') { // this lets us overload + for string concatenation
						return '"' + arg + '"';
					} else {
						return arg;
					}
				})
				return eval(args.join(func));
			case '*':
				return eval(args.join(func));
			case '-':
				if (args.length == 1) {
					return (- args[0]);
				} else {
					return (args[0] - args[1]);
				}
			case '/':
				if (args.length == 1) {
					return (1 / args[0]);
				} else {
					return (args[0] / args[1]);
				}
				
			// Comparisons
			case '=':
				return (args[0] == args[1]);
			case '>':
			case '<':
			case '>=':
			case '<=':
			case '==':
			case '!=':
				return eval(args[0] + func + args[1]);
				
			// Logical
			case 'not':
				return !(args[0]);
			case 'and':
				return eval(args.join('&&'));
			case 'or':
				return eval(args.join('||'));
				
			// Conditionals
			case 'if':
				if (evaluate(args[0], environment)) {
					return evaluate(args[1], environment);
				} else {
					return evaluate(args[2], environment);
				}
			case 'cond':
				for (var i = 0; i < args.length; i++) {
					var condBlock = args[i];
					if (evaluate(condBlock[0], environment)) {
						return evaluate(condBlock[1], environment);
					}
				}
			
			// List operations
			case 'cons':
				return new Array(args[0], args[1]);
			case 'car':
				var arg = args[0];
				return arg[0];
			case 'cdr':
				var arg = args[0];
				return arg.slice(1);
			case 'list':
				return args;
			
			// Lambdas and scoping stuff
			case 'define':
				environment[args[0]] = args[1];
				break;
			case 'lambda':
			case 'λ':
				var arguments = args[0];
				var body = args[1];
				
				var argsList = []; for (var i = 0; i < arguments.length; i++) { argsList.push(arguments[i]); } // a necessary evil
				
				return {
					'lambda': true,
					'arguments': arguments,
					'body': body,
					'environment': environment,
					toString: function () {
						return '(&lambda; ' + argsList + ' ' + body + ')';
					}
				};
			
			// Misc Lisp
			case 'quote':
				return args[0];
			case 'begin':
				for (var i = 0; i < args.length - 1; i++) {
					evaluate(args[i], environment);
				}
				return evaluate(args[args.length - 1], environment);
			case 'length':
				return args[0].length;
			
			// Higher-order functions
			case 'map':
				var fn = args[0];
				var lst = evaluate(args[1], environment);
				return lst.map(function (elt) {
					return evaluate(new Array(fn, elt), environment, true);
				});
			case 'filter':
				var cond = evaluate(args[0], environment);
				var lst = evaluate(args[1], environment);
				return lst.filter(function (elt) {
					return evaluate(new Array(cond, elt), environment, true);
				});
			
			// Filesystem
			case 'ls':
				return Filesystem.listFiles(args[0]);
			case 'cd':
				var newPath = Filesystem.navigate(args[0]);
				terminal.set_prompt('ecmachine:' + newPath + ' guest$');
				return;
			case 'read':
				return Filesystem.readFile(args[0]);
			case 'exec':
				var contents = Filesystem.readFile(args[0]);
				return evaluate(parse(contents), globalEnvironment);
			case 'mkdir':
				var path = Filesystem.makeDir(args[0]);
				return new Array('Directory ' + path + ' created');
			case 'new':
				var path = Filesystem.newFile(args[0]);
				return new Array('File ' + path + ' created');
			case 'save':
				var path = Filesystem.saveFile(args[0], args[1]);
				return new Array('Saved file ' + path);
			case 'append':
				var contents = Filesystem.readFile(args[0]);
				var newContents = contents ? (contents + '\n' + args[1]) : '';
				var path = Filesystem.saveFile(args[0], newContents);
				return new Array('Updated file ' + path);
			case 'mv':
				var paths = Filesystem.copyItem(args[0], args[1]);
				Filesystem.removeItem(args[0]);
				return new Array('Moved ' + paths.oldPath + ' to ' + paths.newPath);
			case 'cp':
				var paths = Filesystem.copyItem(args[0], args[1]);
				return new Array('Copied ' + paths.oldPath + ' to ' + paths.newPath);
			case 'rm':
				var path = Filesystem.removeItem(args[0]);
				return new Array('Removed ' + path);
			case 'file?':
				var file = Filesystem.getFile(args[0]);
				return (file !== undefined && file.type == 'file');
			case 'dir?':
				var folderPath = Filesystem.calculatePath(args[0]);
				return (Filesystem.getDir(folderPath) !== undefined);
			
			// Misc ECMAchine commands
			case 'help':
				return 'The following LISP commands are supported:' + 
						'\n\t +, -, *, /, >, <, =, and, begin, car, cdr, cond, cons, define, filter, if, lambda, length, list, map, not, or, quote' + 
					'\nThe following file-system commands are supported:' +
						'\n\t (ls)                   Lists the contents of the current directory' +
						'\n\t (cd [[i;;]path])              Navigates to another directory' +
						'\n\t (path [[i;;]dir1 dir2 ...])   Constructs a path string [[i;;](e.g. dir1/dir2)] from a list of subdirectories' +
						'\n\t (read [[i;;]filepath])        Displays the contents of a file' +
						'\n\t (exec [[i;;]filepath])        Executes a LISP file' +
						'\n\t (mkdir [[i;;]name])           Creates a new directory' +
						'\n\t (new [[i;;]path])             Creates a new file' +
						'\n\t (save [[i;;]path text])       Saves text to a file, replacing current contents if the file already exists' +
						'\n\t (append [[i;;]path text])     Appends text to an existing file' +
						'\n\t (mv [[i;;]oldpath newpath])   Moves a file or directory to a new location' +
						'\n\t (cp [[i;;]oldpath newpath])   Copies a file or directory to a new location' +
						'\n\t (rm [[i;;]path])              Removes a file or directory' +
						'\n\t (file? [[i;;]path])           Returns whether there is a file at the given path' +
						'\n\t (dir? [[i;;]path])            Returns whether there is a directory at the given path' +
						'\n\t (time [[[i;;]format]])        Displays the current time' + 
						'\n\t (do-nothing)			 Dummy command' +
						'\n\t (help)                 Displays this help screen' +
					'\nThe following commands for dealing with processes are supported:' +
						'\n\t (processes)            Lists the PIDs and filenames of the currently running processes' +
						'\n\t (start [[i;;]path interval])  Starts a LISP program from a file, with the specified refresh rate (in ms)' +
						'\n\t (peek [[i;;]pid])             Shows the code for the process with the specified PID' +
						'\n\t (kill [[i;;]pid])             Kills the process with the specified PID' +
						'\n\t (overlay [[i;;]txt x y id])   Creates or refreshes an overlay with text at position [[i;;](x,y)] on the screen'
					;
			case 'path':
				return args.join('/').replace('//','/');
			case 'time':
				var date = new Date();
                if (args[0] == null)
                	return date.getTime();
                else 
                	return args[0].map(function (str) {
                		switch (str) {
                			case 'h':
                				return date.getHours();
            				case 'm':
            					return date.getMinutes();
        					case 's':
        						return date.getSeconds();
    						default:
    							return str;
                		}
                	});
			case 'do-nothing':
				return;
			
			// For processes
			case 'processes':
				var procs = [];
				for (var pid = 0; pid < processes.length; pid++) {
					if (!processes[pid].terminated) {
						procs.push(new Array(pid, processes[pid].name));
					}
				}
				return procs;
			case 'start':
				// get program
				var contents = Filesystem.readFile(args[0]);
				
				// start interval
				var interval = setInterval(function () {
					var result = evaluate(parse(contents), globalEnvironment);
					if (result !== undefined) {
						terminalEcho(result);
						$(document).scrollTop($(document).height());
					}
				}, evaluate(args[1], environment));
				
				// add to process list
				var pid = processes.push({
					'name': args[0],
					'process': interval,
					'code': contents,
					'terminated': false
				}) - 1;
				
				// and run it once right now
				terminalEcho(new Array('Starting process at ' + args[0] + ' with PID ' + pid));
				return evaluate(parse(contents), globalEnvironment);
			case 'peek':
				if (processes[args[0]] === undefined || processes[args[0]].terminated) {
					throw 'There is no process with PID ' + args[0];
				}
				return processes[args[0]].code;
			case 'kill':
				if (processes[args[0]] === undefined || processes[args[0]].terminated) {
					throw 'There is no process with PID ' + args[0];
				}
				clearInterval(processes[args[0]].process);
				processes[args[0]].terminated = true;
				return new Array('Process with PID ' + args[0] + ' [' + processes[args[0]].name + '] terminated');
			case 'overlay': // (overlay txt x y id)
				var name = args[3], txt = args[0], x = args[1], y = args[2];
				$('#overlays #' + name).remove(); // remove existing overlay w/ same id, if any
				var overlay = $('<div>').attr('id', name).appendTo('#overlays');
				overlay.text('' + txt);
				if (x >= 0) {
					overlay.css('left', x);
				} else {
					overlay.css('right', -x);
				}
				if (y >= 0) {
					overlay.css('top', y);
				} else {
					overlay.css('bottom', -y);
				}
				return;
				
			// JavaScript hook
			case 'js-apply':
				function prepareArg(arg, isObj) {
					if (typeof arg == 'object') { 
						arg = arg.map(function (elt) {
							return prepareArg(elt);
						}).join(','); 
						if (isObj) {
							arg = '[' + arg + ']';
						}
					} else if (typeof arg == 'string') {
						arg = "'" + arg + "'";
					}
					return arg;
				}
			
				var jsFunc = args[0];
				if (args.length == 2) {
					var jsArgs = prepareArg(args[1]);
				} else if (args.length == 3) {
					var jsObj = prepareArg(args[1], true);
					jsFunc = jsObj + '.' + jsFunc;
					var jsArgs = prepareArg(args[2]);
				} else {
					throw 'Eval error: js-apply takes 2 or 3 arguments';
				}
				
				return eval(jsFunc + '(' + jsArgs + ')');
			
			// Not a built-in function: find function in environment and evaluate
			default:
				if (environment[func] === undefined) {
					throw 'Eval Error: function "' + func + '" does not exist';
				}
				var newSexp = clone(sexp);
				newSexp[0] = evaluate(environment[func], environment);
				return evaluate(newSexp, environment);
		}
	} else if (typeof func == 'object') {
		// Evaluate this function
		sexp[0] = evaluate(func, environment);
		return evaluate(sexp, environment);
	} else {
		throw 'Eval Error: ' + func + ' is not a function';
	}
}
