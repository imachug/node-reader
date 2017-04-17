var ansi = require("ansi-escapes");

module.exports = function() {
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
};