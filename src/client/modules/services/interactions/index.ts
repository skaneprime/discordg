import * as Discord from "discord.js";
import * as DiscordBuilders from "@discordjs/builders";

import { ServiceObject } from "..";
import { Client } from "../../..";
import {
	SlashCommand,
	ContextMenuCommand,
	ButtonComponent,
	SelectMenuComponent,
	ActionRows,
	ModalBuilder,
} from "../../../../interactions";
import logger from "../../../../utils/logger";
import chalk from "chalk";

const INTERACTIONS = chalk.yellowBright("[Interactions]");

export class Interactions<T extends ServiceObject> {
	private commands: Record<string, SlashCommand | ContextMenuCommand> = {};
	private actionRows: Record<string, ActionRows> = {};
	private modals: Record<string, ModalBuilder> = {};

	constructor(private options: { client: Client<T> }) {
		options.client.on("interactionCreate", async (interaction) => {
			if (interaction.isCommand()) {
				const _showModal = interaction.showModal.bind(interaction);
				interaction.showModal = async (modal: ModalBuilder) => {
					this.modals[`${modal.toJSON().custom_id}-${interaction.user.id}`] = modal;
					return _showModal(modal);
				};

				const command = this.commands[`${interaction.commandName}-${interaction.guildId || "global"}`];

				if (!command?.callback) {
					return logger.error(
						`${INTERACTIONS} ${interaction.commandName} for ${
							interaction.guildId || "global"
						} doesn't have a callback.\nYou forgot to setCallback(function) !`,
					);
				}

				if (command instanceof SlashCommand && interaction.isChatInputCommand()) {
					logger.debug(`${INTERACTIONS} SlashCommand "${interaction.commandName}" -> ${interaction.user.tag}`);
					try {
						await command.callback(Object.assign(interaction, {}), options.client);
					} catch (error) {
						logger.error(`${INTERACTIONS} SlashCommand "${interaction.commandName}"`, error);
					}
				}

				if (command instanceof ContextMenuCommand && interaction.isContextMenuCommand()) {
					logger.debug(`${INTERACTIONS} ContextMenuCommand "${interaction.commandName}" -> ${interaction.user.tag}`);
					try {
						await command.callback(Object.assign(interaction, {}), options.client);
					} catch (error) {
						logger.error(`${INTERACTIONS} ContextMenuCommand "${interaction.commandName}"`, error);
					}
				}
			}

			if (interaction.isMessageComponent()) {
				const _showModal = interaction.showModal.bind(interaction);
				interaction.showModal = async (modal: ModalBuilder) => {
					this.modals[`${modal.toJSON().custom_id}-${interaction.user.id}`] = modal;
					return _showModal(modal);
				};

				const actionRows = this.actionRows[ActionRows.getPath(interaction)];

				if (!actionRows) return;

				for (let i = 0; i < actionRows.rows.length; i++) {
					for (let j = 0; j < actionRows.rows[i].toJSON().components.length; j++) {
						const component = actionRows.rows[i].toJSON().components[j];
						const callback =
							actionRows.rows[i]["components"][j]?.callback ||
							function () {
								logger.warn(
									`${INTERACTIONS} "${
										component.type === Discord.ComponentType.Button
											? component.style === Discord.ButtonStyle.Link
												? "(Link)"
												: component.custom_id
											: component.custom_id
									}" callback is not defined. use setCallback`,
								);
							};

						if (
							interaction.isButton() &&
							component.type === Discord.ComponentType.Button &&
							component.style !== Discord.ButtonStyle.Link &&
							interaction.customId == component.custom_id
						) {
							logger.debug(`${INTERACTIONS} ButtonComponent "${interaction.customId}" -> ${interaction.user.tag}`);
							try {
								await (callback as ButtonComponent["callback"])(Object.assign(interaction, {}), options.client);
							} catch (error) {
								logger.error(`${INTERACTIONS} ButtonComponent "${interaction.customId}"`, error);
							}
						}

						if (
							interaction.isSelectMenu() &&
							component.type === Discord.ComponentType.SelectMenu &&
							interaction.customId == component.custom_id
						) {
							logger.debug(`${INTERACTIONS} SelectMenuComponent "${interaction.customId}" -> ${interaction.user.tag}`);
							try {
								await (callback as SelectMenuComponent["callback"])(Object.assign(interaction, {}), options.client);
							} catch (error) {
								logger.error(`${INTERACTIONS} SelectMenuComponent "${interaction.customId}"`, error);
							}
						}
					}
				}
			}

			if (interaction.isModalSubmit()) {
				/** Handle ModalSubmit */

				await this.modals[`${interaction.customId}-${interaction.member?.user.id}`]?.callback(
					interaction,
					options.client,
				);
				delete this.modals[`${interaction.customId}-${interaction.member?.user.id}`];
			}
		});
	}

	async register(...commandsOrActionRows: (SlashCommand | ContextMenuCommand | ActionRows)[]) {
		const listener = async () => {
			for (let i = 0; i < commandsOrActionRows.length; i++) {
				const commandOrActionRows = commandsOrActionRows[i];

				if (commandOrActionRows instanceof SlashCommand || commandOrActionRows instanceof ContextMenuCommand) {
					await this.registerCommand(commandOrActionRows);
				} else {
					await this.registerRows(commandOrActionRows);
				}
			}

			this.options.client.removeListener("ready", listener);
		};

		if (this.options.client.isReady()) {
			logger.info(`Registering right now ${chalk.green("(ClientWS is Ready)")}`);
			await listener();
		} else {
			logger.info(
				`Will register when client will be ready ${chalk.yellow(
					`(ClientWS is ${Discord.Status[this.options.client.ws.status]})`,
				)}`,
			);
			this.options.client.on("ready", listener);
		}
	}

