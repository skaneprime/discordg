import fs from "fs";
import chalk from "chalk";
import chokidar from "chokidar";
import EventEmitter from "eventemitter3";
import { Plugin, EventsListeners } from "./types";
import { Logger } from "../../../../utils/logger";
import { Client } from "../../..";
import { ServiceObject } from "..";

export { Plugin, EventsListeners };

const PLUGINS = `${chalk.yellow(`[Plugins]`)}`

class PluginWatcher<T extends ServiceObject> {
	private watcher: chokidar.FSWatcher;
	private eventEmitter: EventEmitter;

	constructor(folderPath: string) {
		this.eventEmitter = new EventEmitter();
		this.watcher = chokidar.watch(folderPath);
		this.watcher.on("add", (...args) => this.add(...args));
		this.watcher.on("change", (...args) => this.change(...args));
		this.watcher.on("unlink", (...args) => this.unlink(...args));
	}

	private importPlugin(path: string) {
		try {
			if (path.endsWith(".dg")) {
				return (Dingir.compiler.import(path) as { default: unknown }).default as Plugin<T>;
			}
			if (path.endsWith(".ts")) {
				delete require.cache[require.resolve(path)];
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				return require(path).default as Plugin<T>;
			}
		} catch (error) {
			Logger.error(
				`${chalk.yellowBright(`[Plugins.Watcher]`)}: Failed to import plugin "${path}":\n`,
				error,
			);
		}
	}

	private add(path: string, stats?: fs.Stats) {
		Logger.trace(stats);
		const plugin = this.importPlugin(path);
		if (plugin) {
			this.eventEmitter.emit("add", path, plugin);
		}
	}

	private change(path: string, stats?: fs.Stats) {
		Logger.trace(stats);
		const plugin = this.importPlugin(path);
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
	folder: string;
	client: Client<T>;
}

export class Plugins<T extends ServiceObject = ServiceObject> {
	private communication = new EventEmitter();
	private watcher!: PluginWatcher<T>;
	private plugins: Record<string, { plugin: Plugin<T>; listeners: EventsListeners }> = {};

	constructor(private options: PluginsOptions<T>) {
		this.watcher = new PluginWatcher(options.folder);

		this.watcher.on("add", async (path, plugin) => {
			Logger.debug(
				`${PLUGINS} Loading ${chalk.magentaBright("new")} plugin`,
			);
			await this.add(path, plugin).catch((error) => {
				Logger.error(
					`${PLUGINS} An error occured while loading plugin`,
					error,
				);
			});
			Logger.info(
				`${PLUGINS} ${chalk.magentaBright("New")} plugin loaded`,
			);
		});

		this.watcher.on("change", async (path, plugin) => {
			Logger.debug(`${PLUGINS} Updating plugin`);
			await this.change(path, plugin).catch((error) => {
				Logger.error(
					`${PLUGINS} An error occured while updating plugin`,
					error,
				);
			});
			Logger.info(`${PLUGINS} Plugin updated`);
		});

		this.watcher.on("unlink", async (path) => {
			Logger.debug(
				`${PLUGINS} Unloading plugin (${chalk.greenBright(`"${path}"`)})`,
			);
			await this.unlink(path).catch((error) => {
				Logger.error(
					`${chalk.yellowBright(
						`[Plugins]`,
					)}: An error occured while unloading plugin (${chalk.greenBright(`"${path}"`)})`,
					error,
				);
			});
			Logger.info(
				`${PLUGINS} Plugin unloaded (${chalk.greenBright(`"${path}"`)})`,
			);
		});
	}

	private async add(path: string, plugin: Plugin<T>) {
		const listeners = await plugin({
			client: this.options.client,
			onMessage: (callback) => {
				this.communication.on(path, callback);
			},
		});

		for (const key in listeners) {
			const listener = listeners[key as keyof typeof listeners] as Dingir.utils.function.Any;
			const eventKey = Dingir.utils.string.firstLetterToLowerCase(key.slice(2));
			Logger.trace(`${PLUGINS} Adding "${eventKey}" event listener`);
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

		const { listeners } = this.plugins[path];

		for (const key in listeners) {
			const listener = listeners[key as keyof typeof listeners] as Dingir.utils.function.Any;
			const eventKey = Dingir.utils.string.firstLetterToLowerCase(key.slice(2));
			Logger.trace(`${PLUGINS} Removing "${eventKey}" event listener`);
			this.options.client.off(eventKey, listener);
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
				listensTo: Object.keys(listeners),
			};
		});
	}

	send(id: string, ...args: unknown[]) {
		if (!this.plugins[id]) {
			return false;
		}

		return this.communication.emit(id, ...args);
	}
}
