const handler = require("./request-handler");
const zmq = require("zeromq");

class RPCSocket {
	constructor() {
		this.socket = zmq.socket("router");
		this.socket.on("message", this.message.bind(this));

		this.proto = null;
	}

	start(proto) {
		this.proto = proto;

		this.socket.connect(`tcp://discord-bucket-zmq-proxy:${process.env.DISCORD_BUCKET_ZMQ_PROXY_SERVICE_PORT_ROUTER}`);
	}

	close() {
		this.socket.close();
	}

	async message(client, message) {
		const request = this.proto.rpc.lookup("Request");
		const decoded = request.decode(message);
		console.log("Got a message", decoded);

		const requestType = this.proto.discord.lookup(decoded.requestType);
		const result = await handler(decoded.name, requestType.decode(decoded.data));

		const responseType = this.proto.discord.lookup(result.responseType);
		const verifyError = responseType.verify(result.data);
		if(verifyError) throw new Error(verifyError);

		const buffer = this.proto.rpc.lookup("Response").encode({
			id: decoded.id,
			responseType: result.responseType,
			data: responseType.encode(responseType.fromObject(result.data)).finish()
		}).finish();

		this.socket.send([client, buffer]);
	}
}

module.exports = RPCSocket;
