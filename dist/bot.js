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
exports.executeCommand = exports.reloadCommand = exports._callback_proc = exports._command_proc = exports.setDefaultSettings = exports.getTokenMcap = exports.defaultConfig = exports.createSession = exports.json_confirm = exports.json_info = exports.sendOptionMessage = exports.sendInfoMessage = exports.sendMessage = exports.sendReplyMessage = exports.removeMessage = exports.removeMenu = exports.stateMap_clear = exports.stateMap_remove = exports.stateMap_get = exports.stateMap_getMessage_Id = exports.stateMap_getMessage = exports.stateMap_setMessage_Id = exports.stateMap_init = exports.stateMap_getFocus = exports.stateMap_setFocus = exports.stateMap = exports.sessions = exports.myInfo = exports.bot = exports.StateCode = exports.OptionCode = exports.COMMAND_START = void 0;
exports.sendPhoto = sendPhoto;
exports.sendText = sendText;
exports.showSessionLog = showSessionLog;
exports.init = init;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database = __importStar(require("./db"));
const privateBot = __importStar(require("./bot_private"));
const afx = __importStar(require("./global"));
const utils = __importStar(require("./utils"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
exports.COMMAND_START = 'start';
var OptionCode;
(function (OptionCode) {
    OptionCode[OptionCode["BACK"] = -100] = "BACK";
    OptionCode[OptionCode["CLOSE"] = -99] = "CLOSE";
    OptionCode[OptionCode["TITLE"] = -98] = "TITLE";
    OptionCode[OptionCode["WELCOME"] = 0] = "WELCOME";
    OptionCode[OptionCode["MAIN_MENU"] = 1] = "MAIN_MENU";
    OptionCode[OptionCode["MAIN_BUY"] = 2] = "MAIN_BUY";
    OptionCode[OptionCode["MAIN_SELL"] = 3] = "MAIN_SELL";
    OptionCode[OptionCode["MAIN_HELP"] = 4] = "MAIN_HELP";
    OptionCode[OptionCode["MAIN_REFERRAL"] = 5] = "MAIN_REFERRAL";
    OptionCode[OptionCode["MAIN_ALERTS"] = 6] = "MAIN_ALERTS";
    OptionCode[OptionCode["MAIN_WALLET"] = 7] = "MAIN_WALLET";
    OptionCode[OptionCode["MAIN_SETTINGS"] = 8] = "MAIN_SETTINGS";
    OptionCode[OptionCode["MAIN_DCA"] = 9] = "MAIN_DCA";
    OptionCode[OptionCode["MAIN_REFRESH"] = 10] = "MAIN_REFRESH";
    OptionCode[OptionCode["WALLET_SOLSCAN"] = 11] = "WALLET_SOLSCAN";
    OptionCode[OptionCode["WALLET_DEPOSIT_SOL"] = 12] = "WALLET_DEPOSIT_SOL";
    OptionCode[OptionCode["WALLET_WITHDRAW_ALL_SOL"] = 13] = "WALLET_WITHDRAW_ALL_SOL";
    OptionCode[OptionCode["WALLET_WITHDRAW_X_SOL"] = 14] = "WALLET_WITHDRAW_X_SOL";
    OptionCode[OptionCode["WALLET_RESET_WALLET"] = 15] = "WALLET_RESET_WALLET";
    OptionCode[OptionCode["WALLET_EXPORT_KEY"] = 16] = "WALLET_EXPORT_KEY";
    OptionCode[OptionCode["WALLET_REFRESH"] = 17] = "WALLET_REFRESH";
    OptionCode[OptionCode["WALLET_EXPORT_KEY_CONFIRM"] = 18] = "WALLET_EXPORT_KEY_CONFIRM";
    OptionCode[OptionCode["WALLET_WITHDRAW_CONFIRM"] = 19] = "WALLET_WITHDRAW_CONFIRM";
    OptionCode[OptionCode["SETTINGS_ANNOUNCE"] = 20] = "SETTINGS_ANNOUNCE";
    OptionCode[OptionCode["SETTINGS_MIN_POS_VALUE"] = 21] = "SETTINGS_MIN_POS_VALUE";
    OptionCode[OptionCode["SETTINGS_AUTOBUY"] = 22] = "SETTINGS_AUTOBUY";
    OptionCode[OptionCode["SETTINGS_AUTOBUY_AMOUNT"] = 23] = "SETTINGS_AUTOBUY_AMOUNT";
    OptionCode[OptionCode["SETTINGS_BUYCONFIG_LEFT"] = 24] = "SETTINGS_BUYCONFIG_LEFT";
    OptionCode[OptionCode["SETTINGS_BUYCONFIG_RIGHT"] = 25] = "SETTINGS_BUYCONFIG_RIGHT";
    OptionCode[OptionCode["SETTINGS_SELLCONFIG_LEFT"] = 26] = "SETTINGS_SELLCONFIG_LEFT";
    OptionCode[OptionCode["SETTINGS_SELLCONFIG_RIGHT"] = 27] = "SETTINGS_SELLCONFIG_RIGHT";
    OptionCode[OptionCode["SETTINGS_MAXPRICEIMPACT"] = 28] = "SETTINGS_MAXPRICEIMPACT";
    OptionCode[OptionCode["SETTINGS_SLIPPAGE_BUY"] = 29] = "SETTINGS_SLIPPAGE_BUY";
    OptionCode[OptionCode["SETTINGS_SLIPPAGE_SELL"] = 30] = "SETTINGS_SLIPPAGE_SELL";
    OptionCode[OptionCode["SETTINGS_MEV_PROTECT"] = 31] = "SETTINGS_MEV_PROTECT";
    OptionCode[OptionCode["SETTINGS_TRX_PRIORITY"] = 32] = "SETTINGS_TRX_PRIORITY";
    OptionCode[OptionCode["SETTINGS_TRX_PRIORITY_VALUE"] = 33] = "SETTINGS_TRX_PRIORITY_VALUE";
    OptionCode[OptionCode["BOTS_MENU"] = 34] = "BOTS_MENU";
    OptionCode[OptionCode["CHAT_MENU"] = 35] = "CHAT_MENU";
    OptionCode[OptionCode["MSG_GETTOKENINFO"] = 36] = "MSG_GETTOKENINFO";
    OptionCode[OptionCode["MSG_REFRESH"] = 37] = "MSG_REFRESH";
    OptionCode[OptionCode["MSG_BUYLEFT"] = 38] = "MSG_BUYLEFT";
    OptionCode[OptionCode["MSG_BUYRIGHT"] = 39] = "MSG_BUYRIGHT";
    OptionCode[OptionCode["MSG_BUYXAMOUNT"] = 40] = "MSG_BUYXAMOUNT";
    OptionCode[OptionCode["MSG_BUY_DCA"] = 41] = "MSG_BUY_DCA";
    OptionCode[OptionCode["PANEL_REFRESH"] = 42] = "PANEL_REFRESH";
    OptionCode[OptionCode["PANEL_SELLLEFT"] = 43] = "PANEL_SELLLEFT";
    OptionCode[OptionCode["PANEL_SELLRIGHT"] = 44] = "PANEL_SELLRIGHT";
    OptionCode[OptionCode["PANEL_SELLXAMOUNT"] = 45] = "PANEL_SELLXAMOUNT";
    OptionCode[OptionCode["PANEL_SELL_DCA"] = 46] = "PANEL_SELL_DCA";
    OptionCode[OptionCode["PANEL_SELL_AUTO"] = 47] = "PANEL_SELL_AUTO";
    OptionCode[OptionCode["PANEL_DELETE"] = 48] = "PANEL_DELETE";
    OptionCode[OptionCode["PANEL_DELETE_CONFIRM"] = 49] = "PANEL_DELETE_CONFIRM";
    OptionCode[OptionCode["PANEL_PREV"] = 50] = "PANEL_PREV";
    OptionCode[OptionCode["PANEL_NEXT"] = 51] = "PANEL_NEXT";
    OptionCode[OptionCode["PANEL_LIMIT_HI"] = 52] = "PANEL_LIMIT_HI";
    OptionCode[OptionCode["PANEL_LIMIT_HI_PRICE"] = 53] = "PANEL_LIMIT_HI_PRICE";
    OptionCode[OptionCode["PANEL_LIMIT_HI_PERCENT"] = 54] = "PANEL_LIMIT_HI_PERCENT";
    OptionCode[OptionCode["PANEL_LIMIT_LO"] = 55] = "PANEL_LIMIT_LO";
    OptionCode[OptionCode["PANEL_LIMIT_LO_PRICE"] = 56] = "PANEL_LIMIT_LO_PRICE";
    OptionCode[OptionCode["PANEL_LIMIT_LO_PERCENT"] = 57] = "PANEL_LIMIT_LO_PERCENT";
    OptionCode[OptionCode["PANEL_MENU"] = 58] = "PANEL_MENU";
    OptionCode[OptionCode["DCA_CREATE_BUYORDER"] = 59] = "DCA_CREATE_BUYORDER";
    OptionCode[OptionCode["DCA_CREATE_SELLORDER"] = 60] = "DCA_CREATE_SELLORDER";
    OptionCode[OptionCode["DCA_DEPOSIT"] = 61] = "DCA_DEPOSIT";
    OptionCode[OptionCode["DCA_WITHDRAW"] = 62] = "DCA_WITHDRAW";
    OptionCode[OptionCode["DCA_CLOSE_ORDER"] = 63] = "DCA_CLOSE_ORDER";
    OptionCode[OptionCode["DCA_CLOSE_ORDER_CONFIRM"] = 64] = "DCA_CLOSE_ORDER_CONFIRM";
    OptionCode[OptionCode["DCA_REFRESH"] = 65] = "DCA_REFRESH";
    OptionCode[OptionCode["DCA_ORDER_DETAIL"] = 66] = "DCA_ORDER_DETAIL";
    OptionCode[OptionCode["DCA_ORDER_DETAIL_REFRESH"] = 67] = "DCA_ORDER_DETAIL_REFRESH";
})(OptionCode || (exports.OptionCode = OptionCode = {}));
var StateCode;
(function (StateCode) {
    StateCode[StateCode["IDLE"] = 1000] = "IDLE";
    StateCode[StateCode["WAIT_SET_WALLET_WITHDRAW_ADDRESS"] = 1001] = "WAIT_SET_WALLET_WITHDRAW_ADDRESS";
    StateCode[StateCode["WAIT_SET_SETTINGS_MIN_POS_VALUE"] = 1002] = "WAIT_SET_SETTINGS_MIN_POS_VALUE";
    StateCode[StateCode["WAIT_SET_SETTINGS_AUTOBUY_AMOUNT"] = 1003] = "WAIT_SET_SETTINGS_AUTOBUY_AMOUNT";
    StateCode[StateCode["WAIT_SET_SETTINGS_BUYCONFIG_LEFT_VALUE"] = 1004] = "WAIT_SET_SETTINGS_BUYCONFIG_LEFT_VALUE";
    StateCode[StateCode["WAIT_SET_SETTINGS_BUYCONFIG_RIGHT_VALUE"] = 1005] = "WAIT_SET_SETTINGS_BUYCONFIG_RIGHT_VALUE";
    StateCode[StateCode["WAIT_SET_SETTINGS_SELLCONFIG_LEFT_VALUE"] = 1006] = "WAIT_SET_SETTINGS_SELLCONFIG_LEFT_VALUE";
    StateCode[StateCode["WAIT_SET_SETTINGS_SELLCONFIG_RIGHT_VALUE"] = 1007] = "WAIT_SET_SETTINGS_SELLCONFIG_RIGHT_VALUE";
    StateCode[StateCode["WAIT_SET_SETTINGS_SLIPPAGE_BUY"] = 1008] = "WAIT_SET_SETTINGS_SLIPPAGE_BUY";
    StateCode[StateCode["WAIT_SET_SETTINGS_SLIPPAGE_SELL"] = 1009] = "WAIT_SET_SETTINGS_SLIPPAGE_SELL";
    StateCode[StateCode["WAIT_SET_SETTINGS_MAXPRICEIMPACT"] = 1010] = "WAIT_SET_SETTINGS_MAXPRICEIMPACT";
    StateCode[StateCode["WAIT_SET_SETTINGS_TRXPRIORITY_VALUE"] = 1011] = "WAIT_SET_SETTINGS_TRXPRIORITY_VALUE";
    StateCode[StateCode["WAIT_SET_WALLET_WITHDRAW_AMOUNT"] = 1012] = "WAIT_SET_WALLET_WITHDRAW_AMOUNT";
    StateCode[StateCode["WAIT_SET_MSG_BUYXAMOUNT"] = 1013] = "WAIT_SET_MSG_BUYXAMOUNT";
    StateCode[StateCode["WAIT_SET_PANEL_SELLXAMOUNT"] = 1014] = "WAIT_SET_PANEL_SELLXAMOUNT";
    StateCode[StateCode["WAIT_SET_DCA_NAME"] = 1015] = "WAIT_SET_DCA_NAME";
    StateCode[StateCode["WAIT_SET_DCA_INITIAL_DEPOSIT"] = 1016] = "WAIT_SET_DCA_INITIAL_DEPOSIT";
    StateCode[StateCode["WAIT_SET_DCA_AMOUNT_PER_CYCLE"] = 1017] = "WAIT_SET_DCA_AMOUNT_PER_CYCLE";
    StateCode[StateCode["WAIT_SET_DCA_CYCLE_FREQ"] = 1018] = "WAIT_SET_DCA_CYCLE_FREQ";
    StateCode[StateCode["WAIT_SET_DCA_TOKENADDRESS"] = 1019] = "WAIT_SET_DCA_TOKENADDRESS";
    StateCode[StateCode["WAIT_SET_DCA_DEPOSIT"] = 1020] = "WAIT_SET_DCA_DEPOSIT";
    StateCode[StateCode["WAIT_SET_DCA_WITHDRAW"] = 1021] = "WAIT_SET_DCA_WITHDRAW";
    StateCode[StateCode["WAIT_SET_ANNOUNCE_TEXT"] = 1022] = "WAIT_SET_ANNOUNCE_TEXT";
    StateCode[StateCode["WAIT_SET_MSG_LIMIT_LO_PERCENT"] = 1023] = "WAIT_SET_MSG_LIMIT_LO_PERCENT";
    StateCode[StateCode["WAIT_SET_MSG_LIMIT_LO_PRICE"] = 1024] = "WAIT_SET_MSG_LIMIT_LO_PRICE";
    StateCode[StateCode["WAIT_SET_MSG_LIMIT_HI_PERCENT"] = 1025] = "WAIT_SET_MSG_LIMIT_HI_PERCENT";
    StateCode[StateCode["WAIT_SET_MSG_LIMIT_HI_PRICE"] = 1026] = "WAIT_SET_MSG_LIMIT_HI_PRICE";
})(StateCode || (exports.StateCode = StateCode = {}));
exports.sessions = new Map();
exports.stateMap = new Map();
const options = { method: 'GET', headers: { accept: 'application/json', 'x-chain': 'solana' } };
const stateMap_setFocus = (chatid, state, data = {}) => {
    let item = exports.stateMap.get(chatid);
    if (!item) {
        item = (0, exports.stateMap_init)(chatid);
    }
    if (!data) {
        let focusData = {};
        if (item.focus && item.focus.data) {
            focusData = item.focus.data;
        }
        item.focus = { state, data: focusData };
    }
    else {
        item.focus = { state, data };
    }
};
exports.stateMap_setFocus = stateMap_setFocus;
const stateMap_getFocus = (chatid) => {
    const item = exports.stateMap.get(chatid);
    if (item) {
        let focusItem = item.focus;
        return focusItem;
    }
    return null;
};
exports.stateMap_getFocus = stateMap_getFocus;
const stateMap_init = (chatid) => {
    let item = {
        focus: { state: StateCode.IDLE, data: { sessionId: chatid } },
        message: new Map()
    };
    exports.stateMap.set(chatid, item);
    return item;
};
exports.stateMap_init = stateMap_init;
const stateMap_setMessage_Id = (chatid, messageType, messageId) => {
    let item = exports.stateMap.get(chatid);
    if (!item) {
        item = (0, exports.stateMap_init)(chatid);
    }
    item.message.set(`t${messageType}`, messageId);
};
exports.stateMap_setMessage_Id = stateMap_setMessage_Id;
const stateMap_getMessage = (chatid) => {
    const item = exports.stateMap.get(chatid);
    if (item) {
        let messageItem = item.message;
        return messageItem;
    }
    return null;
};
exports.stateMap_getMessage = stateMap_getMessage;
const stateMap_getMessage_Id = (chatid, messageType) => {
    const messageItem = (0, exports.stateMap_getMessage)(chatid);
    if (messageItem) {
        return messageItem.get(`t${messageType}`);
    }
    return null;
};
exports.stateMap_getMessage_Id = stateMap_getMessage_Id;
const stateMap_get = (chatid) => {
    return exports.stateMap.get(chatid);
};
exports.stateMap_get = stateMap_get;
const stateMap_remove = (chatid) => {
    exports.stateMap.delete(chatid);
};
exports.stateMap_remove = stateMap_remove;
const stateMap_clear = () => {
    exports.stateMap.clear();
};
exports.stateMap_clear = stateMap_clear;
const json_buttonItem = (key, cmd, text) => {
    return {
        text: text,
        callback_data: JSON.stringify({ k: key, c: cmd }),
    };
};
const removeMenu = async (chatId, messageType) => {
    const msgId = (0, exports.stateMap_getMessage_Id)(chatId, messageType);
    if (msgId) {
        try {
            await exports.bot.deleteMessage(chatId, msgId);
        }
        catch (error) {
        }
    }
};
exports.removeMenu = removeMenu;
const removeMessage = async (sessionId, messageId) => {
    if (sessionId && messageId) {
        try {
            await exports.bot.deleteMessage(sessionId, messageId);
        }
        catch (error) {
        }
    }
};
exports.removeMessage = removeMessage;
const sendReplyMessage = async (chatid, message) => {
    try {
        let data = { parse_mode: 'HTML', disable_forward: true, disable_web_page_preview: true, reply_markup: { force_reply: true } };
        const msg = await exports.bot.sendMessage(chatid, message, data);
        return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null };
    }
    catch (error) {
        afx.errorLog('sendReplyMessage', error);
        return null;
    }
};
exports.sendReplyMessage = sendReplyMessage;
const sendMessage = async (chatid, message, info = {}) => {
    try {
        let data = { parse_mode: 'HTML' };
        data.disable_web_page_preview = true;
        data.disable_forward = true;
        if (info && info.message_thread_id) {
            data.message_thread_id = info.message_thread_id;
        }
        const msg = await exports.bot.sendMessage(chatid, message, data);
        return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null };
    }
    catch (error) {
        if (error.response && error.response.body && error.response.body.error_code === 403) {
            info.blocked = true;
            if (error?.response?.body?.description == 'Forbidden: bot was blocked by the user') {
                database.removeUser({ chatid });
                exports.sessions.delete(chatid);
            }
        }
        console.log(error?.response?.body);
        afx.errorLog('sendMessage', error);
        return null;
    }
};
exports.sendMessage = sendMessage;
const sendInfoMessage = async (chatid, message) => {
    let json = [
        [],
    ];
    return (0, exports.sendOptionMessage)(chatid, message, json);
};
exports.sendInfoMessage = sendInfoMessage;
const sendOptionMessage = async (chatid, message, option) => {
    try {
        const keyboard = {
            inline_keyboard: option,
            resize_keyboard: true,
            one_time_keyboard: true,
        };
        const msg = await exports.bot.sendMessage(chatid, message, { reply_markup: keyboard, disable_web_page_preview: true, parse_mode: 'HTML' });
        return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null };
    }
    catch (error) {
        afx.errorLog('sendOptionMessage', error);
        return null;
    }
};
exports.sendOptionMessage = sendOptionMessage;
async function sendPhoto(chatid, file_id, message, json_buttons = null) {
    let option = { caption: message, parse_mode: 'HTML', disable_web_page_preview: true };
    if (json_buttons) {
        const keyboard = {
            inline_keyboard: json_buttons.options,
            resize_keyboard: true,
            one_time_keyboard: true,
            force_reply: true
        };
        option.reply_markup = keyboard;
    }
    return new Promise(async (resolve, reject) => {
        exports.bot.sendPhoto(chatid, file_id, option).catch((err) => {
            console.log('\x1b[31m%s\x1b[0m', `sendPhoto Error: ${chatid} ${err.response.body.description}`);
            resolve(null);
        }).then((msg) => {
            resolve({ messageId: msg.message_id, chatid: msg.chat.id });
        });
    });
}
async function sendText(chatid, message, json_buttons = null) {
    let option = { parse_mode: 'HTML', disable_web_page_preview: true };
    if (json_buttons !== null) {
        const keyboard = {
            inline_keyboard: json_buttons.options,
            resize_keyboard: true,
            one_time_keyboard: true,
            force_reply: true
        };
        option.reply_markup = keyboard;
    }
    return new Promise(async (resolve, reject) => {
        exports.bot.sendMessage(chatid, message, option).then((msg) => {
            resolve({ messageId: msg.message_id, chatid: msg.chat.id });
        }).catch((err) => {
            console.log('\x1b[31m%s\x1b[0m', `sendText Error: ${chatid} ${err.response.body.description}`);
            resolve(null);
        });
    });
}
const json_info = async (sessionId, msg) => {
    let json = [
        [
            json_buttonItem(sessionId, OptionCode.CLOSE, '✖️ Close')
        ],
    ];
    return { title: msg, options: json };
};
exports.json_info = json_info;
const json_confirm = async (sessionId, msg, btnCaption, btnId, itemData = '') => {
    const session = exports.sessions.get(sessionId);
    if (!session) {
        return null;
    }
    const title = msg;
    let json = [
        [
            json_buttonItem(sessionId, OptionCode.CLOSE, '✖️ Close'),
            json_buttonItem(itemData, btnId, btnCaption)
        ],
    ];
    return { title: title, options: json };
};
exports.json_confirm = json_confirm;
const createSession = async (chatid, username, type) => {
    let session = {};
    session.chatid = chatid;
    session.username = username;
    session.type = type;
    await (0, exports.setDefaultSettings)(session);
    exports.sessions.set(session.chatid, session);
    showSessionLog(session);
    return session;
};
exports.createSession = createSession;
function showSessionLog(session) {
    if (session.type === 'private') {
        console.log(`@${session.username} user${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`);
    }
    else if (session.type === 'group') {
        console.log(`@${session.username} group${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`);
    }
    else if (session.type === 'channel') {
        console.log(`@${session.username} channel${session.wallet ? ' joined' : '\'s session has been created'}`);
    }
}
exports.defaultConfig = {
    admin: 0,
    vip: 0,
};
const getTokenMcap = async (swap_data) => {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    };
    const fetchUrl = "https://public-api.birdeye.so/defi/v3/token/market-data?address=" + swap_data;
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json());
    let formattedMcap;
    if (responseData.data.marketcap > 10 ** 6) {
        formattedMcap = (responseData.data.marketcap / 10 ** 6).toFixed(1) + 'M';
    }
    else if (responseData.data.marketcap > 10 ** 3) {
        formattedMcap = (responseData.data.marketcap / 10 ** 3).toFixed(1) + 'K';
    }
    else {
        formattedMcap = responseData.data.marketcap.toFixed(0);
    }
    return formattedMcap;
};
exports.getTokenMcap = getTokenMcap;
const setDefaultSettings = async (session) => {
    session.admin = exports.defaultConfig.admin;
    session.timestamp = new Date().getTime();
};
exports.setDefaultSettings = setDefaultSettings;
exports._command_proc = null;
exports._callback_proc = null;
async function init(command_proc, callback_proc) {
    console.log(`Bot is running as ${afx.BotMode} mode`);
    const token = String(afx.getBotToken());
    console.log(afx.BotMode, token);
    exports.bot = new node_telegram_bot_api_1.default(token, {
        polling: true
    });
    exports.bot.getMe().then((info) => {
        exports.myInfo = info;
    });
    if (afx.getBotMode() === afx.BotRunMode.Main) {
        exports.bot.on('message', async (message) => {
            console.log("message===", message);
            const msgType = message?.chat?.type;
            if (msgType === 'private') {
                privateBot.procMessage(message, database);
            }
            else if (msgType === 'group' || msgType === 'supergroup') {
                privateBot.procMessage(message, database);
            }
            else if (msgType === 'channel') {
                privateBot.procMessage(message, database);
            }
        });
        exports.bot.on('callback_query', async (callbackQuery) => {
            const message = callbackQuery.message;
            if (!message) {
                return;
            }
            const option = JSON.parse(callbackQuery.data);
            let chatid = message.chat.id.toString();
            (0, exports.executeCommand)(chatid, message.message_id, callbackQuery.id, option);
        });
    }
    exports._command_proc = command_proc;
    exports._callback_proc = callback_proc;
    await database.init();
    const users = await database.selectUsers();
    let loggedin = 0;
    let admins = 0;
    for (const user of users) {
        let session = JSON.parse(JSON.stringify(user));
        session = utils.objectDeepCopy(session, ['_id', '__v']);
        if (session.wallet) {
            loggedin++;
        }
        exports.sessions.set(session.chatid, session);
        if (session.admin >= 1) {
            console.log(`@${session.username} user joined as ADMIN ( ${session.chatid} )`);
            admins++;
        }
    }
    console.log(`${users.length} users, ${loggedin} logged in, ${admins} admins`);
}
const reloadCommand = async (chatid, messageId, callbackQueryId, option) => {
    await (0, exports.removeMessage)(chatid, messageId);
    (0, exports.executeCommand)(chatid, messageId, callbackQueryId, option);
};
exports.reloadCommand = reloadCommand;
const executeCommand = async (chatid, _messageId, _callbackQueryId, option) => {
    const cmd = option.c;
    const id = option.k;
    const session = exports.sessions.get(chatid);
    if (!session) {
        return;
    }
    let messageId = Number(_messageId ?? 0);
    let callbackQueryId = _callbackQueryId ?? '';
    const sessionId = chatid;
    const stateData = { sessionId, messageId, callbackQueryId, cmd };
    try {
    }
    catch (error) {
        console.log(error);
        (0, exports.sendMessage)(chatid, `😢 Sorry, there was some errors on the command. Please try again later 😉`);
        if (callbackQueryId)
            await exports.bot.answerCallbackQuery(callbackQueryId, { text: `😢 Sorry, there was some errors on the command. Please try again later 😉` });
    }
};
exports.executeCommand = executeCommand;
//# sourceMappingURL=bot.js.map