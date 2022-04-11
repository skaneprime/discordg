import fs from "fs";
import chalk from "chalk";
import chokidar from "chokidar";
import EventEmitter from "eventemitter3";
import { resolve, basename } from "path";
import jsonStableStringify from "json-stable-stringify";
import { Plugin, EventsListeners, Config } from "./types";
import logger from "../../../../utils/logger";
import { Client } from "../../..";
import { ServiceObject } from "..";
import { Database } from "./database";
import { getConnection, TypeORMError } from "typeorm";
import { TypedEventEmitter } from "../../../../utils/typedemitter";

export { Plugin, EventsListeners };

export const PLUGINS = `${chalk.yellow(`[Plugins]`)}`;

class PluginWatcher<T extends ServiceObject> {
	private watcher: chokidar.FSWatcher;
	private eventEmitter: EventEmitter;

	constructor(folderPath: string) {
		this.eventEmitter = new EventEmitter();
		this.watcher = chokidar.watch(`${folderPath}/**/*.{ts,dg}`, { cwd: process.cwd() });
		this.watcher.on("add", (...args) => this.add(...args));
		this.watcher.on("change", (...args) => this.change(...args));
		this.watcher.on("unlink", (...args) => this.unlink(...args));
	}

	public static importPlugin<T extends ServiceObject>(path: string) {
		path = require.resolve(`${process.cwd()}/${path}`, {
			paths: [process.cwd(), `${process.cwd()}/node_modules`],
		});

		try {
			delete require.cache[path];
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			return require(path).default as Plugin<T>;
		} catch (error) {
			logger.error(`${chalk.yellowBright(`[Plugins.Watcher]`)}: Failed to import plugin "${path}":\n`, error);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private add(path: string, stats?: fs.Stats) {
		// Logger.trace(stats);
		const plugin = PluginWatcher.importPlugin<T>(path);
		if (plugin) {
			this.eventEmitter.emit("add", path, plugin);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private change(path: string, stats?: fs.Stats) {
		// Logger.trace(stats);
		const plugin = PluginWatcher.importPlugin<T>(path);
		if (plugin) {
			this.eventEmitter.emit("change", path, plugin);
		}
	}
	private unlink(path: string) {
		this.eventEmitter.emit("unlink", path);
	}

	on(event: "add", callback: (path: string, plugin: Plugin<T>) => void): this;
	on(event: "change", callback: (path: string, plugin: Plugin<T>) => void): this;
	on(event: "unlink", callback: (path: string) => void): this;
	public on(event: string, callback: (path: string, plugin: Plugin<T>) => void) {
		this.eventEmitter.on(event, callback);
		return this;
	}
}

interface PluginsOptions<T extends ServiceObject> {
	folder?: string;
	plugins: (Plugin<T> | string)[];
	client: Client<T>;
}

type InternalEmitter<T extends ServiceObject> = TypedEventEmitter<{
	add: [string, Plugin<T>];
	change: [string, Plugin<T>];
	unlink: [string];
}>;

export class Plugins<T extends ServiceObject = ServiceObject> {
	private communication = new EventEmitter();
	private watcher?: PluginWatcher<T> | InternalEmitter<T>;
	private plugins: Record<string, { plugin: Plugin<T>; listeners: EventsListeners }> = {};

	constructor(private options: PluginsOptions<T>) {
		this.watcher = options.folder ? new PluginWatcher(options.folder) : undefined;

		this.watcher?.on("add", async (path, plugin) => {
			logger.debug(`${PLUGINS} Loading (${chalk.greenBright(`"${path}"`)})`);
			await this.add(path, plugin).catch((error) => {
				logger.error(`${PLUGINS} An error occured while loading plugin (${chalk.greenBright(`"${path}"`)})`, error);
			});
			logger.info(`${PLUGINS} (${chalk.greenBright(`"${path}"`)}) loaded`);
		});

		this.watcher?.on("change", async (path, plugin) => {
			logger.debug(`${PLUGINS} Updating (${chalk.greenBright(`"${path}"`)})`);
			await this.change(path, plugin).catch((error) => {
				logger.error(`${PLUGINS} An error occured while updating plugin (${chalk.greenBright(`"${path}"`)})`, error);
			});
			logger.info(`${PLUGINS} Plugin updated (${chalk.greenBright(`"${path}"`)})`);
		});

		this.watcher?.on("unlink", async (path) => {
			logger.debug(`${PLUGINS} Unloading plugin (${chalk.greenBright(`"${path}"`)})`);
			await this.unlink(path).catch((error) => {
				logger.error(
					`${chalk.yellowBright(`[Plugins]`)}: An error occured while unloading plugin (${chalk.greenBright(
						`"${path}"`,
					)})`,
					error,
				);
			});
			logger.info(`${PLUGINS} Plugin unloaded (${chalk.greenBright(`"${path}"`)})`);
		});

		options.plugins.forEach(async (pluginOrPath) => {
			const Plugin = typeof pluginOrPath != "string" ? pluginOrPath : PluginWatcher.importPlugin(pluginOrPath);

			if (!Plugin) return;

			logger.debug(`${PLUGINS} Loading ${chalk.cyanBright(Plugin.name)} `);
			await this.add(typeof pluginOrPath === "string" ? pluginOrPath : `ExternalImport::${Plugin.name}`, Plugin).catch(
				(error) => {
					logger.error(`${PLUGINS} An error occured while loading ${chalk.cyanBright(Plugin)}`, error);
				},
			);
			logger.info(`${PLUGINS} ${chalk.cyanBright(Plugin.name)} loaded`);
		});
	}

	private async add(path: string, plugin: Plugin<T>) {
		const listeners =
			(await plugin({
				client: this.options.client,
				database: new Database(plugin, path),
				onMessage: (callback) => {
					this.communication.on(path, callback);
				},
				getConfig: <T>(filename: string | T, defaultData?: T): Config<T> => {
					const configFileName =
						typeof filename === "string"
							? filename
							: plugin.name.length === 0
							? `${basename(path, `.${path.split(".").pop()}`)}.json`
							: `${plugin.name}.json`;

					const configpath = resolve(process.cwd(), this.options.folder || "plugincfgs", "configs", configFileName);

					return {
						getPath: () => configpath,
						get: (type = "json") => {
							// Validate config structure by comparing with default data
							Dingir.Utils.fs.ensureDirectoryExistence(configpath);

							if (!fs.existsSync(configpath)) {
								fs.writeFileSync(
									configpath,
									jsonStableStringify(typeof filename === "string" ? defaultData : filename, {
										space: 4,
									}),
								);
								return typeof filename === "string" ? defaultData : filename;
							}

							if (type == "json") {
								delete require.cache[require.resolve(configpath)];
								// eslint-disable-next-line @typescript-eslint/no-var-requires
								const jsonConfig = require(configpath);
								switch (typeof jsonConfig) {
									case "object":
										return Object.assign(typeof filename === "string" ? defaultData : filename, jsonConfig);
									default:
										return jsonConfig;
								}
							} else {
								logger.warn(`<config>.${type} is not supported yet`);
							}
						},
						save: (data) => {
							delete require.cache[configpath];
							Dingir.Utils.fs.ensureDirectoryExistence(configpath);
							return fs.promises.writeFile(configpath, jsonStableStringify(data, { space: 4 }));
						},
					};
				},
			})) || {};

		for (const key in listeners) {
			const listener = listeners[key as keyof typeof listeners] as Dingir.Utils.Function.Any;
			const eventKey = Dingir.Utils.String.firstLetterToLowerCase(key.slice(2));
			logger.trace(`${PLUGINS} Adding "${eventKey}" event listener`);
			this.options.client.on(eventKey, listener);
		}

		this.plugins[path] = { plugin, listeners };
	}

	private async change(path: string, plugin: Plugin<T>) {
		await this.unlink(path);
		await this.add(path, plugin);
	}

	private async unlink(path: string) {
		if (!this.plugins[path]) return;

		const { listeners, plugin } = this.plugins[path];

		for (const key in listeners) {
			const listener = listeners[key as keyof typeof listeners] as Dingir.Utils.Function.Any;
			const eventKey = Dingir.Utils.String.firstLetterToLowerCase(key.slice(2));
			logger.trace(`${PLUGINS} Removing "${eventKey}" event listener`);
			this.options.client.off(eventKey, listener);
		}
		try {
			await getConnection(path).close();
			logger.debug(`${PLUGINS} database connection of ${plugin.name} closed`);
		} catch (error) {
			if (error instanceof TypeORMError && error?.name === "ConnectionNotFoundError") {
				return logger.debug(`${PLUGINS} there was no database connection from ${plugin.name}`);
			}
			logger.error(`${PLUGINS} Failed to close database connection of ${plugin.name} due to:`, error);
		}
		delete this.plugins[path];
	}

	getId(name: string) {
		const entries = Object.entries(this.plugins);
		const [path] = entries.find(([, { plugin }]) => plugin.name === name) || [];
		return path;
	}

	getList() {
		return Object.entries(this.plugins).map(([path, { plugin, listeners }]) => {
			return {
				name: plugin.name,
				id: path,
				listensTo: Object.keys(listeners).map((key) => Dingir.Utils.String.firstLetterToLowerCase(key.slice(2))),
			};
		});
	}

	send(id: string, ...args: unknown[]) {
		if (!this.plugins[id]) {
			return false;
		}

		return this.communication.emit(id, this.plugins[id].plugin.name, ...args);
	}
}
