var ansi = require("ansi-escapes");

module.exports = function() {
	this.use("horizontalMove");
	this.use("exit");

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
};