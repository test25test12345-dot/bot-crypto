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
const config_1 = require("./config");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const alertBot = new node_telegram_bot_api_1.default(process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN || '', { polling: false });
const BLACKLISTED_WALLETS = [
    '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'
];
const sendAlert = async (chatId, message) => {
    try {
        const utf8Message = Buffer.from(message, 'utf8').toString('utf8');
        await alertBot.sendMessage(chatId, utf8Message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
        logToFile('✅ Alert sent to: ' + chatId);
    }
    catch (error) {
        logToFile('❌ Failed to send to: ' + chatId + ' - ' + error.message);
    }
};
const logToFile = (message) => {
    try {
        const logDir = path_1.default.join(__dirname, 'logs');
        const logFilePath = path_1.default.join(logDir, 'track-debug.log');
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        fs_1.default.appendFileSync(logFilePath, logMessage, 'utf8');
        console.log(message);
    }
    catch (error) {
        console.error('Error writing to log file:', error);
    }
};
const TXN_FORMATTER = new transaction_formatter_1.TransactionFormatter();
const checkDB_Alert = async (buyWallets, old, swapData) => {
    try {
        logToFile(`🚨 checkDB_Alert START - Token: ${swapData.outMint}`);
        logToFile(`   Total wallets: ${buyWallets.length}`);
        const sellWallets = await buyWallets.filter((wallet) => wallet.type === "sell");
        logToFile(`   Sell wallets: ${sellWallets.length}`);
        const tokenMCap = await (0, utils_1.getTokenMcap)(swapData);
        logToFile(`   MCap: ${tokenMCap}`);
        const tokenInfo = await (0, utils_1.getTokenInfo)(swapData);
        logToFile(`   Token name: ${tokenInfo.data?.name || 'N/A'}`);
        const solPrice = await (0, utils_1.getTokenPrice_)(swapData.inMint);
        logToFile(`   SOL Price: ${solPrice}`);
        const extensions = tokenInfo.data?.extensions ?? null;
        const positionTradeScore = await (0, utils_1.getTokenScore)(buyWallets, swapData);
        logToFile(`   TradeScore: ${positionTradeScore}`);
        buyWallets.sort((a, b) => {
            if (a > b) {
                return -1;
            }
            else if (a < b) {
                return 1;
            }
            return 0;
        });
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
        logToFile('📤 Preparing to send alerts...');
        await sendAlert('-1002359004329', message);
        await sendAlert('-1002444321759', message);
        logToFile('✅ checkDB_Alert COMPLETE');
    }
    catch (error) {
        logToFile(`❌ ERROR in checkDB_Alert: ${error}`);
        console.error('❌ Error in checkDB_Alert:', error);
    }
};
const processSwapData = async (swap_data) => {
    try {
        logToFile("========================================");
        logToFile("📊 processSwapData CALLED");
        if (!swap_data) {
            logToFile("❌ swap_data is NULL - returning");
            return;
        }
        logToFile(`✅ swap_data VALID`);
        logToFile(`   Owner: ${swap_data.owner}`);
        logToFile(`   Type: ${swap_data.type}`);
        logToFile(`   inMint: ${swap_data.inMint}`);
        logToFile(`   outMint: ${swap_data.outMint}`);
        logToFile(`   inAmount: ${swap_data.inAmount}`);
        logToFile(`   outAmount: ${swap_data.outAmount}`);
        logToFile(`   Signature: ${swap_data.signature}`);
        if (BLACKLISTED_WALLETS.includes(swap_data.owner)) {
            logToFile(`❌ BLACKLISTED - ${swap_data.owner}`);
            return;
        }
        const trackedWallet = config_1.wallets.find(w => w.address === swap_data.owner);
        if (!trackedWallet) {
            logToFile(`❌ NOT IN WHITELIST - ${swap_data.owner}`);
            return;
        }
        logToFile(`✅ WALLET OK: ${trackedWallet.name}`);
        let db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
        if (!db_wallet) {
            logToFile("⚠️ Wallet NOT in DB - creating...");
            await database.updateTrackWallet({
                wallet: swap_data.owner,
                tokens: [],
                name: trackedWallet.name
            });
            db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
            logToFile("✅ Wallet created in DB");
        }
        else {
            logToFile(`✅ Wallet found in DB: ${db_wallet.name}`);
        }
        if (swap_data.inMint === uniconst_1.WSOL_ADDRESS) {
            if (swap_data.outMint === uniconst_1.USDC_ADDRESS || swap_data.outMint === uniconst_1.USDT_ADDRESS) {
                logToFile("⭕ Skip: stablecoin swap");
                return;
            }
            logToFile(`💚 BUY DETECTED: ${trackedWallet.name} -> ${swap_data.outMint.substring(0, 8)}...`);
            const buytxTime = new Date();
            let token_index = db_wallet.tokens.findIndex((mint) => mint.mint === swap_data.outMint);
            if (token_index < 0) {
                logToFile("➕ New token for this wallet");
                db_wallet.tokens.push({
                    mint: swap_data.outMint,
                    type: "buy",
                    txTime: buytxTime.toLocaleString('en-US', {
                        hour12: false,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }),
                    inAmount: swap_data.inAmount
                });
            }
            else {
                logToFile("🔄 Existing token - updating");
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
            logToFile("✅ Wallet updated in DB");
            const buyPosition = await database.selectTrackPosition({ token: swap_data.outMint });
            logToFile(`Position check: ${buyPosition ? "EXISTS" : "NEW"}`);
            let openPosition = false;
            if (buyPosition && buyPosition.token) {
                openPosition = true;
                let wallet_index = buyPosition.wallets.findIndex((wallet) => wallet.address === swap_data.owner);
                if (wallet_index < 0) {
                    logToFile("➕ Adding wallet to position");
                    buyPosition.wallets.push({
                        address: swap_data.owner,
                        type: "buy",
                        name: db_wallet.name,
                        inAmount: swap_data.inAmount,
                        txTime: buytxTime.toLocaleString('en-US', {
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
                    logToFile("🔄 Updating wallet in position");
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
                logToFile(`📊 Buyers: OLD=${buysInPosition_old.length} NEW=${buysInPosition.length}`);
                if (buysInPosition && buysInPosition.length >= 3 && buysInPosition_old?.length != buysInPosition.length) {
                    logToFile(`🚨🚨🚨 ALERT TRIGGER: ${buysInPosition.length} buyers found!`);
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data);
                }
                else if (buysInPosition.length < 3) {
                    logToFile(`⭕ Less than 3 buyers (${buysInPosition.length}), removing position`);
                    await database.removeTrackPosition({ token: swap_data.outMint });
                    openPosition = false;
                }
                else {
                    logToFile(`⭕ Alert already sent (old=${buysInPosition_old.length}, new=${buysInPosition.length})`);
                }
            }
            if (!openPosition) {
                logToFile("🔍 No open position - checking all wallets...");
                let buycount = 0;
                let buyWallets = [];
                const trackWallets = await database.selectTrackWallets({});
                logToFile(`📊 Checking ${trackWallets.length} total wallets in DB`);
                for (const wallet of trackWallets) {
                    for (const token of wallet.tokens) {
                        if (token.mint === swap_data.outMint && token.type === "buy") {
                            buycount++;
                            buyWallets.push({
                                address: wallet.wallet,
                                type: "buy",
                                name: wallet.name,
                                inAmount: token.inAmount,
                                txTime: token.txTime
                            });
                            logToFile(`  ✓ ${wallet.name} has this token`);
                        }
                    }
                }
                logToFile(`📊 Found ${buycount} wallets with this token`);
                if (buycount >= 3 && buyWallets.length >= 3) {
                    logToFile(`🚨🚨🚨 NEW POSITION ALERT: ${buyWallets.length} buyers!`);
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false });
                    await checkDB_Alert(buyWallets, false, swap_data);
                }
                else {
                    logToFile(`⭕ Only ${buycount} wallets, need 3 for alert`);
                }
            }
        }
        else {
            if (swap_data.inMint === uniconst_1.USDC_ADDRESS || swap_data.inMint === uniconst_1.USDT_ADDRESS) {
                logToFile("⭕ Skip: stablecoin sell");
                return;
            }
            logToFile(`🔴 SELL DETECTED: ${trackedWallet.name} -> ${swap_data.inMint.substring(0, 8)}...`);
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
                    logToFile("✅ Sell registered");
                }
            }
            else {
                logToFile("⚠️ Token not found in wallet for sell");
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
                            logToFile("🚨 SELL ALERT");
                            await checkDB_Alert(sellPosition.wallets, true, swap_data);
                        }
                    }
                }
            }
            await (0, utils_1.delayForTrxSync)(swap_data.signature);
        }
        logToFile("========================================");
    }
    catch (error) {
        logToFile(`❌ ERROR in processSwapData: ${error}`);
        console.error('❌ Error in processSwapData:', error);
    }
};
const parseTransaction = async (data) => {
    try {
        if (data.filters.some((item) => item == 'subscribe_tx') && data.transaction) {
            const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
            const accountKeys = txn.transaction.message.staticAccountKeys;
            const signature = txn.transaction.signatures[0];
            const involvedAccounts = accountKeys.map((key) => key.toBase58());
            const ourWallets = involvedAccounts.filter((acc) => config_1.wallets.some(w => w.address === acc));
            if (ourWallets.length > 0) {
                logToFile(`✓ TRANSACTION WITH OUR WALLET: ${signature}`);
                logToFile(`  Our wallets involved: ${ourWallets.join(', ')}`);
            }
            const hasJupiter = accountKeys.find((programId) => programId.equals(constant_1.JUPITER_V6_PROGRAM_ID));
            if (hasJupiter) {
                logToFile("🟢 Jupiter transaction detected");
                try {
                    const ret = await (0, jupiter_detection_1.getJupiterSwapInfo)(txn);
                    if (ret) {
                        logToFile(`✅ Jupiter decode OK - proceeding to processSwapData`);
                        await processSwapData(ret);
                    }
                    else {
                        logToFile("❌ Jupiter decode returned NULL");
                    }
                }
                catch (error) {
                    logToFile(`❌ Jupiter decode ERROR: ${error}`);
                }
                return;
            }
            const hasCpmm = accountKeys.find((programId) => programId.equals(new web3_js_1.PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C")));
            if (hasCpmm) {
                logToFile("🟢 Raydium CPMM transaction detected");
                try {
                    const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
                    const ret = await (0, raydium_cpmm_detection_1.decodeRaydiumCpmmTxn)(txn);
                    if (ret) {
                        logToFile(`✅ Raydium CPMM decode OK - proceeding to processSwapData`);
                        await processSwapData(ret);
                    }
                    else {
                        logToFile("❌ Raydium CPMM decode returned NULL");
                    }
                }
                catch (error) {
                    logToFile(`❌ Raydium CPMM decode ERROR: ${error}`);
                }
                return;
            }
            const hasRaydium = accountKeys.find((programId) => programId.equals(global_1.RayLiqPoolv4));
            if (hasRaydium) {
                logToFile("�� Raydium transaction detected");
                try {
                    const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
                    const ret = await (0, raydium_detection_1.decodeRaydiumTxn)(txn);
                    if (ret) {
                        logToFile(`✅ Raydium decode OK - proceeding to processSwapData`);
                        await processSwapData(ret);
                    }
                    else {
                        logToFile("❌ Raydium decode returned NULL");
                    }
                }
                catch (error) {
                    logToFile(`❌ Raydium decode ERROR: ${error}`);
                }
                return;
            }
            const hasPumpFun = accountKeys.find((programId) => programId.equals(pumpfun_detection_1.PUMP_FUN_PROGRAM_ID));
            if (hasPumpFun) {
                logToFile("🟢 PumpFun transaction detected");
                try {
                    const ret = await (0, pumpfun_detection_1.decodePumpfunTxn)(txn);
                    if (ret) {
                        logToFile(`✅ PumpFun decode OK - proceeding to processSwapData`);
                        logToFile(`   Owner: ${ret.owner}`);
                        logToFile(`   Type: ${ret.type}`);
                        logToFile(`   inMint: ${ret.inMint}`);
                        logToFile(`   outMint: ${ret.outMint}`);
                        await processSwapData(ret);
                    }
                    else {
                        logToFile("❌ PumpFun decode returned NULL");
                    }
                }
                catch (error) {
                    logToFile(`❌ PumpFun decode ERROR: ${error}`);
                }
                return;
            }
            if (ourWallets.length > 0) {
                logToFile("⚠️ Transaction from our wallet but NO DEX detected");
                logToFile(`  First 5 programs: ${accountKeys.slice(0, 5).map(k => k.toBase58().substring(0, 8) + "...").join(', ')}`);
            }
        }
    }
    catch (error) {
        logToFile(`❌ ERROR parsing transaction: ${error}`);
        console.error('❌ Error parsing transaction:', error);
    }
};
async function handleStream(client, args) {
    logToFile('🌐 Stream connecting...');
    const stream = await client.subscribe();
    logToFile('✅ Stream connected successfully');
    let lastDataTime = Date.now();
    let transactionCount = 0;
    const heartbeat = setInterval(() => {
        const timeSinceLastData = Date.now() - lastDataTime;
        logToFile(`💓 Stream alive - last data: ${Math.floor(timeSinceLastData / 1000)}s ago, processed: ${transactionCount} txs`);
        if (timeSinceLastData > 300000) {
            logToFile('⚠️ Stream dead - forcing reconnection...');
            clearInterval(heartbeat);
            stream.end();
        }
    }, 60000);
    const streamClosed = new Promise((resolve, reject) => {
        stream.on("error", (error) => {
            logToFile(`❌ Stream ERROR: ${error}`);
            clearInterval(heartbeat);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            logToFile("🔴 Stream ENDED");
            clearInterval(heartbeat);
            resolve();
        });
        stream.on("close", () => {
            logToFile("🔴 Stream CLOSED");
            clearInterval(heartbeat);
            resolve();
        });
    });
    stream.on("data", (data) => {
        lastDataTime = Date.now();
        transactionCount++;
        if (transactionCount % 50 === 0) {
            logToFile(`📊 Processed ${transactionCount} transactions`);
        }
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
        logToFile(`❌ Stream write error: ${reason}`);
        throw reason;
    });
    await streamClosed;
}
async function subscribeCommand(client, args) {
    while (true) {
        try {
            logToFile("🚀 Starting Substream server...");
            await handleStream(client, args);
        }
        catch (error) {
            logToFile(`❌ Stream error, restarting in 1 second... Error: ${error}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
const client = new yellowstone_grpc_1.default('https://grpc.eu.shyft.to', process.env.GRPC_TOKEN, undefined);
const start = async () => {
    logToFile("================================");
    logToFile('🚀 TRACK-SWAP INITIALIZATION');
    logToFile("================================");
    logToFile(`Telegram Bot Token: ${process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN ? '✓' : '✗'}`);
    logToFile(`GRPC Token: ${process.env.GRPC_TOKEN ? '✓' : '✗'}`);
    logToFile('GRPC Endpoint: https://grpc.eu.shyft.to');
    let detection_wallets = await (0, wallets_1.getWallets)();
    logToFile(`📊 Total wallets to track: ${detection_wallets.length}`);
    const testWallets = [
        'prED5Hv9jaZmKRw7NcENdUMu6Pw2NWBmN2DSAEbNP7Y',
        'pp2rgZ8Bshvc1XHCerHJH77fNA7AGQND8D9zfW2AeVb',
        '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'
    ];
    for (let wallet of testWallets) {
        if (detection_wallets.includes(wallet)) {
            logToFile(`✓ ${wallet.substring(0, 8)}... is in tracking list`);
        }
        else {
            logToFile(`✗ ${wallet.substring(0, 8)}... NOT in tracking list`);
        }
    }
    logToFile("================================");
    logToFile("🌐 Starting gRPC stream subscription...");
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
    logToFile(`📡 Subscription request created with ${detection_wallets.length} wallets`);
    subscribeCommand(client, req);
};
exports.start = start;
//# sourceMappingURL=track-swap.js.map