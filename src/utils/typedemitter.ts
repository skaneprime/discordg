export type EventMap = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any[];
};

/**
 * Type-safe event emitter.
 *
 * Use it like this:
 *
 * ```typescript
 * type MyEvents = {
 *   error: (error: Error) => void;
 *   message: (from: string, content: string) => void;
 * }
 *
 * const myEmitter = new EventEmitter() as TypedEmitter<MyEvents>;
 *
 * myEmitter.emit("error", "x")  // <- Will catch this type error;
 * ```
 */
export interface TypedEventEmitter<Events extends EventMap> {
	addListener<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
	on<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
	once<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
	prependListener<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
	prependOnceListener<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;

	off<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;
	removeAllListeners<E extends keyof Events>(event?: E): this;
	removeListener<E extends keyof Events>(event: E, listener: (...args: Events[E]) => void): this;

	emit<E extends keyof Events>(event: E, ...args: Events[E]): boolean;
	// The sloppy `eventNames()` return type is to mitigate type incompatibilities - see #5
	eventNames(): (keyof Events | string | symbol)[];
	rawListeners<E extends keyof Events>(event: E): ((...args: Events[E]) => void)[];
	listeners<E extends keyof Events>(event: E): ((...args: Events[E]) => void)[];
	listenerCount<E extends keyof Events>(event: E): number;

	getMaxListeners(): number;
	setMaxListeners(maxListeners: number): this;
}
