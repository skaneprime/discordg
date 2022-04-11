import fs from "fs";
import path from "path";
import jsonStableStringify from "json-stable-stringify";

const files: Record<string, FileStore<Dingir.Utils.Types.JSONValue>> = {};
const memories: Record<string, MemoryStore> = {};
/** @public */
export const Store = {
	getFile<T extends Dingir.Utils.Types.JSONValue>(filePath: string, defaultData?: T) {
		filePath = path.resolve(process.cwd(), ".store", filePath);
		return (files[filePath] || (files[filePath] = new FileStore<T>(filePath, defaultData))) as FileStore<T>;
	},
	getMem(storeKey: string) {
		return memories[storeKey] || (memories[storeKey] = new MemoryStore());
	},
};
/** @public */
export class FileStore<T extends Dingir.Utils.Types.JSONValue> {
	constructor(public readonly filePath: string, private defaultData?: T) {
		Dingir.Utils.fs.ensureDirectoryExistence(filePath);
		if (!fs.existsSync(filePath)) {
			fs.writeFileSync(filePath, jsonStableStringify(defaultData) || "");
		}
	}

	read() {
		return fs.promises.readFile(this.filePath, "utf8");
	}

	async readJson() {
		const file = await this.read();
		const parsed = JSON.parse(file);

		switch (typeof parsed) {
			case "object":
				return Object.assign(this.defaultData, parsed) as T;
			default:
				return parsed as T;
		}
	}

	write(data: string) {
		return fs.promises.writeFile(this.filePath, data);
	}

	async writeJson(data: T) {
		const stringifiedData = jsonStableStringify(data);

		await this.write(stringifiedData);
	}

	delete() {
		return fs.promises.unlink(this.filePath);
	}

	async isEmpty() {
		const file = await this.read();

		return file.length === 0;
	}
}
/** @public */
export class MemoryStore {
	private data = {} as Record<string | symbol, unknown>;

	get<T>(key: string) {
		return this.data[key] as T;
	}

	set<T>(key: string, value: T) {
		return (this.data[key] = value);
	}
}
