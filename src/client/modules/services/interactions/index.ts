import * as Discord from "discord.js";
import * as DiscordBuilders from "@discordjs/builders";

import { ServiceObject } from "..";
import { Client } from "../../..";
import {
	SlashCommand,
	ContextMenuCommand,
	ButtonComponent,
	SelectMenuComponent,
	MessageActionRows,
} from "../../../../interactions";
import { Logger } from "../../../../utils/logger";
import chalk from "chalk";

const INTERACTIONS = chalk.yellowBright("[Interactions]");

export class Interactions<T extends ServiceObject> {
	private commands: Record<string, SlashCommand | ContextMenuCommand> = {};
	private actionRows: Record<string, MessageActionRows> = {};

	constructor(private options: { client: Client<T> }) {
		options.client.on("interactionCreate", async (interaction) => {
			if (interaction.isApplicationCommand()) {
				const command =
					this.commands[`${interaction.commandName}-${interaction.guildId || "global"}`];

				if (!command.callback) {
					return Logger.error(
						`${INTERACTIONS} ${interaction.commandName} for ${
							interaction.guildId || "global"
						} doesn't have a callback.\nYou forgot to setCallback(function) !`,
					);
				}

				if (command instanceof SlashCommand && interaction.isCommand()) {
					Logger.debug(
						`${INTERACTIONS} SlashCommand "${interaction.commandName}" -> ${interaction.user.tag}`,
					);
					try {
						await command.callback(interaction, options.client);
					} catch (error) {
						Logger.error(`${INTERACTIONS} SlashCommand "${interaction.commandName}"`, error);
					}
				}

				if (command instanceof ContextMenuCommand && interaction.isContextMenu()) {
					Logger.debug(
						`${INTERACTIONS} ContextMenuCommand "${interaction.commandName}" -> ${interaction.user.tag}`,
					);
					try {
						await command.callback(interaction, options.client);
					} catch (error) {
						Logger.error(`${INTERACTIONS} ContextMenuCommand "${interaction.commandName}"`, error);
					}
				}
			}

			if (interaction.isMessageComponent()) {
				const actionRows = this.actionRows[MessageActionRows.getPath(interaction)];

				for (let i = 0; i < actionRows.rows.length; i++) {
					for (let j = 0; j < actionRows.rows[i].components.length; j++) {
						const component = actionRows.rows[i].components[j];

						if (
							component instanceof ButtonComponent &&
							interaction.isButton() &&
							interaction.customId == component.customId
						) {
							Logger.debug(
								`${INTERACTIONS} ButtonComponent "${interaction.customId}" -> ${interaction.user.tag}`,
							);
							try {
								await component.callback(interaction, options.client);
							} catch (error) {
								Logger.error(`${INTERACTIONS} ButtonComponent "${interaction.customId}"`, error);
							}
						}

						if (
							component instanceof SelectMenuComponent &&
							interaction.isSelectMenu() &&
							interaction.customId == component.customId
						) {
							Logger.debug(
								`${INTERACTIONS} SelectMenuComponent "${interaction.customId}" -> ${interaction.user.tag}`,
							);
							try {
								await component.callback(interaction, options.client);
							} catch (error) {
								Logger.error(
									`${INTERACTIONS} SelectMenuComponent "${interaction.customId}"`,
									error,
								);
							}
						}
					}
				}
			}
		});
	}

	async register(
		...commandsOrActionRows: (SlashCommand | ContextMenuCommand | MessageActionRows)[]
	) {
		for (let i = 0; i < commandsOrActionRows.length; i++) {
			const commandOrActionRows = commandsOrActionRows[i];

			if (
				commandOrActionRows instanceof SlashCommand ||
				commandOrActionRows instanceof ContextMenuCommand
			) {
				await this.registerCommand(commandOrActionRows);
			} else {
				await this.registerRows(commandOrActionRows);
			}
		}
	}

