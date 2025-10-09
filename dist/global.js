"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BULLET_EMOJI = exports.DELETE_TIME = exports.VALID_LIMIT = exports.REQUEST_LIMIT = exports.get_net_mode = exports.getBotToken = exports.getBotMode = exports.setBotMode = exports.setWeb3 = exports.web3Conn = exports.BotMode = exports.Devnet = exports.Testnet = exports.Mainnet = exports.MIN_TARGET_WALLETS = exports.Default_Swap_Heap = exports.Max_Sell_Count = exports.TradingMonitorDuration = exports.BotRunMode = exports.parseError = exports.errorLog = exports.rankingEmojis = exports.RayLiqPoolv4 = exports.PAYMENT_ADDRESS = exports.NOT_ASSIGNED = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const web3_js_1 = require("@solana/web3.js");
exports.NOT_ASSIGNED = '- Not assigned -';
exports.PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS;
exports.RayLiqPoolv4 = new web3_js_1.PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
exports.rankingEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const errorLog = (summary, error) => {
    if (error?.response?.body?.description) {
        console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error.response.body.description}`);
    }
    else {
        console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error}`);
    }
};
exports.errorLog = errorLog;
const parseError = (error) => {
    let msg = '';
    try {
        error = JSON.parse(JSON.stringify(error));
        msg =
            error?.error?.reason ||
                error?.reason ||
                JSON.parse(error)?.error?.error?.response?.error?.message ||
                error?.response ||
                error?.message ||
                error;
    }
    catch (_error) {
        msg = error;
    }
    return msg;
};
exports.parseError = parseError;
var BotRunMode;
(function (BotRunMode) {
    BotRunMode["Main"] = "Swap";
    BotRunMode["Alerts"] = "Alerts";
})(BotRunMode || (exports.BotRunMode = BotRunMode = {}));
exports.TradingMonitorDuration = 24 * 60 * 60;
exports.Max_Sell_Count = 10;
exports.Default_Swap_Heap = 0.001;
exports.MIN_TARGET_WALLETS = 3;
exports.Mainnet = 'mainnet-beta';
exports.Testnet = 'testnet';
exports.Devnet = 'devnet';
exports.BotMode = BotRunMode.Main;
const setWeb3 = (conn) => {
    exports.web3Conn = conn;
};
exports.setWeb3 = setWeb3;
const setBotMode = (mode) => {
    exports.BotMode = mode;
};
exports.setBotMode = setBotMode;
const getBotMode = () => {
    return exports.BotMode;
};
exports.getBotMode = getBotMode;
const getBotToken = () => {
    if (exports.BotMode === BotRunMode.Main) {
        return process.env.BOT_TOKEN ?? '';
    }
    else {
        return process.env.ALERTS_BOT_TOKEN ?? '';
    }
};
exports.getBotToken = getBotToken;
const get_net_mode = () => {
    return Number(process.env.NET_MODE);
};
exports.get_net_mode = get_net_mode;
exports.REQUEST_LIMIT = 60000;
exports.VALID_LIMIT = 600000;
exports.DELETE_TIME = 300000;
exports.DEFAULT_BULLET_EMOJI = '🟢';
//# sourceMappingURL=global.js.map