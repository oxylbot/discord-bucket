const fs = require("fs").promises;
const Redis = require("ioredis");

async function init() {
	const token = await fs.readFile("/etc/secrets/bot_token", "utf8");
	const port = parseInt(await fs.readFile("/etc/secrets/redis_port", "utf8"));
	const host = await fs.readFile("/etc/secrets/redis_host", "utf8");
	const db = parseInt(await fs.readFile("/etc/secrets/redis_db", "utf8"));

	const redis = new Redis({
		port,
		host,
		family: 4,
		db
	});
}

init();