	private async registerCommand(command: SlashCommand | ContextMenuCommand) {
		const commandName = `${
			command instanceof SlashCommand ? chalk.cyan("Slash") : chalk.magentaBright("ContextMenu")
		}${chalk.yellow("Command")} ${chalk.green(`"${command.name}"`)}`;
		const fetchedCommand = await this.fetchCommand(command.name, command.guildId);
		const { commands } = command.guildId
			? (await this.options.client.guilds.fetch(command.guildId)) || {}
			: this.options.client.application || {};

		if (!commands) {
			return Logger.error(`${INTERACTIONS} Failed to register command: No commands object`);
		}

		this.commands[`${command.name}-${command.guildId || "global"}`] = command;

		if (!fetchedCommand || !compareCommand(command, fetchedCommand)) {
			// Update or Create Command
			Logger.info(`${INTERACTIONS} ${!fetchedCommand ? "Creating" : "Updating"} ${commandName}`);
			return await commands.create(command.toJSON()); // Command#create Also updates
		}

		return Logger.info(`${INTERACTIONS} ${commandName} is up-to-date`);
	}

	private async registerRows(actionRows: MessageActionRows) {
		const channel = await this.options.client.channels.fetch(actionRows.path.channelId);

		if (!channel?.isText()) {
			return Logger.error(`${INTERACTIONS} Failed to register action rows: Non text channel`);
		}

		const message = await channel.messages.fetch(actionRows.path.messageId);

		await message.edit({ components: actionRows.rows }).catch((error) => {
			Logger.error(`${INTERACTIONS} Failed to register action rows:`, error);
		});
		Logger.info(`${INTERACTIONS} registered rows`);
		this.actionRows[actionRows.path.toString()] = actionRows;
	}

	private async fetchCommand(name: string, guildId?: string) {
		if (guildId) {
			const guild = await this.options.client.guilds.fetch(guildId);
			const commands = await guild.commands.fetch();
			return commands.find((command) => command.name === name);
		}

		const commands = await this.options.client.application?.commands.fetch();
		return commands?.find((command) => command.name === name);
	}
}

// Переделать залупу и найти алгоритм для проверки команд
function compareCommand(
	commandBuilder: DiscordBuilders.SlashCommandBuilder | DiscordBuilders.ContextMenuCommandBuilder,
	applicationCommand: Discord.ApplicationCommand,
) {
	const commandJSON = commandBuilder.toJSON();
	Logger.debug(
		`${INTERACTIONS} Comparing commands for changes\n-> ${chalk.yellow(
			false,
		)} = No changes, ${chalk.yellow(true)} = altered\n Name:`,
		commandBuilder.name != applicationCommand.name,
		"\n",

		"DefaultPermission:",
		(commandBuilder.defaultPermission === undefined ? true : commandBuilder.defaultPermission) !=
			applicationCommand.defaultPermission,
		"\n",

		"Description",
		commandBuilder instanceof DiscordBuilders.SlashCommandBuilder &&
			commandBuilder.description != applicationCommand.description,
		"\n",

		"Type:",
		commandBuilder instanceof DiscordBuilders.ContextMenuCommandBuilder &&
			commandBuilder.type !=
				Discord.Constants.ApplicationCommandTypes[applicationCommand.type].valueOf(),
		"\n",

		"OptionsEquality",
		!Discord.ApplicationCommand.optionsEqual(applicationCommand.options, commandJSON.options || []),
	);

	if (commandBuilder.name != applicationCommand.name) return false;
	if (
		(commandBuilder.defaultPermission === undefined ? true : commandBuilder.defaultPermission) !=
		applicationCommand.defaultPermission
	)
		return false;
	if (
		commandBuilder instanceof DiscordBuilders.SlashCommandBuilder &&
		commandBuilder.description != applicationCommand.description
	) {
		return false;
	}

	if (
		commandBuilder instanceof DiscordBuilders.ContextMenuCommandBuilder &&
		commandBuilder.type !=
			Discord.Constants.ApplicationCommandTypes[applicationCommand.type].valueOf()
	) {
		return false;
	}

	if (
		!Discord.ApplicationCommand.optionsEqual(applicationCommand.options, commandJSON.options || [])
	) {
		return false;
	}

	return true;
}
