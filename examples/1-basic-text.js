var Reader = require("../index.js");

process.stdout.write("Default input field: ");

process.stdin.resume();
process.stdin.once("data", function(data) {
	process.stdout.write("Got " + data.toString());


	process.stdout.write("Reader input field: ");

	var reader = new Reader();
	reader.use("input");
	reader.open();
	reader.on("data", function(data) {
		process.stdout.write("Got " + data + "\n");
		process.exit();
	});
});