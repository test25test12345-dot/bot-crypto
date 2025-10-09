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
exports.derivePoolKeys = derivePoolKeys;
const spl = __importStar(require("@solana/spl-token"));
const web3_js_1 = require("@solana/web3.js");
const structs = __importStar(require("./structs"));
const afx = __importStar(require("../global"));
const assert_1 = __importDefault(require("assert"));
const serum_1 = require("@project-serum/serum");
const uniconst_1 = require("../uniconst");
const openbookProgram = new web3_js_1.PublicKey(uniconst_1.OPENBOOK_PROGRAM_ADDRESS);
async function getMarketInfo(marketId) {
    const connection = afx.web3Conn;
    (0, assert_1.default)(connection);
    let reqs = 0;
    let marketInfo = await connection.getAccountInfo(marketId);
    reqs++;
    while (!marketInfo) {
        marketInfo = await connection.getAccountInfo(marketId);
        reqs++;
        if (marketInfo) {
            break;
        }
        else if (reqs > 20) {
            console.log(`Could not get market info..`);
            return null;
        }
    }
    return marketInfo;
}
async function getDecodedData(marketInfo) {
    return serum_1.Market.getLayout(openbookProgram).decode(marketInfo.data);
}
async function getMintData(mint) {
    const connection = afx.web3Conn;
    (0, assert_1.default)(connection);
    return connection.getAccountInfo(mint);
}
async function getDecimals(mintData) {
    if (!mintData)
        throw new Error('No mint data!');
    return structs.SPL_MINT_LAYOUT.decode(mintData.data).decimals;
}
async function getOwnerAta(mint, publicKey) {
    const foundAta = web3_js_1.PublicKey.findProgramAddressSync([publicKey.toBuffer(), spl.TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], spl.ASSOCIATED_TOKEN_PROGRAM_ID)[0];
    return foundAta;
}
function getVaultSigner(marketId, marketDeco) {
    const seeds = [marketId.toBuffer()];
    const seedsWithNonce = seeds.concat(Buffer.from([Number(marketDeco.vaultSignerNonce.toString())]), Buffer.alloc(7));
    return web3_js_1.PublicKey.createProgramAddressSync(seedsWithNonce, openbookProgram);
}
async function derivePoolKeys(marketId) {
    try {
        const marketInfo = await getMarketInfo(marketId);
        if (!marketInfo)
            return null;
        const marketDeco = await getDecodedData(marketInfo);
        const { baseMint } = marketDeco;
        const baseMintData = await getMintData(baseMint);
        const baseDecimals = await getDecimals(baseMintData);
        const { quoteMint } = marketDeco;
        const quoteMintData = await getMintData(quoteMint);
        const quoteDecimals = await getDecimals(quoteMintData);
        const authority = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])], afx.RayLiqPoolv4)[0];
        const marketAuthority = getVaultSigner(marketId, marketDeco);
        const poolKeys = {
            keg: new web3_js_1.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            version: 4,
            marketVersion: 3,
            programId: afx.RayLiqPoolv4,
            baseMint,
            quoteMint,
            baseDecimals,
            quoteDecimals,
            lpDecimals: baseDecimals,
            authority,
            marketAuthority,
            marketProgramId: openbookProgram,
            marketId,
            marketBids: marketDeco.bids,
            marketAsks: marketDeco.asks,
            marketQuoteVault: marketDeco.quoteVault,
            marketBaseVault: marketDeco.baseVault,
            marketEventQueue: marketDeco.eventQueue,
            id: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('amm_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            baseVault: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('coin_vault_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            coinVault: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('pc_vault_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            lpMint: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('lp_mint_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            lpVault: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('temp_lp_token_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            targetOrders: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('target_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            withdrawQueue: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('withdraw_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            openOrders: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('open_order_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            quoteVault: web3_js_1.PublicKey.findProgramAddressSync([afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('pc_vault_associated_seed', 'utf-8')], afx.RayLiqPoolv4)[0],
            lookupTableAccount: new web3_js_1.PublicKey('11111111111111111111111111111111')
        };
        return poolKeys;
    }
    catch (error) {
        console.log("Get Poolkeys error:", error);
    }
    return null;
}
//# sourceMappingURL=poolKeysReassigned.js.map