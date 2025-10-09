import TelegramBot from 'node-telegram-bot-api';
export declare const COMMAND_START = "start";
export declare enum OptionCode {
    BACK = -100,
    CLOSE = -99,
    TITLE = -98,
    WELCOME = 0,
    MAIN_MENU = 1,
    MAIN_BUY = 2,
    MAIN_SELL = 3,
    MAIN_HELP = 4,
    MAIN_REFERRAL = 5,
    MAIN_ALERTS = 6,
    MAIN_WALLET = 7,
    MAIN_SETTINGS = 8,
    MAIN_DCA = 9,
    MAIN_REFRESH = 10,
    WALLET_SOLSCAN = 11,
    WALLET_DEPOSIT_SOL = 12,
    WALLET_WITHDRAW_ALL_SOL = 13,
    WALLET_WITHDRAW_X_SOL = 14,
    WALLET_RESET_WALLET = 15,
    WALLET_EXPORT_KEY = 16,
    WALLET_REFRESH = 17,
    WALLET_EXPORT_KEY_CONFIRM = 18,
    WALLET_WITHDRAW_CONFIRM = 19,
    SETTINGS_ANNOUNCE = 20,
    SETTINGS_MIN_POS_VALUE = 21,
    SETTINGS_AUTOBUY = 22,
    SETTINGS_AUTOBUY_AMOUNT = 23,
    SETTINGS_BUYCONFIG_LEFT = 24,
    SETTINGS_BUYCONFIG_RIGHT = 25,
    SETTINGS_SELLCONFIG_LEFT = 26,
    SETTINGS_SELLCONFIG_RIGHT = 27,
    SETTINGS_MAXPRICEIMPACT = 28,
    SETTINGS_SLIPPAGE_BUY = 29,
    SETTINGS_SLIPPAGE_SELL = 30,
    SETTINGS_MEV_PROTECT = 31,
    SETTINGS_TRX_PRIORITY = 32,
    SETTINGS_TRX_PRIORITY_VALUE = 33,
    BOTS_MENU = 34,
    CHAT_MENU = 35,
    MSG_GETTOKENINFO = 36,
    MSG_REFRESH = 37,
    MSG_BUYLEFT = 38,
    MSG_BUYRIGHT = 39,
    MSG_BUYXAMOUNT = 40,
    MSG_BUY_DCA = 41,
    PANEL_REFRESH = 42,
    PANEL_SELLLEFT = 43,
    PANEL_SELLRIGHT = 44,
    PANEL_SELLXAMOUNT = 45,
    PANEL_SELL_DCA = 46,
    PANEL_SELL_AUTO = 47,
    PANEL_DELETE = 48,
    PANEL_DELETE_CONFIRM = 49,
    PANEL_PREV = 50,
    PANEL_NEXT = 51,
    PANEL_LIMIT_HI = 52,
    PANEL_LIMIT_HI_PRICE = 53,
    PANEL_LIMIT_HI_PERCENT = 54,
    PANEL_LIMIT_LO = 55,
    PANEL_LIMIT_LO_PRICE = 56,
    PANEL_LIMIT_LO_PERCENT = 57,
    PANEL_MENU = 58,
    DCA_CREATE_BUYORDER = 59,
    DCA_CREATE_SELLORDER = 60,
    DCA_DEPOSIT = 61,
    DCA_WITHDRAW = 62,
    DCA_CLOSE_ORDER = 63,
    DCA_CLOSE_ORDER_CONFIRM = 64,
    DCA_REFRESH = 65,
    DCA_ORDER_DETAIL = 66,
    DCA_ORDER_DETAIL_REFRESH = 67
}
export declare enum StateCode {
    IDLE = 1000,
    WAIT_SET_WALLET_WITHDRAW_ADDRESS = 1001,
    WAIT_SET_SETTINGS_MIN_POS_VALUE = 1002,
    WAIT_SET_SETTINGS_AUTOBUY_AMOUNT = 1003,
    WAIT_SET_SETTINGS_BUYCONFIG_LEFT_VALUE = 1004,
    WAIT_SET_SETTINGS_BUYCONFIG_RIGHT_VALUE = 1005,
    WAIT_SET_SETTINGS_SELLCONFIG_LEFT_VALUE = 1006,
    WAIT_SET_SETTINGS_SELLCONFIG_RIGHT_VALUE = 1007,
    WAIT_SET_SETTINGS_SLIPPAGE_BUY = 1008,
    WAIT_SET_SETTINGS_SLIPPAGE_SELL = 1009,
    WAIT_SET_SETTINGS_MAXPRICEIMPACT = 1010,
    WAIT_SET_SETTINGS_TRXPRIORITY_VALUE = 1011,
    WAIT_SET_WALLET_WITHDRAW_AMOUNT = 1012,
    WAIT_SET_MSG_BUYXAMOUNT = 1013,
    WAIT_SET_PANEL_SELLXAMOUNT = 1014,
    WAIT_SET_DCA_NAME = 1015,
    WAIT_SET_DCA_INITIAL_DEPOSIT = 1016,
    WAIT_SET_DCA_AMOUNT_PER_CYCLE = 1017,
    WAIT_SET_DCA_CYCLE_FREQ = 1018,
    WAIT_SET_DCA_TOKENADDRESS = 1019,
    WAIT_SET_DCA_DEPOSIT = 1020,
    WAIT_SET_DCA_WITHDRAW = 1021,
    WAIT_SET_ANNOUNCE_TEXT = 1022,
    WAIT_SET_MSG_LIMIT_LO_PERCENT = 1023,
    WAIT_SET_MSG_LIMIT_LO_PRICE = 1024,
    WAIT_SET_MSG_LIMIT_HI_PERCENT = 1025,
    WAIT_SET_MSG_LIMIT_HI_PRICE = 1026
}
export declare let bot: TelegramBot;
export declare let myInfo: TelegramBot.User;
export declare const sessions: Map<any, any>;
export declare const stateMap: Map<any, any>;
export declare const stateMap_setFocus: (chatid: string, state: any, data?: any) => void;
export declare const stateMap_getFocus: (chatid: string) => any;
export declare const stateMap_init: (chatid: string) => {
    focus: {
        state: StateCode;
        data: {
            sessionId: string;
        };
    };
    message: Map<any, any>;
};
export declare const stateMap_setMessage_Id: (chatid: string, messageType: number, messageId: number) => void;
export declare const stateMap_getMessage: (chatid: string) => any;
export declare const stateMap_getMessage_Id: (chatid: string, messageType: number) => any;
export declare const stateMap_get: (chatid: string) => any;
export declare const stateMap_remove: (chatid: string) => void;
export declare const stateMap_clear: () => void;
export declare const removeMenu: (chatId: string, messageType: number) => Promise<void>;
export declare const removeMessage: (sessionId: string, messageId: number) => Promise<void>;
export declare const sendReplyMessage: (chatid: string, message: string) => Promise<{
    messageId: number;
    chatid: number;
}>;
export declare const sendMessage: (chatid: string, message: string, info?: any) => Promise<{
    messageId: number;
    chatid: number;
}>;
export declare const sendInfoMessage: (chatid: string, message: string) => Promise<{
    messageId: number;
    chatid: number;
}>;
export declare const sendOptionMessage: (chatid: string, message: string, option: any) => Promise<{
    messageId: number;
    chatid: number;
}>;
export declare function sendPhoto(chatid: string, file_id: string, message: string, json_buttons?: any): Promise<unknown>;
export declare function sendText(chatid: string, message: string, json_buttons?: any): Promise<unknown>;
export declare const json_info: (sessionId: string, msg: string) => Promise<{
    title: string;
    options: {
        text: string;
        callback_data: string;
    }[][];
}>;
export declare const json_confirm: (sessionId: string, msg: string, btnCaption: string, btnId: number, itemData?: string) => Promise<{
    title: string;
    options: {
        text: string;
        callback_data: string;
    }[][];
}>;
export declare const createSession: (chatid: string, username: string, type: string) => Promise<any>;
export declare function showSessionLog(session: any): void;
export declare const defaultConfig: {
    admin: number;
    vip: number;
};
export declare const getTokenMcap: (swap_data: any) => Promise<string>;
export declare const setDefaultSettings: (session: any) => Promise<void>;
export declare let _command_proc: any;
export declare let _callback_proc: any;
export declare function init(command_proc: any, callback_proc: any): Promise<void>;
export declare const reloadCommand: (chatid: string, messageId: number, callbackQueryId: string, option: any) => Promise<void>;
export declare const executeCommand: (chatid: string, _messageId: number | undefined, _callbackQueryId: string | undefined, option: any) => Promise<void>;
