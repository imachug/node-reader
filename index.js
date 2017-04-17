var ansi = require("ansi-escapes");
var keypress = require("keypress");
var EventEmitter = require("events").EventEmitter;

function Reader(inStream, outStream) {
	this.inStream = inStream;
	this.outStream = outStream;

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
		type(this);
	} else if(Reader.patterns[type]) {
		Reader.patterns[type](this);
	}
};

Reader.patterns = {
	horizontalMove: function(reader) {
		reader.state.horizontalPos = 0;

		reader.onKey("Right", function() {
			if(reader.state.horizontalPos >= reader.state.input.length) {
				return;
			}

			reader.state.horizontalPos++;
			reader.outStream.write(ansi.cursorForward(1));
		});
		reader.onKey("Left", function() {
			if(reader.state.horizontalPos <= 0) {
				return;
			}

			reader.state.horizontalPos--;
			reader.outStream.write(ansi.cursorBackward(1));
		});
		reader.onKey("End", function() {
			// Go right
			reader.outStream.write(ansi.cursorForward(reader.state.input.length - reader.state.horizontalPos));

			// Change inner data
			reader.state.horizontalPos = reader.state.input.length;
		});
		reader.onKey("Home", function() {
			// Go left
			reader.outStream.write(ansi.cursorForward(reader.state.horizontalPos));

			// Change inner data
			reader.state.horizontalPos = 0;
		});
		reader.on("data", function() {
			reader.state.horizontalPos = 0;
		});
	},
	verticalHistory: function(reader) {
		reader.onKey("Up", function() {
			// TODO: History
		});
		reader.onKey("Down", function() {
			// TODO: History
		});
	},
	exit: function(reader) {
		reader.onKey("Ctrl + C", function() {
			// Replace characters with spaces
			reader.outStream.write(ansi.cursorBackward(reader.state.horizontalPos) + " ".repeat(reader.state.input.length));

			// Go left
			reader.outStream.write(ansi.cursorBackward(reader.state.input.length));

			// Change inner data
			reader.state.input = "";
			reader.state.horizontalPos = 0;
		});
		reader.onKey("Ctrl + D", function() {
			process.exit();
		});
	},
	autoComplete: function(reader) {
		reader.onKey("Tab", function() {
			// TODO: Autocomplete
		});
	},
	showInput: function(reader) {
		reader.use("horizontalMove");
		reader.use("verticalHistory");
		reader.use("exit");
		reader.use("autoComplete");
		reader.use("submitInput");

		reader.state.input = "";
		reader.state.visibleInput = "";

		reader.on("char", function(ch) {
			var visible = reader.state.funcVisible(ch);

			reader.outStream.write(visible + reader.state.visibleInput.substr(reader.state.horizontalPos));
			if(reader.state.horizontalPos >= reader.state.visibleInput.length) {
				var n = reader.state.horizontalPos - reader.state.visibleInput.length;
				if(n) {
					reader.outStream.write(ansi.cursorForward(n));
				}
			} else {
				reader.outStream.write(ansi.cursorBackward(reader.state.visibleInput.length - reader.state.horizontalPos - 1));
			}

			reader.state.input = reader.state.input.substr(0, reader.state.horizontalPos) + ch + reader.state.input.substr(reader.state.horizontalPos);
			reader.state.visibleInput = reader.state.visibleInput.substr(0, reader.state.horizontalPos) + visible + reader.state.visibleInput.substr(reader.state.horizontalPos);
			reader.state.horizontalPos++;
		});
		reader.onKey("Return", function() {
			reader.outStream.write("\n");
			reader.emit("data", reader.state.input);

			reader.state.input = "";
			reader.state.visibleInput = "";

			if(reader.autoClose) {
				reader.close();
			}
		});
		reader.onKey("Backspace", function() {
			if(reader.state.horizontalPos <= 0) {
				return;
			}

			// Remove character from inner data
			reader.state.input = reader.state.input.substr(0, reader.state.horizontalPos - 1) + reader.state.input.substr(reader.state.horizontalPos);
			reader.state.visibleInput = reader.state.visibleInput.substr(0, reader.state.horizontalPos - 1) + reader.state.visibleInput.substr(reader.state.horizontalPos);
			reader.state.horizontalPos--;

			reader.outStream.write(ansi.cursorBackward(1) + reader.state.visibleInput.substr(reader.state.horizontalPos) + " " + ansi.cursorBackward(reader.state.visibleInput.length - reader.state.horizontalPos + 1));
		});
		reader.onKey("Clear", function() {
			// Replace characters with spaces
			reader.outStream.write(ansi.cursorBackward(reader.state.horizontalPos) + " ".repeat(reader.state.visibleInput.length));

			// Go left
			reader.outStream.write(ansi.cursorBackward(reader.state.visibleInput.length));

			// Change inner data
			reader.state.input = "";
			reader.state.visibleInput = "";
			reader.state.horizontalPos = 0;
		});
		reader.onKey("Delete", function() {
			if(reader.state.horizontalPos >= reader.state.visibleInput.length) {
				return;
			}

			// Remove character from inner data
			reader.state.input = reader.state.input.substr(0, reader.state.horizontalPos) + reader.state.input.substr(reader.state.horizontalPos + 1);
			reader.state.visibleInput = reader.state.visibleInput.substr(0, reader.state.horizontalPos) + reader.state.visibleInput.substr(reader.state.horizontalPos + 1);

			reader.outStream.write(reader.state.visibleInput.substr(reader.state.horizontalPos) + " " + ansi.cursorBackward(reader.state.visibleInput.length - reader.state.horizontalPos + 1));
		});
	},
	input: function(reader) {
		reader.use("showInput");

		reader.state.funcVisible = function(ch) {
			return ch;
		};
	},
	password: function(reader) {
		reader.use("showInput");

		reader.state.funcVisible = function(ch) {
			return "*";
		};
	}
};

module.exports = Reader;