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
exports.buildBuySwapTrx = exports.getTokenPriceBase = exports.savePoolKeys = exports.getToken2022Price = exports.getTokenPrice = exports.getProgramId = void 0;
const assert_1 = __importDefault(require("assert"));
const dotenv_1 = __importDefault(require("dotenv"));
const uniconst = __importStar(require("../uniconst"));
const afx = __importStar(require("../global"));
const utils = __importStar(require("../utils"));
dotenv_1.default.config();
const web3_js_1 = require("@solana/web3.js");
const spl_token_registry_1 = require("@solana/spl-token-registry");
const spl_token_1 = require("@solana/spl-token");
const database = __importStar(require("../db"));
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const poolKeysReassigned_1 = require("../poolkeys/poolKeysReassigned");
const graph_1 = require("../graphQL/graph");
const getProgramId = () => {
    if (spl_token_registry_1.ENV.MainnetBeta === afx.get_net_mode()) {
        return raydium_sdk_1.MAINNET_PROGRAM_ID;
    }
    else {
        return raydium_sdk_1.DEVNET_PROGRAM_ID;
    }
};
exports.getProgramId = getProgramId;
const getAddLookupTableInfo = () => {
    if (spl_token_registry_1.ENV.MainnetBeta === afx.get_net_mode()) {
        return raydium_sdk_1.LOOKUP_TABLE_CACHE;
    }
    else {
        return undefined;
    }
};
const getTokenPrice = async (tokenAddress) => {
    return await (0, exports.getTokenPriceBase)(tokenAddress, uniconst.WSOL_ADDRESS, spl_token_1.TOKEN_PROGRAM_ID);
};
exports.getTokenPrice = getTokenPrice;
const getToken2022Price = async (tokenAddress) => {
    return await (0, exports.getTokenPriceBase)(tokenAddress, uniconst.WSOL2022_ADDRESS, spl_token_1.TOKEN_2022_PROGRAM_ID);
};
exports.getToken2022Price = getToken2022Price;
const savePoolKeys = async (tokenAddress, marketId, reverse) => {
    let poolKeys = await (0, poolKeysReassigned_1.derivePoolKeys)(new web3_js_1.PublicKey(marketId));
    database.updatePoolkeys(tokenAddress, poolKeys, reverse);
};
exports.savePoolKeys = savePoolKeys;
const getTokenPriceBase = async (tokenAddress, nativeTokenAddress, tokenProgramId) => {
    const connection = afx.web3Conn;
    (0, assert_1.default)(connection);
    try {
        let reverse = 0;
        let poolKeys = null;
        let lpData = null;
        await new Promise(async (resolve, reject) => {
            let failureLeft = 2;
            (0, graph_1.queryLpMintInfo)(tokenAddress, nativeTokenAddress).then((ret) => {
                if (lpData) {
                    return null;
                }
                if (!ret || ret.Raydium_LiquidityPoolv4.length === 0) {
                    if (--failureLeft <= 0) {
                        resolve(null);
                    }
                    return null;
                }
                reverse = 0;
                lpData = ret.Raydium_LiquidityPoolv4[0];
                resolve(ret);
            }).catch(error => {
                if (--failureLeft <= 0) {
                    resolve(null);
                }
                return null;
            });
            (0, graph_1.queryLpMintInfo)(nativeTokenAddress, tokenAddress).then((ret) => {
                if (lpData) {
                    return null;
                }
                if (!ret || ret.Raydium_LiquidityPoolv4.length === 0) {
                    if (--failureLeft <= 0) {
                        resolve(null);
                    }
                    return null;
                }
                reverse = 1;
                lpData = ret.Raydium_LiquidityPoolv4[0];
                resolve(ret);
            }).catch(error => {
                if (--failureLeft <= 0) {
                    resolve(null);
                }
                return null;
            });
        });
        if (lpData) {
            (0, exports.savePoolKeys)(tokenAddress, lpData.marketId, reverse);
            const solVault = new web3_js_1.PublicKey(reverse ? lpData.baseVault : lpData.quoteVault);
            const tokenVault = new web3_js_1.PublicKey(reverse ? lpData.quoteVault : lpData.baseVault);
            let sol_check = await connection.getTokenAccountBalance(solVault);
            let token_check = await connection.getTokenAccountBalance(tokenVault);
            let price = sol_check.value.uiAmount / token_check.value.uiAmount;
            let liquidity = sol_check.value.uiAmount * 2;
            return { price: price, liquidity: liquidity };
        }
    }
    catch (error) {
        console.error(error);
    }
    return null;
};
exports.getTokenPriceBase = getTokenPriceBase;
const makeTxVersion = raydium_sdk_1.TxVersion.V0;
const buildBuySwapTrx = async (session, tokenAddress, nativeTokenAddress, tokenProgramId, buyAmount, wallet, tokenMetaInfo, callback) => {
    const connection = afx.web3Conn;
    (0, assert_1.default)(connection);
    try {
        const mint = new web3_js_1.PublicKey(tokenAddress);
        const mintInfo = await (0, spl_token_1.getMint)(connection, mint);
        let baseToken = new raydium_sdk_1.Token(tokenProgramId, new web3_js_1.PublicKey(tokenAddress), mintInfo.decimals);
        let quoteToken = new raydium_sdk_1.Token(tokenProgramId, new web3_js_1.PublicKey(nativeTokenAddress), uniconst.WSOL_DECIMALS);
        const slippage = new raydium_sdk_1.Percent(Math.floor(session.buySlippage * (10 ** 2)), 10000);
        const inputSolRawAmount = new raydium_sdk_1.TokenAmount(quoteToken, buyAmount, false);
        let poolKeys = null;
        const poolkeys_db = await database.selectPoolkeys(tokenAddress);
        if (poolkeys_db) {
            poolKeys = poolkeys_db.poolkeys;
        }
        else {
            return null;
        }
        if (poolKeys) {
            const { minAmountOut, amountOut, currentPrice } = raydium_sdk_1.Liquidity.computeAmountOut({
                poolKeys: poolKeys,
                poolInfo: await raydium_sdk_1.Liquidity.fetchInfo({ connection, poolKeys }),
                amountIn: inputSolRawAmount,
                currencyOut: baseToken,
                slippage: slippage,
            });
            const walletTokenAccounts = await utils.getWalletTokenAccount(wallet.publicKey);
            const { innerTransactions } = await raydium_sdk_1.Liquidity.makeSwapInstructionSimple({
                connection,
                poolKeys,
                userKeys: {
                    tokenAccounts: walletTokenAccounts,
                    owner: wallet.publicKey,
                },
                amountIn: inputSolRawAmount,
                amountOut: minAmountOut,
                fixedSide: 'in',
                makeTxVersion,
            });
            const transactions = await (0, raydium_sdk_1.buildSimpleTransaction)({
                connection: connection,
                makeTxVersion: makeTxVersion,
                payer: wallet.publicKey,
                innerTransactions: innerTransactions,
                addLookupTableInfo: getAddLookupTableInfo(),
            });
            const tokenPrice = Number(currentPrice.invert().toSignificant());
            const outAmount = Number(amountOut.toSignificant());
            callback({
                success: 'true',
                data: {
                    price: tokenPrice,
                    solAmount: buyAmount,
                    amount: outAmount,
                    name: tokenMetaInfo.name,
                    decimals: baseToken.decimals,
                    mode: 'buy',
                    address: tokenAddress,
                    trxId: ''
                }
            });
            return transactions[0];
        }
    }
    catch (error) {
        console.error('[Radyum buyToken]', error);
    }
    return null;
};
exports.buildBuySwapTrx = buildBuySwapTrx;
//# sourceMappingURL=raydium_api.js.map