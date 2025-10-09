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
exports.buildSwapTrx = exports.getSwapInfo = exports.getTokenPriceByUSD = exports.getTokenPrice = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const utils = __importStar(require("../utils"));
const uniconst = __importStar(require("../uniconst"));
dotenv_1.default.config();
const web3_js_1 = require("@solana/web3.js");
const decimal_js_1 = __importDefault(require("decimal.js"));
const getTokenPrice = async (tokenAddress) => {
    try {
        const url = `https://price.jup.ag/v4/price?ids=${tokenAddress}&vsToken=${uniconst.WSOL_ADDRESS}`;
        const resp = await utils.fetchAPI(url, 'GET');
        if (resp && resp.data && resp.data[tokenAddress]) {
            return resp.data[tokenAddress].price;
        }
    }
    catch (error) {
    }
    return null;
};
exports.getTokenPrice = getTokenPrice;
const jupiterPrices = new Map();
const jupiterTTL = new Map();
const getTokenPriceByUSD = async (tokenAddress) => {
    try {
        let price = jupiterPrices.get(tokenAddress);
        let ttl = jupiterTTL.get(tokenAddress);
        if (price && ttl && new Date().getTime() - ttl < 2 * 1000) {
            return new decimal_js_1.default(price);
        }
        const url = `https://price.jup.ag/v4/price?ids=${tokenAddress}&vsToken=${uniconst.USDC_ADDRESS}`;
        const resp = await utils.fetchAPI(url, 'GET');
        if (resp && resp.data && resp.data[tokenAddress]) {
            jupiterPrices.set(tokenAddress, price);
            jupiterTTL.set(tokenAddress, new Date().getTime());
            return new decimal_js_1.default(resp.data[tokenAddress].price);
        }
    }
    catch (error) {
        console.log(`coin not found: ${tokenAddress}`);
    }
    return null;
};
exports.getTokenPriceByUSD = getTokenPriceByUSD;
const getSwapInfo = async (tokenFrom, tokenTo, amount, decimal, slippage) => {
    try {
        amount = Math.floor(amount * (10 ** decimal));
        slippage = Math.floor(slippage * (10 ** 2));
        const url = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenFrom}&outputMint=${tokenTo}&amount=${amount}&slippageBps=${slippage}`;
        const resp = await utils.fetchAPI(url, 'GET');
        return resp;
    }
    catch (error) {
    }
    return null;
};
exports.getSwapInfo = getSwapInfo;
const buildSwapTrx = async (session, wallet, swapInfoResp) => {
    try {
        console.log('buildSwapTrx', session.trxPriorityAmount);
        let resp = await utils.fetchAPI('https://quote-api.jup.ag/v6/swap', 'POST', {
            quoteResponse: swapInfoResp,
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
        });
        if (!resp) {
            return null;
        }
        const { swapTransaction } = resp;
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = web3_js_1.VersionedTransaction.deserialize(swapTransactionBuf);
        return transaction;
    }
    catch (error) {
        console.error("buildBuySwapTrx: ", error);
    }
    return null;
};
exports.buildSwapTrx = buildSwapTrx;
//# sourceMappingURL=jupiter_api.js.map