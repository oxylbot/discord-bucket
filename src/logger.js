const { createLogger, format, transports } = require("winston");
const logger = createLogger();

if(process.env.NODE_ENV === "development") {
	logger.level = "debug";
	logger.add(new transports.Console({
		format: format.prettyPrint()
	}));
} else if(process.env.NODE_ENV === "staging") {
	logger.level = "verbose";
	logger.add(new transports.Console());
} else {
	logger.add(new transports.Console());
}

module.exports = logger;
