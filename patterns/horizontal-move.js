var ansi = require("ansi-escapes");

module.exports = function() {
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
};