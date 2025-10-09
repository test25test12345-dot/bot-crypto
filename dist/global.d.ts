import { Connection } from "@solana/web3.js";
import { PublicKey } from '@solana/web3.js';
export declare const NOT_ASSIGNED = "- Not assigned -";
export declare const PAYMENT_ADDRESS: string;
export declare const RayLiqPoolv4: PublicKey;
export declare const rankingEmojis: string[];
export declare const errorLog: (summary: string, error: any) => void;
export declare const parseError: (error: any) => string;
export declare enum BotRunMode {
    Main = "Swap",
    Alerts = "Alerts"
}
export declare const TradingMonitorDuration: number;
export declare const Max_Sell_Count = 10;
export declare const Default_Swap_Heap = 0.001;
export declare const MIN_TARGET_WALLETS = 3;
export declare const Mainnet = "mainnet-beta";
export declare const Testnet = "testnet";
export declare const Devnet = "devnet";
export declare let BotMode: BotRunMode;
export declare let web3Conn: Connection;
export declare const setWeb3: (conn: Connection) => void;
export declare const setBotMode: (mode: BotRunMode) => void;
export declare const getBotMode: () => BotRunMode;
export declare const getBotToken: () => string;
export declare const get_net_mode: () => number;
export declare const REQUEST_LIMIT = 60000;
export declare const VALID_LIMIT = 600000;
export declare const DELETE_TIME = 300000;
export declare const DEFAULT_BULLET_EMOJI = "\uD83D\uDFE2";
