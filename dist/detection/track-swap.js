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
const ALERT_THRESHOLD = 3;
const LAMPORTS_TO_SOL = 1000000000;
const DEBUG_WALLETS = {
    'Assassin.eth': '6LChaYRYtEYjLEHhzo4HdEmgNwu2aia8CM8VhR9wn6n7',
    'Doc': 'DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt',
    'GigaBrain': '3h65MmPZksoKKyEpEjnWU2Yk2iYT5oZDNitGy5cTaxoE',
    'Gake': 'DNfuF1L62WWyW3pqQwTxk8nKdX4CNnz5DKEFmnXvT4jK',
    '1': '4t9bWuZsXXKGMgmd96nFD4KWxyPNTsPm4q9jEMH4jD2i',
    'LetterBomb': 'BtMBMPkoNbnLF9Xn552guQq528KKXcsNBNNBre3oaQtr'
};
let dexStats = {
    jupiter: 0,
    raydium: 0,
    pumpfun: 0,
    cpmm: 0,
    universal: 0,
    unknown: 0,
    total: 0,
    ourWalletTxs: 0,
    swapsProcessed: 0,
    missedSwaps: 0
};
const lamportsToSol = (lamports) => lamports / LAMPORTS_TO_SOL;
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
function findOurWalletsInTransaction(accountKeys) {
    const results = [];
    const accounts = accountKeys.map(k => k.toBase58());
    for (let i = 0; i < accounts.length; i++) {
        const wallet = config_1.wallets.find(w => w.address === accounts[i]);
        if (wallet) {
            results.push({
                address: accounts[i],
                wallet: wallet,
                position: i
            });
        }
    }
    return results;
}
async function decodeUniversalSwap(tx) {
    const swaps = [];
    try {
        if (!tx.meta || tx.meta?.err)
            return swaps;
        const accountKeys = tx.version === 0 ?
            tx.transaction.message.staticAccountKeys :
            tx.transaction.message.accountKeys;
        const ourWallets = findOurWalletsInTransaction(accountKeys);
        if (ourWallets.length === 0) {
            return swaps;
        }
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];
        for (const ourWallet of ourWallets) {
            const owner = ourWallet.address;
            const walletInfo = ourWallet.wallet;
            const debugName = Object.keys(DEBUG_WALLETS).find(name => DEBUG_WALLETS[name] === owner);
            const tokenChanges = [];
            for (const post of postBalances) {
                const isOurAccount = post.owner === owner ||
                    (post.accountIndex < accountKeys.length && accountKeys[post.accountIndex].toBase58() === owner);
                if (!isOurAccount)
                    continue;
                const pre = preBalances.find(p => p.accountIndex === post.accountIndex &&
                    p.mint === post.mint);
                if (pre) {
                    const change = Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount);
                    if (Math.abs(change) > 0) {
                        tokenChanges.push({
                            mint: post.mint,
                            change: change,
                            isIncrease: change > 0,
                            decimals: post.uiTokenAmount.decimals
                        });
                    }
                }
                else if (Number(post.uiTokenAmount.amount) > 0) {
                    tokenChanges.push({
                        mint: post.mint,
                        change: Number(post.uiTokenAmount.amount),
                        isIncrease: true,
                        decimals: post.uiTokenAmount.decimals
                    });
                }
            }
            for (const pre of preBalances) {
                const isOurAccount = pre.owner === owner ||
                    (pre.accountIndex < accountKeys.length && accountKeys[pre.accountIndex].toBase58() === owner);
                if (!isOurAccount)
                    continue;
                const post = postBalances.find(p => p.accountIndex === pre.accountIndex &&
                    p.mint === pre.mint);
                if (!post && Number(pre.uiTokenAmount.amount) > 0) {
                    tokenChanges.push({
                        mint: pre.mint,
                        change: -Number(pre.uiTokenAmount.amount),
                        isIncrease: false,
                        decimals: pre.uiTokenAmount.decimals
                    });
                }
            }
            let solChange = 0;
            if (ourWallet.position < tx.meta.postBalances.length &&
                ourWallet.position < tx.meta.preBalances.length) {
                solChange = tx.meta.postBalances[ourWallet.position] - tx.meta.preBalances[ourWallet.position];
                if (ourWallet.position === 0) {
                    solChange += (tx.meta.fee || 0);
                }
            }
            if (debugName && (tokenChanges.length > 0 || Math.abs(solChange) > 100000)) {
                logToFile(`   🔍 ${debugName} Universal Analysis:`);
                logToFile(`      Token changes: ${tokenChanges.length}`);
                logToFile(`      SOL change: ${lamportsToSol(solChange).toFixed(4)} SOL`);
                for (const tc of tokenChanges) {
                    logToFile(`      Token: ${tc.mint.substring(0, 8)}... ${tc.isIncrease ? '+' : ''}${tc.change}`);
                }
            }
            if (tokenChanges.length === 1 && Math.abs(solChange) > 10000) {
                const token = tokenChanges[0];
                if (token.mint === uniconst_1.WSOL_ADDRESS || token.mint === "So11111111111111111111111111111111111111112") {
                    continue;
                }
                if (token.isIncrease && solChange < 0) {
                    logToFile(`   ✅ Universal: ${walletInfo.name} BUY detected`);
                    swaps.push({
                        signature: tx.transaction.signatures[0],
                        owner: owner,
                        type: 'universal',
                        inMint: uniconst_1.WSOL_ADDRESS,
                        outMint: token.mint,
                        inAmount: Math.abs(solChange),
                        outAmount: Math.abs(token.change)
                    });
                }
                else if (!token.isIncrease && solChange > 0) {
                    logToFile(`   ✅ Universal: ${walletInfo.name} SELL detected`);
                    swaps.push({
                        signature: tx.transaction.signatures[0],
                        owner: owner,
                        type: 'universal',
                        inMint: token.mint,
                        outMint: uniconst_1.WSOL_ADDRESS,
                        inAmount: Math.abs(token.change),
                        outAmount: Math.abs(solChange)
                    });
                }
            }
            else if (tokenChanges.length === 2) {
                const token1 = tokenChanges[0];
                const token2 = tokenChanges[1];
                if (token1.isIncrease !== token2.isIncrease) {
                    const buyToken = token1.isIncrease ? token1 : token2;
                    const sellToken = token1.isIncrease ? token2 : token1;
                    logToFile(`   ✅ Universal: ${walletInfo.name} TOKEN-TOKEN swap detected`);
                    swaps.push({
                        signature: tx.transaction.signatures[0],
                        owner: owner,
                        type: 'universal',
                        inMint: sellToken.mint,
                        outMint: buyToken.mint,
                        inAmount: Math.abs(sellToken.change),
                        outAmount: Math.abs(buyToken.change)
                    });
                }
            }
        }
        return swaps;
    }
    catch (error) {
        logToFile(`❌ Universal decoder error: ${error}`);
        return swaps;
    }
}
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
        const solPrice = await (0, utils_1.getTokenPrice_)(uniconst_1.WSOL_ADDRESS);
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
        message = message + '\n💸 <b>New smart holder entry</b>\n';
        message = message + '\n🔎 <b>Address</b>: <code>' + swapData.outMint + '</code>';
        message = message + '\n💰 <b>Name</b>: ' + (tokenInfo.data?.name ?? " ");
        message = message + '\n📈 <b>MCap</b>: ' + tokenMCap;
        if (extensions && extensions.website) {
            message = message + '\n🔗 <a href="' + extensions.website + '">Website</a>';
        }
        if (extensions && extensions.twitter) {
            message = message + '\n🔗 <a href="' + extensions.twitter + '">Twitter</a>';
        }
        if (extensions && extensions.telegram) {
            message = message + '\n🔗 <a href="' + extensions.telegram + '">Telegram</a>';
        }
        message = message + '\n\n💯 <b>TradeScore</b>: ' + positionTradeScore;
        message = message + '\n\n🦚 <b>' + (buyWallets.length - sellWallets.length) + ' smart holders</b>';
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "buy") {
                const solAmount = buyWallets[i].inAmount / LAMPORTS_TO_SOL;
                const usdAmount = solPrice ? (solAmount * solPrice).toFixed(0) : "N/A";
                message = message + '\n🟢 ' + buyWallets[i].name + '  ($' + usdAmount + ') (' + buyWallets[i].txTime + ')';
                logToFile(`   Wallet ${buyWallets[i].name}: ${buyWallets[i].inAmount} lamports = ${solAmount.toFixed(4)} SOL = $${usdAmount}`);
            }
        }
        message = message + '\n\n◉ <b>' + sellWallets.length + ' close</b>';
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "sell") {
                message = message + '\n🔴 ' + buyWallets[i].name;
            }
        }
        message = message + '\n\n⚡ <a href="https://jup.ag/swap/' + swapData.outMint + '-SOL">Jupiter</a>';
        message = message + '\n🸸 <a href="https://gmgn.ai/sol/token/' + swapData.outMint + '">Gmgn</a>';
        message = message + '\n🚀 <a href="https://photon-sol.tinyastro.io/en/lp/' + swapData.outMint + '">Photon</a>';
        message = message + '\n🐂 <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=' + swapData.outMint + '">Bullx</a>';
        logToFile('📤 Preparing to send alerts...');
        await sendAlert(process.env.GROUP_CHATID || '', message);
        await sendAlert(process.env.GROUP_CHATID1 || '', message);
        await sendAlert(process.env.GROUP_CHATID2 || '', message);
        logToFile('✅ checkDB_Alert COMPLETE');
    }
    catch (error) {
        logToFile(`❌ ERROR in checkDB_Alert: ${error}`);
    }
};
const processSwapData = async (swap_data) => {
    try {
        if (!swap_data)
            return;
        if (swap_data.inMint === swap_data.outMint)
            return;
        if (BLACKLISTED_WALLETS.includes(swap_data.owner))
            return;
        const trackedWallet = config_1.wallets.find(w => w.address === swap_data.owner);
        if (!trackedWallet)
            return;
        const debugName = Object.keys(DEBUG_WALLETS).find(name => DEBUG_WALLETS[name] === swap_data.owner);
        if (debugName) {
            const solAmount = swap_data.inMint === uniconst_1.WSOL_ADDRESS
                ? lamportsToSol(swap_data.inAmount)
                : lamportsToSol(swap_data.outAmount);
            logToFile(`📊 SWAP by ${trackedWallet.name}: ${swap_data.inMint === uniconst_1.WSOL_ADDRESS ? 'BUY' : 'SELL'} ${solAmount.toFixed(4)} SOL`);
        }
        dexStats.swapsProcessed++;
        let db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
        if (!db_wallet) {
            await database.updateTrackWallet({
                wallet: swap_data.owner,
                tokens: [],
                name: trackedWallet.name
            });
            db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
        }
        if (swap_data.inMint === uniconst_1.WSOL_ADDRESS) {
            if (swap_data.outMint === uniconst_1.USDC_ADDRESS || swap_data.outMint === uniconst_1.USDT_ADDRESS)
                return;
            const buytxTime = new Date();
            let token_index = db_wallet.tokens.findIndex((mint) => mint.mint === swap_data.outMint);
            if (token_index < 0) {
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
                const buysBefore = buyPosition.wallets.filter((w) => w.type === "buy").length;
                if (wallet_index < 0) {
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
                await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets, old: true });
                const buysAfter = buyPosition.wallets.filter((wallet) => wallet.type === "buy").length;
                if (buysAfter >= ALERT_THRESHOLD && buysAfter > buysBefore) {
                    logToFile(`🚨 ALERT: ${buysAfter} buyers for ${swap_data.outMint.substring(0, 8)}...`);
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data);
                }
                else if (buysAfter < ALERT_THRESHOLD) {
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
                            buyWallets.push({
                                address: wallet.wallet,
                                type: "buy",
                                name: wallet.name,
                                inAmount: token.inAmount,
                                txTime: token.txTime
                            });
                        }
                    }
                }
                if (buycount >= ALERT_THRESHOLD) {
                    logToFile(`🚨 NEW ALERT: ${buycount} buyers for ${swap_data.outMint.substring(0, 8)}...`);
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false });
                    await checkDB_Alert(buyWallets, false, swap_data);
                }
            }
        }
        else {
            if (swap_data.inMint === uniconst_1.USDC_ADDRESS || swap_data.inMint === uniconst_1.USDT_ADDRESS)
                return;
            let token_index = db_wallet.tokens.findIndex((mint) => mint.mint === swap_data.inMint);
            if (token_index >= 0) {
                db_wallet.tokens[token_index].type = "sell";
                db_wallet.tokens[token_index].inAmount = 0;
                await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name });
                const sellPosition = await database.selectTrackPosition({ token: swap_data.inMint });
                if (sellPosition) {
                    let wallet_index = sellPosition.wallets.findIndex((wallet) => wallet.address === swap_data.owner);
                    if (wallet_index >= 0) {
                        sellPosition.wallets[wallet_index].type = "sell";
                        await database.updateTrackPosition({ token: swap_data.inMint, wallets: sellPosition.wallets, old: true });
                    }
                }
            }
            await (0, utils_1.delayForTrxSync)(swap_data.signature);
        }
    }
    catch (error) {
        logToFile(`❌ ERROR in processSwapData: ${error}`);
    }
};
const parseTransaction = async (data) => {
    try {
        if (data.filters.some((item) => item == 'subscribe_tx') && data.transaction) {
            const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
            const accountKeys = txn.transaction.message.staticAccountKeys;
            const signature = txn.transaction.signatures[0];
            dexStats.total++;
            const ourWallets = findOurWalletsInTransaction(accountKeys);
            if (ourWallets.length === 0)
                return;
            dexStats.ourWalletTxs++;
            for (const w of ourWallets) {
                const debugName = Object.keys(DEBUG_WALLETS).find(name => DEBUG_WALLETS[name] === w.address);
                if (debugName) {
                    logToFile(`🔍 ${debugName} in tx ${signature.substring(0, 8)}... at position ${w.position}`);
                }
            }
            const allSwaps = [];
            if (accountKeys.some((k) => k.equals(constant_1.JUPITER_V6_PROGRAM_ID))) {
                dexStats.jupiter++;
                try {
                    const ret = await (0, jupiter_detection_1.getJupiterSwapInfo)(txn);
                    if (ret && config_1.wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ Jupiter swap detected for ${ret.owner.substring(0, 8)}...`);
                        allSwaps.push(ret);
                    }
                }
                catch (error) {
                    logToFile(`❌ Jupiter decode error: ${error}`);
                }
            }
            if (accountKeys.some((k) => k.equals(pumpfun_detection_1.PUMP_FUN_PROGRAM_ID))) {
                dexStats.pumpfun++;
                try {
                    const ret = await (0, pumpfun_detection_1.decodePumpfunTxn)(txn);
                    if (ret && config_1.wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ PumpFun swap detected for ${ret.owner.substring(0, 8)}...`);
                        allSwaps.push(ret);
                    }
                }
                catch (error) {
                    logToFile(`❌ PumpFun decode error: ${error}`);
                }
            }
            if (accountKeys.some((k) => k.toBase58() === "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C")) {
                dexStats.cpmm++;
                try {
                    const ret = await (0, raydium_cpmm_detection_1.decodeRaydiumCpmmTxn)(txn);
                    if (ret && config_1.wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ Raydium CPMM swap detected for ${ret.owner.substring(0, 8)}...`);
                        allSwaps.push(ret);
                    }
                }
                catch (error) {
                    logToFile(`❌ CPMM decode error: ${error}`);
                }
            }
            if (accountKeys.some((k) => k.equals(global_1.RayLiqPoolv4))) {
                dexStats.raydium++;
                try {
                    const ret = await (0, raydium_detection_1.decodeRaydiumTxn)(txn);
                    if (ret && config_1.wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ Raydium swap detected for ${ret.owner.substring(0, 8)}...`);
                        allSwaps.push(ret);
                    }
                }
                catch (error) {
                    logToFile(`❌ Raydium decode error: ${error}`);
                }
            }
            try {
                const universalSwaps = await decodeUniversalSwap(txn);
                if (universalSwaps.length > 0) {
                    dexStats.universal += universalSwaps.length;
                    for (const swap of universalSwaps) {
                        const isDuplicate = allSwaps.some(s => s.owner === swap.owner &&
                            Math.abs(s.inAmount - swap.inAmount) < 1000);
                        if (!isDuplicate) {
                            logToFile(`✅ Universal swap detected for ${swap.owner.substring(0, 8)}...`);
                            allSwaps.push(swap);
                        }
                    }
                }
            }
            catch (error) {
                logToFile(`❌ Universal decode error: ${error}`);
            }
            if (allSwaps.length > 0) {
                logToFile(`🔄 Processing ${allSwaps.length} swap(s)`);
                for (const swap of allSwaps) {
                    await processSwapData(swap);
                }
            }
            else if (ourWallets.length > 0) {
                const hasAnyDex = accountKeys.some((k) => k.equals(constant_1.JUPITER_V6_PROGRAM_ID) ||
                    k.equals(pumpfun_detection_1.PUMP_FUN_PROGRAM_ID) ||
                    k.equals(global_1.RayLiqPoolv4) ||
                    k.toBase58() === "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
                if (hasAnyDex) {
                    for (const w of ourWallets) {
                        const debugName = Object.keys(DEBUG_WALLETS).find(name => DEBUG_WALLETS[name] === w.address);
                        if (debugName) {
                            logToFile(`   ⚠️ POSSIBLE MISSED SWAP for ${debugName} - DEX detected but no swap decoded`);
                        }
                    }
                    dexStats.missedSwaps++;
                }
            }
            if (dexStats.total % 100 === 0) {
                logToFile(`📊 STATS: Txs=${dexStats.total} OurWallet=${dexStats.ourWalletTxs} Swaps=${dexStats.swapsProcessed} Missed=${dexStats.missedSwaps}`);
                logToFile(`   DEX breakdown: Jup=${dexStats.jupiter} Pump=${dexStats.pumpfun} Ray=${dexStats.raydium} CPMM=${dexStats.cpmm} Universal=${dexStats.universal}`);
            }
        }
    }
    catch (error) {
        logToFile(`❌ ERROR parsing transaction: ${error}`);
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
        logToFile(`💗 Stream: ${Math.floor(timeSinceLastData / 1000)}s | Txs: ${transactionCount} | Our: ${dexStats.ourWalletTxs} | Swaps: ${dexStats.swapsProcessed}`);
        if (timeSinceLastData > 300000) {
            logToFile('⚠️ Stream dead - reconnecting...');
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
            logToFile("🚀 Starting stream...");
            logToFile(`📊 Alert threshold: ${ALERT_THRESHOLD} wallet(s)`);
            logToFile("🔍 Universal decoder: ENHANCED with SOL conversion fix");
            logToFile("✅ All DEX decoders: ACTIVE for all tracked wallets");
            await handleStream(client, args);
        }
        catch (error) {
            logToFile(`❌ Stream error, restarting... ${error}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
const client = new yellowstone_grpc_1.default('https://grpc.eu.shyft.to', process.env.GRPC_TOKEN, undefined);
const start = async () => {
    logToFile("================================");
    logToFile('🚀 TRACK-SWAP V5.1 - FIXED USD VALUES');
    logToFile("================================");
    logToFile(`Alert threshold: ${ALERT_THRESHOLD} wallet(s)`);
    logToFile('✅ Decoders active for ALL tracked wallets');
    logToFile('✅ No amount limits on swaps');
    logToFile('✅ Enhanced universal decoder with proper SOL conversion');
    logToFile('✅ SOL values now properly converted from lamports');
    logToFile('✅ USD values now calculated correctly');
    let detection_wallets = await (0, wallets_1.getWallets)();
    logToFile(`📊 Tracking ${detection_wallets.length} wallets`);
    for (const [name, address] of Object.entries(DEBUG_WALLETS)) {
        if (detection_wallets.includes(address)) {
            logToFile(`✅ ${name} is tracked`);
        }
    }
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