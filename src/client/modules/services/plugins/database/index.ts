import * as TypeORM from "typeorm";
import chalk from "chalk";
import { Plugin, PLUGINS } from "..";
import { ServiceObject } from "../..";
import logger from "../../../../../utils/logger";

const DATABASE = chalk.yellow(`[Database]`);

export class Database<T extends ServiceObject> {
	constructor(private plugin: Plugin<T>, private id: string) {}

	private _connection!: TypeORM.Connection;

	get connection() {
		if (!this._connection) {
			return logger.warn(
				`${PLUGINS} ${DATABASE} ${this.plugin.name} tried to access database but no connection established. Please use createConnection to create a one`,
			);
		}
		return this._connection;
	}

	async connect(options: TypeORM.ConnectionOptions) {
		return (this._connection = await TypeORM.createConnection({
			...options,
			name: this.id,
		}));
	}
}
