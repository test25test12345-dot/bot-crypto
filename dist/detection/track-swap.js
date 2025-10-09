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
exports.start = void 0;
const yellowstone_grpc_1 = __importStar(require("@triton-one/yellowstone-grpc"));
const wallets_1 = require("./wallets");
const jupiter_detection_1 = require("../jup-lib/jupiter-detection");
const web3_js_1 = require("@solana/web3.js");
const constant_1 = require("../jup-lib/constant");
const global_1 = require("../global");
const raydium_detection_1 = require("../raydium-lib/raydium-detection");
const raydium_cpmm_detection_1 = require("../raydium-lib/raydium-cpmm-detection");
const uniconst_1 = require("../uniconst");
const transaction_formatter_1 = require("./transaction-formatter");
const database = __importStar(require("../db"));
const utils_1 = require("../utils");
const pumpfun_detection_1 = require("../pumpfun-lib/pumpfun-detection");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const alertBot = new node_telegram_bot_api_1.default(process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN || '', { polling: false });
const sendAlert = async (chatId, message) => {
    try {
        const utf8Message = Buffer.from(message, 'utf8').toString('utf8');
        await alertBot.sendMessage(chatId, utf8Message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
        console.log('Alert sent to:', chatId);
    }
    catch (error) {
        console.error('Failed to send to:', chatId, error.message);
    }
};
const birdeyeApi = require("api")("@birdeyedotso/v1.0#crnv83jlti6buqu");
birdeyeApi.auth(process.env.BIRDEYE_API_KEY);
const logToFile = (message) => {
    try {
        const logDir = path_1.default.join(__dirname, 'logs');
        const logFilePath = path_1.default.join(logDir, 'track.log');
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
            console.log('Created logs directory:', logDir);
        }
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        fs_1.default.appendFileSync(logFilePath, logMessage, 'utf8');
    }
    catch (error) {
        console.error('Error writing to log file:', error);
    }
};
const TXN_FORMATTER = new transaction_formatter_1.TransactionFormatter();
const checkDB_Alert = async (buyWallets, old, swapData) => {
    try {
        const sellWallets = await buyWallets.filter((wallet) => wallet.type === "sell");
        const tokenMCap = await (0, utils_1.getTokenMcap)(swapData);
        const tokenInfo = await (0, utils_1.getTokenInfo)(swapData);
        const solPrice = await (0, utils_1.getTokenPrice_)(swapData.inMint);
        console.log("solprice=====", solPrice);
        const extensions = tokenInfo.data?.extensions ?? null;
        const positionTradeScore = await (0, utils_1.getTokenScore)(buyWallets, swapData);
        console.log("buyWallets=====", buyWallets);
        buyWallets.sort((a, b) => {
            if (a > b) {
                return -1;
            }
            else if (a < b) {
                return 1;
            }
            return 0;
        });
        logToFile(`parsedTxn================== ${JSON.stringify(swapData.outMint)}, ${JSON.stringify(tokenInfo.data?.name)}`);
        let message = '';
        message = message + '\n\u{1F4B8} <b>New smart holder entry</b>\n';
        message = message + '\n\u{1F50E} <b>Address</b>: <code>' + swapData.outMint + '</code>';
        message = message + '\n\u{1F4B0} <b>Name</b>: ' + (tokenInfo.data?.name ?? " ");
        message = message + '\n\u{1F4C8} <b>MCap</b>: ' + tokenMCap;
        if (extensions && extensions.website) {
            message = message + '\n\u{1F517} <a href="' + extensions.website + '">Website</a>';
        }
        if (extensions && extensions.twitter) {
            message = message + '\n\u{1F517} <a href="' + extensions.twitter + '">Twitter</a>';
        }
        if (extensions && extensions.telegram) {
            message = message + '\n\u{1F517} <a href="' + extensions.telegram + '">Telegram</a>';
        }
        if (extensions && extensions.discord) {
            message = message + '\n\u{1F517} <a href="' + extensions.discord + '">Discord</a>';
        }
        message = message + '\n\n\u{1F4AF} <b>TradeScore</b>: ' + positionTradeScore;
        message = message + '\n\n\u{1F99A} <b>' + (buyWallets.length - sellWallets.length) + ' smart holders</b>';
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "buy") {
                console.log("buybalance===", buyWallets[i].inAmount, solPrice, buyWallets[i].txTime);
                const amount = (buyWallets[i].inAmount / Math.pow(10, 9) * solPrice).toFixed(0);
                message = message + '\n\u{1F7E2} ' + buyWallets[i].name + '  ($' + amount + ') (' + buyWallets[i].txTime + ')';
            }
        }
        message = message + '\n\n\u{2757} <b>' + sellWallets.length + ' close</b>';
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "sell") {
                message = message + '\n\u{1F534} ' + buyWallets[i].name;
            }
        }
        message = message + '\n\n\u{26A1} <a href="https://jup.ag/swap/' + swapData.outMint + '-SOL">Jupiter</a>';
        message = message + '\n\u{1F438} <a href="https://gmgn.ai/sol/token/' + swapData.outMint + '">Gmgn</a>';
        message = message + '\n\u{1F680} <a href="https://photon-sol.tinyastro.io/en/lp/' + swapData.outMint + '">Photon</a>';
        message = message + '\n\u{1F402} <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=' + swapData.outMint + '">Bullx</a>';
        console.log('Preparing to send alerts...');
        await sendAlert('-1002359004329', message);
        await sendAlert('-1002444321759', message);
    }
    catch (error) {
        console.error('Error in checkDB_Alert:', error);
    }
};
const processSwapData = async (swap_data) => {
    try {
        if (!swap_data) {
            return;
        }
        console.log("swap_data=======", swap_data);
        const db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
        if (!db_wallet) {
            console.log("Doesn't match owner wallet", swap_data.owner, swap_data.signature);
            return;
        }
        if (swap_data.inMint === uniconst_1.WSOL_ADDRESS) {
            if (swap_data.outMint === uniconst_1.USDC_ADDRESS || swap_data.outMint === uniconst_1.USDT_ADDRESS)
                return;
            const date = new Date();
            const buytxTime = new Date();
            let token_index = db_wallet.tokens.findIndex((mint) => mint.mint === swap_data.outMint);
            if (token_index < 0)
                db_wallet.tokens.push({
                    mint: swap_data.outMint, type: "buy", txTime: buytxTime.toLocaleString('en-US', {
                        hour12: false,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }), inAmount: swap_data.inAmount
                });
            else {
                db_wallet.tokens[token_index].type = "buy";
                db_wallet.tokens[token_index].txTime = buytxTime.toLocaleString('en-US', {
                    hour12: false,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                db_wallet.tokens[token_index].inAmount = Number(db_wallet.tokens[token_index].inAmount) + Number(swap_data.inAmount);
            }
            await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name });
            const buyPosition = await database.selectTrackPosition({ token: swap_data.outMint });
            let openPosition = false;
            if (buyPosition && buyPosition.token) {
                openPosition = true;
                let wallet_index = buyPosition.wallets.findIndex((wallet) => wallet.address === swap_data.owner);
                if (wallet_index < 0) {
                    buyPosition.wallets.push({
                        address: swap_data.owner, type: "buy", name: db_wallet.name, inAmount: swap_data.inAmount, txTime: buytxTime.toLocaleString('en-US', {
                            hour12: false,
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })
                    });
                }
                else {
                    buyPosition.wallets[wallet_index].type = "buy";
                    buyPosition.wallets[wallet_index].inAmount = swap_data.inAmount;
                    buyPosition.wallets[wallet_index].txTime = buytxTime.toLocaleString('en-US', {
                        hour12: false,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                }
                const buysInPosition_old = buyPosition.wallets.filter((wallet) => wallet.type === "buy");
                await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets, old: true });
                const buysInPosition = buyPosition.wallets.filter((wallet) => wallet.type === "buy");
                if (buysInPosition && buysInPosition.length >= 3 && buysInPosition_old?.length != buysInPosition.length) {
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data);
                }
                else if (buysInPosition.length < 3) {
                    await database.removeTrackPosition({ token: swap_data.outMint });
                    openPosition = false;
                }
            }
            if (!openPosition) {
                let buycount = 0;
                let buyWallets = [];
                const trackWallets = await database.selectTrackWallets({});
                for (const wallet of trackWallets) {
                    for (const token of wallet.tokens) {
                        if (token.mint === swap_data.outMint && token.type === "buy") {
                            buycount++;
                            buyWallets.push({ address: wallet.wallet, type: "buy", name: wallet.name, inAmount: token.inAmount, txTime: token.txTime });
                        }
                    }
                    if (buycount >= 3 && buyWallets.length >= 3) {
                        console.log("status 2===== ", buyWallets.length);
                        await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false });
                        await checkDB_Alert(buyWallets, buyPosition?.old, swap_data);
                        break;
                    }
                }
            }
        }
        else {
            if (swap_data.inMint === uniconst_1.USDC_ADDRESS || swap_data.inMint === uniconst_1.USDT_ADDRESS)
                return;
            let solPrice = await (0, utils_1.getTokenPrice_)(uniconst_1.WSOL_ADDRESS);
            let token_index = db_wallet.tokens.findIndex((mint) => mint.mint === swap_data.inMint);
            let sellAvailable = false;
            if (token_index >= 0) {
                if ((Number(db_wallet.tokens[token_index].inAmount) - Number(swap_data.outAmount)) / 10 ** 9 * solPrice < 60) {
                    db_wallet.tokens[token_index].type = "sell";
                    db_wallet.tokens[token_index].inAmount = Number(db_wallet.tokens[token_index].inAmount) - Number(swap_data.inAmount);
                    if (Number(db_wallet.tokens[token_index].inAmount) < 0)
                        db_wallet.tokens[token_index].inAmount = 0;
                    await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name });
                    sellAvailable = true;
                }
            }
            if (sellAvailable) {
                const sellPosition = await database.selectTrackPosition({ token: swap_data.inMint });
                if (sellPosition) {
                    let wallet_index = sellPosition.wallets.findIndex((wallet) => wallet.address === swap_data.owner);
                    if (wallet_index >= 0) {
                        sellPosition.wallets[wallet_index].type = "sell";
                        await database.updateTrackPosition({ token: swap_data.inMint, wallets: sellPosition.wallets, old: true });
                        const buysInPosition = sellPosition.wallets.filter((wallet) => wallet.type === "buy");
                        if (buysInPosition.length >= 3) {
                            await checkDB_Alert(sellPosition.wallets, true, swap_data);
                        }
                    }
                }
            }
            await (0, utils_1.delayForTrxSync)(swap_data.signature);
        }
    }
    catch (error) {
        console.error('Error in processSwapData:', error);
    }
};
const parseTransfer = async (txn) => {
    try {
        const logMessages = txn.meta.logMessages;
        const owner = txn.transaction.message.versioned ? new web3_js_1.PublicKey(Buffer.from(txn.transaction.message.accountKeys[0], "base64")) : Buffer.from(txn.transaction.message.accountKeys[0], "base64");
        for (let message of logMessages) {
            if (!message.includes("11111111111111111111111111111111")) {
                return;
            }
        }
        const preBalances = txn.meta.preBalances;
        const postBalances = txn.meta.postBalances;
        if (preBalances && postBalances && preBalances.length > 3 && postBalances.length > 3 && preBalances.length === postBalances.length) {
            let count = 0;
            let message = `owner: ${owner}`;
            for (let i = 1; i < preBalances.length - 2; i++) {
                count++;
                const trasferAmount = (Number(postBalances[i]) - Number(preBalances[i])) / (10 ** 9);
                message = `${message}
    Amount: ${trasferAmount} SOL`;
            }
            if (count > 0) {
            }
        }
    }
    catch (error) {
        console.log("Transfer detection error", error);
    }
};
const parseTransaction = async (data) => {
    try {
        if (data.filters.some((item) => item == 'subscribe_tx') && data.transaction) {
            const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
            const accountKeys = txn.transaction.message.staticAccountKeys;
            const hasJupiter = accountKeys.find((programId) => {
                if (programId.equals(constant_1.JUPITER_V6_PROGRAM_ID)) {
                    return true;
                }
                else {
                    return false;
                }
            });
            if (hasJupiter) {
                const ret = await (0, jupiter_detection_1.getJupiterSwapInfo)(txn);
                processSwapData(ret);
                return;
            }
            const hasCpmm = accountKeys.find((programId) => {
                if (programId.equals(new web3_js_1.PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"))) {
                    return true;
                }
                else {
                    return false;
                }
            });
            if (hasCpmm) {
                const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
                const ret = await (0, raydium_cpmm_detection_1.decodeRaydiumCpmmTxn)(txn);
                processSwapData(ret);
                return;
            }
            const hasRaydium = accountKeys.find((programId) => {
                if (programId.equals(global_1.RayLiqPoolv4)) {
                    return true;
                }
                else {
                    return false;
                }
            });
            if (hasRaydium) {
                const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
                const ret = await (0, raydium_detection_1.decodeRaydiumTxn)(txn);
                processSwapData(ret);
                return;
            }
            const hasPumpFun = accountKeys.find((programId) => {
                if (programId.equals(pumpfun_detection_1.PUMP_FUN_PROGRAM_ID)) {
                    return true;
                }
                else {
                    return false;
                }
            });
            if (hasPumpFun) {
                const ret = await (0, pumpfun_detection_1.decodePumpfunTxn)(txn);
                processSwapData(ret);
                return;
            }
        }
        if (data.transaction !== undefined) {
            const ret = await parseTransfer(data.transaction["transaction"]);
        }
    }
    catch (error) {
        console.error('Error parsing transaction:', error);
    }
};
async function handleStream(client, args) {
    console.log('Stream connecting...');
    const stream = await client.subscribe();
    console.log('Stream connected');
    let lastDataTime = Date.now();
    const heartbeat = setInterval(() => {
        const timeSinceLastData = Date.now() - lastDataTime;
        console.log(`Stream alive - last data: ${Math.floor(timeSinceLastData / 1000)}s ago`);
        if (timeSinceLastData > 300000) {
            console.log('Stream seems dead, forcing reconnection...');
            clearInterval(heartbeat);
            stream.end();
        }
    }, 60000);
    const streamClosed = new Promise((resolve, reject) => {
        stream.on("error", (error) => {
            console.log("Stream ERROR:", error);
            clearInterval(heartbeat);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            console.log("Stream ENDED");
            clearInterval(heartbeat);
            resolve();
        });
        stream.on("close", () => {
            console.log("Stream CLOSED");
            clearInterval(heartbeat);
            resolve();
        });
    });
    stream.on("data", (data) => {
        lastDataTime = Date.now();
        parseTransaction(data);
    });
    await new Promise((resolve, reject) => {
        stream.write(args, (err) => {
            if (err === null || err === undefined) {
                resolve();
            }
            else {
                reject(err);
            }
        });
    }).catch((reason) => {
        console.error(reason);
        throw reason;
    });
    await streamClosed;
}
async function subscribeCommand(client, args) {
    while (true) {
        try {
            console.log("Start Substream server");
            await handleStream(client, args);
        }
        catch (error) {
            console.error("Stream error, restarting in 1 second...", error);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
const client = new yellowstone_grpc_1.default('https://grpc.eu.shyft.to', process.env.GRPC_TOKEN, undefined);
const start = async () => {
    console.log('Initializing track-swap...');
    console.log('Telegram Bot Token:', process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN ? 'OK' : 'MISSING');
    console.log('GRPC Token:', process.env.GRPC_TOKEN ? 'OK' : 'MISSING');
    let detection_wallets = await (0, wallets_1.getWallets)();
    console.log('Tracking', detection_wallets.length, 'wallets');
    const req = {
        accounts: {},
        slots: {},
        transactions: {
            subscribe_tx: {
                vote: false,
                failed: false,
                signature: undefined,
                accountInclude: detection_wallets,
                accountExclude: [],
                accountRequired: [],
            },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        ping: undefined,
        commitment: yellowstone_grpc_1.CommitmentLevel.CONFIRMED,
    };
    subscribeCommand(client, req);
};
exports.start = start;
//# sourceMappingURL=track-swap.js.map