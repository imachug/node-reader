var ansi = require("ansi-escapes");
var keypress = require("keypress");
var EventEmitter = require("events").EventEmitter;

function Reader(inStream, outStream) {
	this.inStream = inStream || process.stdin;
	this.outStream = outStream || process.stdout;

	this.lastEnterTime = 0;
	this.state = {};
}
Reader.prototype.__proto__ = EventEmitter.prototype;

Reader.prototype.open = function() {
	var self = this;

	this.keypressHandler = function(ch, key) {
		if(key) {
			// Skip Return + Enter or Enter + Return keystrokes
			if(key.name == "enter" || key.name == "return") {
				if(Date.now() - self.lastEnterTime < 50) {
					return;
				} else {
					self.lastEnterTime = Date.now();
				}

				key.name = "return";
			}

			self.emit(self.objectToValue(key), ch, key);

			if(key.name.length == 1 || key.name == "space") {
				self.emit("char", ch, key);
			}
		} else if(ch) {
			self.emit("char", ch, {
				name: ch,
				ctrl: false,
				meta: false,
				shift: false,
				sequence: ch
			});
		}
	};

	keypress(this.inStream);
	this.inStream.setRawMode(true);
	this.inStream.on("keypress", this.keypressHandler);
};
Reader.prototype.close = function() {
	this.inStream.setRawMode(false);
	this.inStream.removeListener("keypress", this.keypressHandler);
};

Reader.prototype.keyToValue = function(e) {
	e = e.split(/[-+]/) // Split by + and -
	     .map(v => v.trim()) // Remove spaces
	     .map(v => v.toLowerCase()); // Lower case

	return this.objectToValue({
		ctrl: e.indexOf("ctrl") > -1,
		meta: e.indexOf("meta") > -1,
		shift: e.indexOf("shift") > -1,
		name: e[e.length - 1].toLowerCase()
	});
};
Reader.prototype.objectToValue = function(key) {
	return "key" +
		[
			key.ctrl ? "ctrl" : null,
			key.meta ? "meta" : null,
			key.shift ? "shift" : null,
			key.name
		]
		.filter(v => v !== null)
		.join("+");
};
Reader.prototype.onKey = function(e, handler) {
	this.on(this.keyToValue(e), handler);
};
Reader.prototype.removeListenerKey = function(e, handler) {
	this.removeListener(this.keyToValue(e), handler);
};
Reader.prototype.emitKey = function(e) {
	var args = Array.prototype.slice.call(arguments, 1);
	this.emit.apply(this, [this.keyToValue(e)].concat(args));
};

Reader.prototype.use = function(type) {
	var args = Array.prototype.slice.call(arguments, 1);

	if(typeof type == "function") {
		type.apply(this, args);
	} else if(Reader.patterns[type]) {
		Reader.patterns[type].apply(this, args);
	} else {
		try {
			require("./patterns/" + type.replace(/(.[A-Z])/, function(s) {
				return s[0] + "-" + s[1].toLowerCase();
			})).apply(this, args);
		} catch(e) {
			throw new TypeError("Unclear pattern " + type);
		}
	}
};

// Deprecated, use ./patterns/ instead.
Reader.patterns = {};

module.exports = Reader;