export const logger: Dingir.Logger.LoggerService = Dingir.Logger.create({
	label: "DISCRD",
	logFilePath: "./logs/discord.log",
}).enableLevel(Dingir.Logger.LogLevel.DEBUG);

export default logger;
