const path = require("path");
const protobuf = require("protobufjs");

const RequestSocket = require("./RequestSocket");
const socket = new RequestSocket(process.env.BUCKET_SOCKET_ADDRESS);

async function init() {
	const rpcProto = await protobuf.load(path.resolve(__dirname, "..", "protobuf", "rpcWrapper.proto"));
	const discordProto = await protobuf.load(
		path.resolve(__dirname, "..", "protobuf", "discordapi", "service.proto")
	);

	socket.start({
		discord: discordProto,
		rpc: rpcProto
	});
}

process.on("unhandledRejection", error => {
	console.error(error.stack);
	process.exit(1);
});

process.on("SIGTERM", () => {
	socket.close();

	process.exit(0);
});

init();
