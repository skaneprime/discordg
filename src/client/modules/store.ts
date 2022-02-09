import fs from "fs";
import jsonStableStringify from "json-stable-stringify";
// import { highlight } from 'cli-highlight';
// import { Logger } from "../../utils/logger";

/** @public */
export class Module {
	private files: Record<string, FileStore> = {};
	private memories: Record<string, MemoryStore> = {};

	getFile(filePath: string) {
		return this.files[filePath] || (this.files[filePath] = new FileStore(filePath));
	}

	getMem(storeKey: string) {
		return this.memories[storeKey] || (this.memories[storeKey] = new MemoryStore());
	}
}

class FileStore {
	constructor(private filePath: string) {}

	read() {
		return fs.promises.readFile(this.filePath, "utf8");
	}

	async readJson() {
		const file = await this.read();

		return JSON.parse(file);
	}

	write(data: string) {
		return fs.promises.writeFile(this.filePath, data);
	}

	async writeJson(data: Dingir.utils.types.JSONValue) {
		const stringifiedData = jsonStableStringify(data);

		await this.write(stringifiedData);
	}
}

class MemoryStore {
	private data = {} as Record<string | symbol, unknown>;

	get<T>(key: string) {
		return this.data[key] as T;
	}

	set<T>(key: string, value: T) {
		return (this.data[key] = value);
	}
}
