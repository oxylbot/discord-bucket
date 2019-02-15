const handler = require("./request-handler");
const zmq = require("zeromq");

class RPCSocket {
	constructor() {
		this.socket = zmq.socket("router");
		this.socket.on("message", this.message.bind(this));
		this.socket.monitor(undefined, 0);

		["connect", "connect_delay", "connect_retry", "listen", "bind_error",
			"accept", "accept_error", "close", "close_error", "disconnect"].forEach(evt => {
			this.socket.on(evt, ...args => console.log(evt, args));
		});

		this.proto = null;
	}

	start(proto) {
		this.proto = proto;

		console.log(`tcp://discord-bucket-zmq-proxy:${process.env.DISCORD_BUCKET_ZMQ_PROXY_SERVICE_PORT_DEALER}`);
		this.socket.connect(`tcp://discord-bucket-zmq-proxy:${process.env.DISCORD_BUCKET_ZMQ_PROXY_SERVICE_PORT_DEALER}`);
	}

	close() {
		this.socket.close();
	}

	async message(proxy, client, message) {
		console.log("proxy", proxy);
		console.log("client", client);
		console.log("msg", message);
		const request = this.proto.rpc.lookup("Request");
		const decoded = request.decode(message);

		console.log("decoded", decoded);
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

		this.socket.send([proxy, client, buffer]);
	}
}

module.exports = RPCSocket;
