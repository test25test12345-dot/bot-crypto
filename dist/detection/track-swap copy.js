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
const instance = __importStar(require("../bot"));
const pumpfun_detection_1 = require("../pumpfun-lib/pumpfun-detection");
const birdeyeApi = require("api")("@birdeyedotso/v1.0#crnv83jlti6buqu");
birdeyeApi.auth(process.env.BIRDEYE_API_KEY);
const TXN_FORMATTER = new transaction_formatter_1.TransactionFormatter();
const checkDB_Alert = async (buyWallets, swapData) => {
    const sellWallets = await buyWallets.filter((wallet) => wallet.type === "sell");
    const tokenMCap = await (0, utils_1.getTokenMcap)(swapData);
    const tokenInfo = await (0, utils_1.getTokenInfo)(swapData);
    const solPrice = await (0, utils_1.getTokenPrice_)(swapData.inMint);
    console.log("solprice=====", solPrice);
    const extensions = tokenInfo.data?.extensions ?? null;
    const positionTradeScore = await (0, utils_1.getTokenScore)(buyWallets, swapData);
    buyWallets.sort((a, b) => {
        if (a > b) {
            return -1;
        }
        else if (a < b) {
            return 1;
        }
        return 0;
    });
    let message = ``;
    message = `
    ${message} 
💸 <b>New smart holder entry</b>

🔎 <b>Address</b>: <code>${swapData.outMint}</code>
💰 <b>Name</b>: ${tokenInfo.data?.name ?? " "}
📈 <b>MCap</b>: ${tokenMCap}`;
    if (extensions && extensions.website) {
        message =
            `${message}
🔗 <a href="${extensions.website}">Website</a>`;
    }
    if (extensions && extensions.twitter) {
        message =
            `${message}        
🔗 <a href="${extensions.twitter}">Twitter</a>`;
    }
    if (extensions && extensions.telegram) {
        message =
            `${message}        
🔗 <a href="${extensions.telegram}">Telegram</a>`;
    }
    if (extensions && extensions.discord) {
        message =
            `${message}        
🔗 <a href="${extensions.discord}">Discord</a>`;
    }
    message = `
    ${message}

💯 <b>TradeScore</b>: ${positionTradeScore}
`;
    message = `${message}
🦚 <b>${buyWallets.length - sellWallets.length} smart holders</b> `;
    for (let i = 0; i < buyWallets.length; i++) {
        if (buyWallets[i].type === "buy") {
            console.log("buybalance===", buyWallets[i].inAmount, solPrice, buyWallets[i].txTime);
            message = `${message}
🟢 ${buyWallets[i].name}  ($${(buyWallets[i].inAmount / 10 ** 9 * solPrice).toFixed(0)}) (${buyWallets[i].txTime})`;
        }
    }
    message = `${message}

❗ <b>${sellWallets.length} close</b>`;
    for (let i = 0; i < buyWallets.length; i++) {
        if (buyWallets[i].type === "sell")
            message = `${message}
🔴 ${buyWallets[i].name}`;
    }
    message =
        `${message}

⚡ <a href="https://jup.ag/swap/${swapData.outMint}-SOL">Jupiter</a>
🐸 <a href="https://gmgn.ai/sol/token/${swapData.outMint}">Gmgn</a>
🚀 <a href="https://photon-sol.tinyastro.io/en/lp/${swapData.outMint}">Photon</a>
🐂 <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=${swapData.outMint}">Bullx</a>`;
    instance.sendInfoMessage(process.env.GROUP_CHATID, message);
    instance.sendInfoMessage(process.env.GROUP_CHATID1, message);
    instance.sendInfoMessage(process.env.GROUP_CHATID2, message);
};
const processSwapData = async (swap_data) => {
    console.log("Detection processing==========", new Date().getTime());
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
        const buytxTime = new Date(date.getTime());
        let token_index = db_wallet.tokens.findIndex((mint) => mint.mint === swap_data.outMint);
        if (token_index < 0)
            db_wallet.tokens.push({ mint: swap_data.outMint, type: "buy", txTime: buytxTime.toLocaleTimeString('en-US', { hour12: false }), inAmount: swap_data.inAmount });
        else {
            db_wallet.tokens[token_index].type = "buy";
            db_wallet.tokens[token_index].txTime = buytxTime.toLocaleTimeString('en-US', { hour12: false });
            db_wallet.tokens[token_index].inAmount = Number(db_wallet.tokens[token_index].inAmount) + Number(swap_data.inAmount);
        }
        await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name });
        const buyPosition = await database.selectTrackPosition({ token: swap_data.outMint });
        let openPosition = false;
        if (buyPosition && buyPosition.token) {
            openPosition = true;
            let wallet_index = buyPosition.wallets.findIndex((wallet) => wallet.address === swap_data.owner);
            if (wallet_index < 0) {
                buyPosition.wallets.push({ address: swap_data.owner, type: "buy", name: db_wallet.name, inAmount: swap_data.inAmount, txTime: buytxTime.toLocaleTimeString('en-US', { hour12: false }) });
            }
            else {
                buyPosition.wallets[wallet_index].type = "buy";
                buyPosition.wallets[wallet_index].inAmount = swap_data.inAmount;
                buyPosition.wallets[wallet_index].txTime = buytxTime.toLocaleTimeString('en-US', { hour12: false });
            }
            await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets });
            const buysInPosition = buyPosition.wallets.filter((wallet) => wallet.type === "buy");
            if (buysInPosition && buysInPosition.length >= 3)
                await checkDB_Alert(buyPosition.wallets, swap_data);
            else {
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
                console.log("buycount====", buycount);
                if (buycount >= 3 && buyWallets.length >= 3) {
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets });
                    await checkDB_Alert(buyWallets, swap_data);
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
                    await database.updateTrackPosition({ token: swap_data.inMint, wallets: sellPosition.wallets });
                }
            }
        }
        await (0, utils_1.delayForTrxSync)(swap_data.signature);
    }
};
const parseTransfer = async (txn) => {
    try {
        const logMessages = txn.meta.logMessages;
        const owner = txn.transaction.message.versioned ? new web3_js_1.PublicKey(Buffer.from(txn.transaction.message.accountKeys[0], "base64")) : Buffer.from(txn.transaction.message.accountKeys[0], "base64");
        console.log("Transfer detection ... ");
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
            message = `🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
            User transfered ${count} times
    ${message}`;
            if (count > 0) {
            }
        }
    }
    catch (error) {
        console.log("Transfer detection error", error, txn);
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
            console.log("Detection=====", new Date());
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
    }
};
async function handleStream(client, args) {
    const stream = await client.subscribe();
    const streamClosed = new Promise((resolve, reject) => {
        stream.on("error", (error) => {
            console.log("ERRRORORROROROR", error);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            resolve();
        });
        stream.on("close", () => {
            resolve();
        });
    });
    stream.on("data", (data) => {
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
    let detection_wallets = await (0, wallets_1.getWallets)();
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
//# sourceMappingURL=track-swap%20copy.js.map