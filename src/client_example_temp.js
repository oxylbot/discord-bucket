const path = require("path");
const zmq = require("zeromq");
const waiting = new Map();

const socket = zmq.socket("dealer");
socket.connect("tcp://127.0.0.1:1337");

const protobuf = require("protobufjs");
protobuf.load(path.resolve(__dirname, "..", "protobuf", "DiscordAPI.proto")).then(root => {
	const rpc = (method, data, cb) => {
		const id = (Date.now() + process.hrtime().reduce((a, b) => a + b)).toString(36);

		const request = root.lookupType("RPCRequest");
		const buffer = request.encode({
			requestType: method.requestType,
			responseType: method.responseType,
			id: id,
			data: data
		}).finish();

		socket.send(buffer);

		waiting.set(id, resp => {
			waiting.delete(id);
			return cb(null, resp);
		});
	};

	socket.on("message", message => {
		const response = root.lookupType("RPCResponse");
		const decoded = response.toObject(response.decode(message));

		if(waiting.has(decoded.id)) waiting.get(decoded.id)(decoded.data);
	});

	const greeter = root.lookupService("DiscordAPI")
		.create(rpc, false, false);

	greeter.greet({ greeting: "Hello my friend" }).then(resp => {
		console.log(resp);
	});
});
