import * as Discord from '../build/discord@0.9.5';

export default Discord.Plugins.createPlugin(function My2Plugin() {
    return {
        onMessageCreate(arg, msg) {
            console.log(msg.content)
        }
    }
})