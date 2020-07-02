const logger = require("./logger");
const path = require("path");
const protobuf = require("protobufjs");

const RequestSocket = require("./RequestSocket");
const socket = new RequestSocket();

async function init() {
	const rpcProto = await protobuf.load(path.resolve(__dirname, "..", "bucket-proto", "rpcWrapper.proto"));
	logger.info("Loaded RPC protobuf");
	const discordProto = await protobuf.load(
		path.resolve(__dirname, "..", "bucket-proto", "service.proto")
	);
	logger.info("Loaded Discord protobuf");

	logger.info("Starting socket");
	socket.start({
		discord: discordProto,
		rpc: rpcProto
	});
}

process.on("unhandledRejection", error => {
	logger.error(error.message, { error });
	process.exit(1);
});

process.on("SIGTERM", () => {
	logger.info("Closing socket due to SIGTERM");
	socket.close();

	process.exit(0);
});

init();
