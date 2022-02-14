export const logger: Dingir.Logger.LoggerService = Dingir.Logger.create({
	label: "DISCRD",
	// file: "./logs/discord.log"
}).enableLevel(1);

export default logger;
