"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.procMessage = void 0;
const instance = __importStar(require("./bot"));
const bot_1 = require("./bot");
const assert_1 = __importDefault(require("assert"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const procMessage = async (message, database) => {
    let chatid = message.chat.id.toString();
    let chatType = message.chat.type;
    let session = instance.sessions.get(chatid);
    let userName = message?.chat?.username;
    let messageId = message?.messageId;
    if (message.photo) {
        console.log(message.photo);
        processSettings(message, database);
    }
    if (message.animation) {
        console.log(message.animation);
        processSettings(message, database);
    }
    if (!message.text)
        return;
    let command = message.text;
    if (message.entities) {
        for (const entity of message.entities) {
            if (entity.type === 'bot_command') {
                command = command.substring(entity.offset, entity.offset + entity.length);
                break;
            }
        }
    }
    if (command.startsWith('/')) {
        if (!session) {
            console.log(`@${userName} session has been permitted through whitelist`);
            session = await instance.createSession(chatid, userName, chatType);
            session.permit = 1;
            await database.updateUser(session);
        }
        if (userName && session.username !== userName) {
            session.username = userName;
            await database.updateUser(session);
        }
        let params = message.text.split(' ');
        if (params.length > 0 && params[0] === command) {
            params.shift();
        }
        command = command.slice(1);
        if (command === instance.COMMAND_START) {
        }
        else {
            console.log(`Command Execute: /${command} ${params}`);
            if (instance._command_proc) {
                instance._command_proc(session, command, params, messageId);
            }
        }
    }
    else if (message.reply_to_message) {
        processSettings(message, database);
        await instance.removeMessage(chatid, message.message_id);
        await instance.removeMessage(chatid, message.reply_to_message.message_id);
    }
};
exports.procMessage = procMessage;
const processSettings = async (msg, database) => {
    const sessionId = msg.chat?.id.toString();
    const session = instance.sessions.get(sessionId);
    if (!session) {
        return;
    }
    let stateNode = instance.stateMap_getFocus(sessionId);
    if (!stateNode) {
        instance.stateMap_setFocus(sessionId, bot_1.StateCode.IDLE, { sessionId: sessionId });
        stateNode = instance.stateMap_get(sessionId);
        (0, assert_1.default)(stateNode);
    }
    const stateData = stateNode.data;
};
//# sourceMappingURL=bot_private.js.map