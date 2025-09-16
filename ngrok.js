const ngrok = require("ngrok");

(async () => {
	try {
		const url = await ngrok.connect({
			proto: "http",
			addr: 3000,
			region: "us",
		});
		console.log(`Public URL: ${url}`);
		console.log(`Webhook URL: ${url}/api/notion-webhook`);
		console.log("Keep this process running");
	} catch (error) {
		console.error("Ngrok error:", error);
		process.exit(1);
	}
})();
