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
exports.getTokenInfo = exports.getTokenScore = exports.getTokenVolume = exports.getTokenMcap = exports.getTokenMcapRaw = exports.getTokenPrice_ = exports.DecimalUtil = exports.delayForTrxSync = exports.getConfirmation = exports.getWalletSOLBalance = exports.getWalletTokenBalance = exports.getWalletTokenAccount = exports.sleep = exports.getShortenedAddress = exports.fetchAPIBy = exports.fetchAPI = exports.getTokenPriceByUSD = exports.getTokenPrice = exports.getSOLPrice = exports.LAST_GET_TIME = exports.SOL_PRICE = exports.getTokenMetadata = exports.limitString = exports.shortenString = exports.shortenAddress = exports.isValidAddress = void 0;
exports.getBalance = getBalance;
exports.objectDeepCopy = objectDeepCopy;
exports.getTokenAddressFromTokenAccount = getTokenAddressFromTokenAccount;
exports.uint8ArrayToHexString = uint8ArrayToHexString;
exports.bnLayoutFormatter = bnLayoutFormatter;
exports.bytesToInt = bytesToInt;
exports.bufferFromUInt64 = bufferFromUInt64;
exports.bytesToUInt64 = bytesToUInt64;
const axios_1 = __importDefault(require("axios"));
const assert_1 = __importDefault(require("assert"));
const afx = __importStar(require("./global"));
const concurrencer_1 = require("./concurrencer");
const uniconst = __importStar(require("./uniconst"));
const jpAPI = __importStar(require("./jup-lib/jupiter_api"));
const raydiumAPI = __importStar(require("./raydium-lib/raydium_api"));
const delay_detector_1 = require("./delay_detector");
const lodash_1 = require("lodash");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const web3_js_1 = require("@solana/web3.js");
const serum_1 = require("@project-serum/serum");
const js_1 = require("@metaplex-foundation/js");
const spl_token_1 = require("@solana/spl-token");
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const decimal_js_1 = __importDefault(require("decimal.js"));
const config_1 = require("./detection/config");
const isValidAddress = (address) => {
    try {
        const publicKey = new web3_js_1.PublicKey(address);
        return true;
    }
    catch (error) {
        return false;
    }
};
exports.isValidAddress = isValidAddress;
async function getBalance(wallet) {
    (0, assert_1.default)(afx.web3Conn);
    return await afx.web3Conn.getBalance(new web3_js_1.PublicKey(wallet)) / web3_js_1.LAMPORTS_PER_SOL;
}
const shortenAddress = (address, length = 6) => {
    if (address.length < 2 + 2 * length) {
        return address;
    }
    const start = address.substring(0, length + 2);
    const end = address.substring(address.length - length);
    return start + "..." + end;
};
exports.shortenAddress = shortenAddress;
const shortenString = (str, length = 8) => {
    if (length < 3) {
        length = 3;
    }
    if (!str) {
        return "undefined";
    }
    if (str.length < length) {
        return str;
    }
    const temp = str.substring(0, length - 3) + '...';
    return temp;
};
exports.shortenString = shortenString;
const limitString = (str, length = 8) => {
    if (length < 3) {
        length = 3;
    }
    if (!str) {
        return "undefined";
    }
    if (str.length < length) {
        return str;
    }
    const temp = str.substring(0, length);
    return temp;
};
exports.limitString = limitString;
const getTokenMetadata = async (address) => {
    (0, assert_1.default)(afx.web3Conn);
    try {
        const metaplex = js_1.Metaplex.make(afx.web3Conn);
        const mintAddress = new web3_js_1.PublicKey(address);
        let name;
        let symbol;
        let logo;
        let decimals;
        let totalSupply;
        let renounced;
        let description;
        let extensions;
        const metadataAccount = metaplex
            .nfts()
            .pdas()
            .metadata({ mint: mintAddress });
        let infoObtainer = new concurrencer_1.Concurrencer();
        const obtainer_index_token1 = infoObtainer.add((async () => {
            try {
                return await (0, spl_token_1.getMint)(afx.web3Conn, mintAddress);
            }
            catch (error) {
                console.log('PASSED!!!', error);
                return null;
            }
        })());
        await infoObtainer.wait();
        const mintInfo = infoObtainer.getResult(obtainer_index_token1);
        if (mintInfo) {
            const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
            name = token.name;
            symbol = token.symbol;
            logo = token.json?.image;
            description = token.json?.description;
            extensions = {
                telegram: token.json?.telegram,
                twitter: token.json?.twitter,
                website: token.json?.website
            };
            decimals = token.mint.decimals;
            totalSupply = Number(mintInfo.supply / BigInt(10 ** decimals));
            renounced = token.mint.mintAuthorityAddress ? false : true;
            if (address === uniconst.WSOL_ADDRESS) {
                if (!logo) {
                    logo = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
                }
                if (!extensions) {
                    extensions = {
                        website: 'https://solana.com/'
                    };
                }
            }
            return { name, symbol, logo, decimals, address, totalSupply, description, extensions, renounced };
        }
    }
    catch (error) {
        console.log("utils.getTokenMetadata", error);
    }
    return null;
};
exports.getTokenMetadata = getTokenMetadata;
exports.SOL_PRICE = 0;
exports.LAST_GET_TIME = 0;
const getSOLPrice = async () => {
    if ((new Date()).getTime() - exports.LAST_GET_TIME < 5000) {
        return exports.SOL_PRICE;
    }
    (0, assert_1.default)(afx.web3Conn);
    try {
        const info = await afx.web3Conn.getAccountInfo(new web3_js_1.PublicKey(uniconst.SOL_USDC_POOL_ADDRESS));
        if (!info)
            return null;
        const poolState = raydium_sdk_1.LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
        const baseDecimal = 10 ** Number(poolState.baseDecimal);
        const quoteDecimal = 10 ** Number(poolState.quoteDecimal);
        let infoObtainer = new concurrencer_1.Concurrencer();
        const obtainer_index_token0 = infoObtainer.add(serum_1.OpenOrders.load(afx.web3Conn, poolState.openOrders, new web3_js_1.PublicKey(uniconst.OPENBOOK_PROGRAM_ADDRESS)));
        const obtainer_index_token1 = infoObtainer.add(afx.web3Conn.getTokenAccountBalance(poolState.baseVault));
        const obtainer_index_token2 = infoObtainer.add(afx.web3Conn.getTokenAccountBalance(poolState.quoteVault));
        await infoObtainer.wait();
        const openOrders = infoObtainer.getResult(obtainer_index_token0);
        const baseTokenAmount = infoObtainer.getResult(obtainer_index_token1);
        const quoteTokenAmount = infoObtainer.getResult(obtainer_index_token2);
        const basePnl = Number(poolState.baseNeedTakePnl) / baseDecimal;
        const quotePnl = Number(poolState.quoteNeedTakePnl) / quoteDecimal;
        const openOrdersBaseTokenTotal = Number(openOrders.baseTokenTotal) / baseDecimal;
        const openOrdersQuoteTokenTotal = Number(openOrders.quoteTokenTotal) / quoteDecimal;
        const base = (baseTokenAmount.value?.uiAmount || 0) + openOrdersBaseTokenTotal - basePnl;
        const quote = (quoteTokenAmount.value?.uiAmount || 0) +
            openOrdersQuoteTokenTotal -
            quotePnl;
        exports.LAST_GET_TIME = (new Date()).getTime();
        exports.SOL_PRICE = quote / base;
        return exports.SOL_PRICE;
    }
    catch (error) {
    }
    return null;
};
exports.getSOLPrice = getSOLPrice;
const getTokenPrice = async (tokenAddress) => {
    return await raydiumAPI.getTokenPrice(tokenAddress);
};
exports.getTokenPrice = getTokenPrice;
const getTokenPriceByUSD = async (tokenAddress) => {
    return await jpAPI.getTokenPriceByUSD(tokenAddress);
};
exports.getTokenPriceByUSD = getTokenPriceByUSD;
const fetchAPI = async (url, method, data = {}) => {
    return new Promise(resolve => {
        if (method === "POST") {
            axios_1.default.post(url, data).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                resolve(null);
            });
        }
        else {
            axios_1.default.get(url).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                resolve(null);
            });
        }
    });
};
exports.fetchAPI = fetchAPI;
const fetchAPIBy = async (url, method, data = {}) => {
    return new Promise(resolve => {
        if (method === "POST") {
            axios_1.default.post(url, data).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                resolve(null);
            });
        }
        else {
            console.log(url);
            axios_1.default.get(url).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                console.error('fetchAPI', error);
                resolve(null);
            });
        }
    });
};
exports.fetchAPIBy = fetchAPIBy;
const getShortenedAddress = (address) => {
    if (!address) {
        return '';
    }
    let str = address.slice(0, 24) + '...';
    return str;
};
exports.getShortenedAddress = getShortenedAddress;
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.sleep = sleep;
function objectDeepCopy(obj, keysToExclude = []) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const copiedObject = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !keysToExclude.includes(key)) {
            copiedObject[key] = obj[key];
        }
    }
    return copiedObject;
}
const getWalletTokenAccount = async (wallet) => {
    (0, assert_1.default)(afx.web3Conn);
    const walletTokenAccount = await afx.web3Conn.getTokenAccountsByOwner(wallet, {
        programId: spl_token_1.TOKEN_PROGRAM_ID,
    });
    return walletTokenAccount.value.map((i) => ({
        pubkey: i.pubkey,
        programId: i.account.owner,
        accountInfo: raydium_sdk_1.SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
};
exports.getWalletTokenAccount = getWalletTokenAccount;
const getWalletTokenBalance = async (wallet, tokenAddress, tokenDecimals = 6) => {
    if (typeof wallet === 'string') {
        wallet = new web3_js_1.PublicKey(wallet);
    }
    const walletTokenAccounts = await (0, exports.getWalletTokenAccount)(wallet);
    let tokenBalance = 0;
    if (walletTokenAccounts && walletTokenAccounts.length > 0) {
        for (const acc of walletTokenAccounts) {
            if (acc.accountInfo.mint.toBase58() === tokenAddress) {
                tokenBalance = Number(acc.accountInfo.amount) / (10 ** tokenDecimals);
                break;
            }
        }
    }
    return tokenBalance;
};
exports.getWalletTokenBalance = getWalletTokenBalance;
const getWalletSOLBalance = async (wallet) => {
    if (typeof wallet === 'string') {
        wallet = new web3_js_1.PublicKey(wallet);
    }
    (0, assert_1.default)(afx.web3Conn);
    try {
        let balance = await afx.web3Conn.getBalance(wallet) / web3_js_1.LAMPORTS_PER_SOL;
        return balance;
    }
    catch (error) {
        console.log(error);
    }
    return null;
};
exports.getWalletSOLBalance = getWalletSOLBalance;
const getConfirmation = async (trx) => {
    (0, assert_1.default)(afx.web3Conn);
    const result = await afx.web3Conn.getSignatureStatus(trx, {
        searchTransactionHistory: true,
    });
    return result.value?.confirmationStatus;
};
exports.getConfirmation = getConfirmation;
const delayForTrxSync = async (signature) => {
    const delayDetector = new delay_detector_1.DelayDetector('delayForTrxSync');
    (0, assert_1.default)(afx.web3Conn);
    let tx = null;
    console.log('delayForTrxSync start');
    while (delayDetector.estimate(false) < 60 * 1000) {
        if (await (0, exports.getConfirmation)(signature) === 'finalized') {
            break;
        }
        await (0, exports.sleep)(500);
    }
    await (0, exports.sleep)(1000);
    console.log('Delayed:', delayDetector.estimate(false));
};
exports.delayForTrxSync = delayForTrxSync;
async function getTokenAddressFromTokenAccount(tokenAccountAddress) {
    const startTime = (new Date()).getTime();
    while (true) {
        try {
            const nowTime = (new Date()).getTime();
            if ((nowTime - startTime) / 1000 > 60) {
                break;
            }
            const tokenAccountPubkey = new web3_js_1.PublicKey(tokenAccountAddress);
            const accountInfo = await afx.web3Conn.getAccountInfo(tokenAccountPubkey);
            if (accountInfo === null) {
                await (0, exports.sleep)(1000);
                continue;
            }
            const accountData = spl_token_1.AccountLayout.decode(accountInfo.data);
            const mintAddress = new web3_js_1.PublicKey(accountData.mint);
            return mintAddress.toBase58();
        }
        catch (error) {
            console.error('Error fetching token address:', error);
            await (0, exports.sleep)(1000);
            continue;
        }
    }
    return null;
}
function uint8ArrayToHexString(bytes) {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}
class DecimalUtil {
    static fromBigInt(input, shift = 0) {
        return new decimal_js_1.default(input.toString()).div(new decimal_js_1.default(10).pow(shift));
    }
    static fromBN(input, shift = 0) {
        return new decimal_js_1.default(input.toString()).div(new decimal_js_1.default(10).pow(shift));
    }
}
exports.DecimalUtil = DecimalUtil;
function bnLayoutFormatter(obj) {
    for (const key in obj) {
        if (obj[key]?.constructor?.name === "PublicKey") {
            obj[key] = obj[key].toBase58();
        }
        else if (obj[key]?.constructor?.name === "BN") {
            obj[key] = Number(obj[key].toString());
        }
        else if (obj[key]?.constructor?.name === "BigInt") {
            obj[key] = Number(obj[key].toString());
        }
        else if (obj[key]?.constructor?.name === "Buffer") {
            obj[key] = obj[key].toString("base64");
        }
        else if ((0, lodash_1.isObject)(obj[key])) {
            bnLayoutFormatter(obj[key]);
        }
        else {
            obj[key] = obj[key];
        }
    }
}
function bytesToInt(bytes) {
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
}
function bufferFromUInt64(value) {
    let buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
}
function bytesToUInt64(bytes) {
    if (bytes.length !== 8) {
        throw new Error("Input array must have exactly 8 bytes.");
    }
    return BigInt(bytes[0]) |
        (BigInt(bytes[1]) << BigInt(8)) |
        (BigInt(bytes[2]) << BigInt(16)) |
        (BigInt(bytes[3]) << BigInt(24)) |
        (BigInt(bytes[4]) << BigInt(32)) |
        (BigInt(bytes[5]) << BigInt(40)) |
        (BigInt(bytes[6]) << BigInt(48)) |
        (BigInt(bytes[7]) << BigInt(56));
}
const getTokenPrice_ = async (addr) => {
    console.log("addr==========", addr);
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    };
    const fetchUrl = "https://public-api.birdeye.so/defi/price?address=" + addr;
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json());
    return responseData.data?.value ?? 0;
};
exports.getTokenPrice_ = getTokenPrice_;
const getTokenMcapRaw = async (swap_data) => {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    };
    const fetchUrl = "https://public-api.birdeye.so/defi/v3/token/market-data?address=" + swap_data.outMint;
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json());
    return responseData.data?.marketcap ?? 0;
};
exports.getTokenMcapRaw = getTokenMcapRaw;
const getTokenMcap = async (swap_data) => {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    };
    const fetchUrl = "https://public-api.birdeye.so/defi/v3/token/market-data?address=" + swap_data.outMint;
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json());
    console.log("responseData====", responseData, responseData.data, swap_data);
    let formattedMcap;
    const marketcap = responseData.data?.market_cap ?? 0;
    if (marketcap > 10 ** 6) {
        formattedMcap = (marketcap / 10 ** 6).toFixed(1) + 'M';
    }
    else if (marketcap > 10 ** 3) {
        formattedMcap = (marketcap / 10 ** 3).toFixed(1) + 'K';
    }
    else {
        formattedMcap = marketcap;
    }
    return formattedMcap;
};
exports.getTokenMcap = getTokenMcap;
const getTokenVolume = async (swap_data) => {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    };
    const fetchUrl = "https://public-api.birdeye.so/defi/v3/token/trade-data/single?address=" + swap_data.outMint;
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json());
    return responseData.data?.volume_30m_usd ?? 0;
};
exports.getTokenVolume = getTokenVolume;
const getTokenScore = async (buyWallets, swap_data) => {
    const tokenMCap = await (0, exports.getTokenMcapRaw)(swap_data);
    const tokenVolume = await (0, exports.getTokenVolume)(swap_data);
    let tokenPnl = 0;
    for (const buywallet of buyWallets) {
        const wallet = config_1.wallets.find((wallet) => wallet.address === buywallet.address);
        const walletTokenPnl = wallet?.pnl ?? 0;
        tokenPnl += walletTokenPnl;
    }
    console.log("tradescore======", tokenMCap, tokenVolume, tokenPnl);
    const tokenScore = tokenMCap / 10 ** 7 * uniconst.MCAP_SCORE + tokenVolume / 10 ** 6 * uniconst.VOLUME_SCORE + tokenPnl / (100 * buyWallets.length) * uniconst.PNL_SCORE;
    let tokenScoreInt = tokenScore * 5;
    if (tokenScoreInt < 1)
        tokenScoreInt = 1;
    if (tokenScoreInt > 10)
        tokenScoreInt = 10;
    return tokenScoreInt.toFixed(0);
};
exports.getTokenScore = getTokenScore;
const getTokenInfo = async (swap_data) => {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
    };
    const fetchUrl = "https://public-api.birdeye.so/defi/token_overview?address=" + swap_data.outMint;
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json());
    return responseData;
};
exports.getTokenInfo = getTokenInfo;
//# sourceMappingURL=utils.js.map