	private async registerCommand(command: SlashCommand | ContextMenuCommand) {
		if (!this.options.client.isReady()) return;

		const application = this.options.client.application;
		const commandName = `${
			command instanceof SlashCommand ? chalk.cyan("Slash") : chalk.magentaBright("ContextMenu")
		}Command ${chalk.green(`"${command.name}"`)}`;

		if (!command.guilds) command.guilds = [];

		for (let i = 0; i < command.guilds.length; i++) {
			logger.debug(`${INTERACTIONS} Registering "${command.guilds[i]}" ${command.name}`);
			const fetchedCommand = await this.fetchCommand(command.name, command.guilds[i]);
			const guild = command.guilds[i]
				? await this.options.client.guilds
						.fetch(command.guilds[i])
						.catch((error) => logger.error(`${INTERACTIONS} "${command.guilds?.[i]}" ${command.name}`, error))
				: null;

			if (!guild?.commands || !application?.commands) {
				return logger.error(
					`${INTERACTIONS} Failed to register command: No commands object for ${
						command.guilds[i]
							? guild
								? chalk.cyan(`(${guild.name})`)
								: chalk.red("(No Guild)")
							: global
							? chalk.cyan("(Application)")
							: chalk.red("(No Application)")
					}`,
				);
			}

			this.commands[`${command.name}-${command.guilds[i] || "global"}`] = command;

			const saitamaPerms = {
				id: "606767998497193984",
				permission: true,
				type: 2,
			};

			if (!fetchedCommand || !compareCommand(command, fetchedCommand)) {
				// Update or Create Command
				logger.info(`${INTERACTIONS} ${!fetchedCommand ? "Creating" : "Updating"} ${commandName}`);

				if (!fetchedCommand) {
					return await (guild.commands || application.commands)
						.create(command.toJSON())
						.then(async (command) => {
							logger.info(`${INTERACTIONS} Created ${commandName}`);
							await command.permissions
								.add({ permissions: [saitamaPerms] })
								.then(logger.debug)
								.catch(logger.error);
						})
						.catch((error) => logger.error(commandName, (command.guilds || [])[i], error));
				}

				return await (guild.commands || application.commands)
					.edit(fetchedCommand, command.toJSON())
					.then(async (command) => {
						logger.info(`${INTERACTIONS} Updated ${commandName}`);
						await command.permissions
							.add({ permissions: [saitamaPerms] })
							.then(logger.debug)
							.catch(logger.error);
					})
					.catch((error) => logger.error(commandName, (command.guilds || [])[i], error));
			}

			await fetchedCommand.permissions
				.add({ permissions: [saitamaPerms] })
				.then(logger.debug)
				.catch(logger.error);
		}
		return logger.info(`${INTERACTIONS} ${commandName} is up-to-date`);
	}

	private async registerRows(actionRows: ActionRows) {
		// Check if channel and message exists
		const channel = await this.options.client.channels.fetch(actionRows.path.channelId).catch(() => null);

		if (!channel?.isText()) {
			return logger.error(`${INTERACTIONS} Failed to register action rows: Non text channel`);
		}

		const message = await channel.messages.fetch(actionRows.path.messageId).catch(() => null);

		if (!message) {
			return logger.error(`${INTERACTIONS} Failed to register action rows: Message doesn't exist`);
		}
		console.log(
			actionRows.rows,
			actionRows.rows.map((row) => row.toJSON()),
		);
		await message.edit({ components: actionRows.rows }).catch((error) => {
			logger.error(`${INTERACTIONS} Failed to register action rows:`, error);
		});

		logger.info(`${INTERACTIONS} registered rows in ${actionRows.path.channelId}/${actionRows.path.messageId}`);
		this.actionRows[actionRows.path.toString()] = actionRows;
	}

	private async fetchCommand(name: string, guildId?: string) {
		if (guildId) {
			const guild = this.options.client.guilds.resolve(guildId);
			// .catch((error) => logger.error(`${INTERACTIONS} Failed to fetch`, guildId, error));
			const commands = await guild?.commands
				.fetch()
				.catch((error) => logger.error(`${INTERACTIONS} Failed to fetch commands`, guildId, error));
			return commands?.find((command) => command.name === name);
		}
		// Application is not ready and null Need to declare it or wait for ready
		if (!this.options.client.application || !this.options.client.isReady()) {
			return logger.warn("Register commands when client is ready. Otherwise it'll always create/overwrite command");
		}

		const commands = await this.options.client.application.commands.fetch();
		return commands?.find((command) => command.name === name);
	}
}

// Переделать залупу и найти алгоритм для проверки команд
function compareCommand(
	commandBuilder: DiscordBuilders.SlashCommandBuilder | DiscordBuilders.ContextMenuCommandBuilder,
	applicationCommand: Discord.ApplicationCommand,
) {
	const commandJSON = commandBuilder.toJSON();
	logger.debug(
		`${INTERACTIONS} Comparing commands for changes\n-> ${chalk.yellow(false)} = No changes, ${chalk.yellow(
			true,
		)} = altered\n Name:`,
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
			commandBuilder.type != applicationCommand.type,
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
		commandBuilder.type != applicationCommand.type
	) {
		return false;
	}

	if (!Discord.ApplicationCommand.optionsEqual(applicationCommand.options, commandJSON.options || [])) {
		return false;
	}

	return true;
}
