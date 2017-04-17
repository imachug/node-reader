var ansi = require("ansi-escapes");

module.exports = function() {
	this.onKey("Ctrl + C", function() {
		this.emit("reset");
	});
	this.onKey("Ctrl + D", function() {
		process.exit();
	});
};