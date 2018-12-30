const fs = require("fs").promises;
const path = require("path");
const protobuf = require("protobufjs");
const Redis = require("ioredis");
const RPCSocket = require("./RPCSocket");

const socket = new RPCSocket(process.env.ZMQ_RPC_SOCKET_ADDRESS);

async function init() {
	const token = await fs.readFile("/etc/secrets/token.txt", "utf8");
	const host = await fs.readFile("/etc/secrets/redis-host.txt", "utf8");

	const redis = new Redis({
		port: parseInt(process.env.REDIS_PORT),
		host,
		family: 4,
		db: parseInt(process.env.REDIS_DATABASE)
	});

	const request = require("./request")(redis, token);
	const proto = await protobuf.load(path.resolve(__dirname, "..", "protobuf", "DiscordAPI.proto"));
	socket.start(request, proto);
}

process.on("SIGTERM", () => {
	socket.close();

	process.exit(0);
});

init();
