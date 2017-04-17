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
	if(typeof type == "function") {
		type.call(this);
	} else if(Reader.patterns[type]) {
		Reader.patterns[type].call(this);
	} else {
		throw new TypeError("Unclear pattern " + type);
	}
};

Reader.patterns = {
	horizontalMove: function() {
		this.state.horizontalPos = 0;

		this.onKey("Right", function() {
			if(this.state.horizontalPos >= this.state.input.length) {
				return;
			}

			this.state.horizontalPos++;
			this.outStream.write(ansi.cursorForward(1));
		});
		this.onKey("Left", function() {
			if(this.state.horizontalPos <= 0) {
				return;
			}

			this.state.horizontalPos--;
			this.outStream.write(ansi.cursorBackward(1));
		});
		this.onKey("End", function() {
			// Go right
			this.outStream.write(ansi.cursorForward(this.state.input.length - this.state.horizontalPos));

			// Change inner data
			this.state.horizontalPos = this.state.input.length;
		});
		this.onKey("Home", function() {
			// Go left
			this.outStream.write(ansi.cursorForward(this.state.horizontalPos));

			// Change inner data
			this.state.horizontalPos = 0;
		});
		this.on("data", function() {
			this.state.horizontalPos = 0;
		});
	},
	verticalHistory: function() {
		this.onKey("Up", function() {
			// TODO: History
		});
		this.onKey("Down", function() {
			// TODO: History
		});
	},
	exit: function() {
		this.onKey("Ctrl + C", function() {
			// Replace characters with spaces
			this.outStream.write(ansi.cursorBackward(this.state.horizontalPos) + " ".repeat(this.state.input.length));

			// Go left
			this.outStream.write(ansi.cursorBackward(this.state.input.length));

			// Change inner data
			this.state.input = "";
			this.state.horizontalPos = 0;
		});
		this.onKey("Ctrl + D", function() {
			process.exit();
		});
	},
	autoComplete: function() {
		this.onKey("Tab", function() {
			// TODO: Autocomplete
		});
	},
	showInput: function() {
		this.use("horizontalMove");
		this.use("verticalHistory");
		this.use("exit");
		this.use("autoComplete");

		this.state.input = "";
		this.state.visibleInput = "";

		this.on("char", function(ch) {
			var visible = this.state.funcVisible(ch);

			this.outStream.write(visible + this.state.visibleInput.substr(this.state.horizontalPos));
			if(this.state.horizontalPos >= this.state.visibleInput.length) {
				var n = this.state.horizontalPos - this.state.visibleInput.length;
				if(n) {
					this.outStream.write(ansi.cursorForward(n));
				}
			} else {
				this.outStream.write(ansi.cursorBackward(this.state.visibleInput.length - this.state.horizontalPos));
			}

			this.state.input = this.state.input.substr(0, this.state.horizontalPos) + ch + this.state.input.substr(this.state.horizontalPos);
			this.state.visibleInput = this.state.visibleInput.substr(0, this.state.horizontalPos) + visible + this.state.visibleInput.substr(this.state.horizontalPos);
			this.state.horizontalPos++;
		});
		this.onKey("Return", function() {
			this.outStream.write("\n");
			this.emit("data", this.state.input);

			this.state.input = "";
			this.state.visibleInput = "";
		});
		this.onKey("Backspace", function() {
			if(this.state.horizontalPos <= 0) {
				return;
			}

			// Remove character from inner data
			this.state.input = this.state.input.substr(0, this.state.horizontalPos - 1) + this.state.input.substr(this.state.horizontalPos);
			this.state.visibleInput = this.state.visibleInput.substr(0, this.state.horizontalPos - 1) + this.state.visibleInput.substr(this.state.horizontalPos);
			this.state.horizontalPos--;

			this.outStream.write(ansi.cursorBackward(1) + this.state.visibleInput.substr(this.state.horizontalPos) + " " + ansi.cursorBackward(this.state.visibleInput.length - this.state.horizontalPos + 1));
		});
		this.onKey("Clear", function() {
			// Replace characters with spaces
			this.outStream.write(ansi.cursorBackward(this.state.horizontalPos) + " ".repeat(this.state.visibleInput.length));

			// Go left
			this.outStream.write(ansi.cursorBackward(this.state.visibleInput.length));

			// Change inner data
			this.state.input = "";
			this.state.visibleInput = "";
			this.state.horizontalPos = 0;
		});
		this.onKey("Delete", function() {
			if(this.state.horizontalPos >= this.state.visibleInput.length) {
				return;
			}

			// Remove character from inner data
			this.state.input = this.state.input.substr(0, this.state.horizontalPos) + this.state.input.substr(this.state.horizontalPos + 1);
			this.state.visibleInput = this.state.visibleInput.substr(0, this.state.horizontalPos) + this.state.visibleInput.substr(this.state.horizontalPos + 1);

			this.outStream.write(this.state.visibleInput.substr(this.state.horizontalPos) + " " + ansi.cursorBackward(this.state.visibleInput.length - this.state.horizontalPos + 1));
		});
	},
	input: function() {
		this.use("showInput");

		this.state.funcVisible = function(ch) {
			return ch;
		};
	},
	password: function() {
		this.use("showInput");

		this.state.funcVisible = function(ch) {
			return "*";
		};
	}
};

module.exports = Reader;