import { Plugin, EventsListeners } from "./client/modules/services/plugins";
/** @public */
export { Plugin, EventsListeners };
/** @public */
export function createPlugin(plugin: Plugin) {
	return plugin;
}
