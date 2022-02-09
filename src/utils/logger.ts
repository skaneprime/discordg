export const Logger: Dingir.logger.LoggerService = Dingir.logger.create({
	label: "DISCRD",
	// debug: true,
	// file: "./logs/discord.log"
});
Logger.enableLevel(1);
