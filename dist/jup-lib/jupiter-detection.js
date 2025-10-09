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
exports.getJupiterSwapInfo = exports.program = void 0;
const utils_1 = require("../utils");
const instruction_parser_1 = require("../jup-lib/instruction-parser");
const jupiter_1 = require("../jup-lib/idl/jupiter");
const constant_1 = require("../jup-lib/constant");
const anchor_1 = require("@coral-xyz/anchor");
const get_events_1 = require("../jup-lib/get-events");
const afx = __importStar(require("../global"));
const spl_token_1 = require("@solana/spl-token");
const decimal_js_1 = __importDefault(require("decimal.js"));
exports.program = new anchor_1.Program(jupiter_1.IDL, constant_1.JUPITER_V6_PROGRAM_ID, {});
const reduceEventData = (events, name) => events.reduce((acc, event) => {
    if (event.name === name) {
        acc.push(event.data);
    }
    return acc;
}, new Array());
async function parseSwapEvents(accountInfosMap, swapEvents) {
    const swapData = await Promise.all(swapEvents.map((swapEvent) => extractSwapData(accountInfosMap, swapEvent)));
    return swapData;
}
async function extractSwapData(accountInfosMap, swapEvent) {
    const amm_key = swapEvent.amm.toBase58();
    const amm = constant_1.AMM_TYPES[amm_key] ??
        `Unknown program ${amm_key}`;
    const { mint: inMint, amount: inAmount, amountInDecimal: inAmountInDecimal, amountInUSD: inAmountInUSD, } = await extractVolume(accountInfosMap, swapEvent.inputMint, swapEvent.inputAmount);
    const { mint: outMint, amount: outAmount, amountInDecimal: outAmountInDecimal, amountInUSD: outAmountInUSD, } = await extractVolume(accountInfosMap, swapEvent.outputMint, swapEvent.outputAmount);
    return {
        amm,
        inMint,
        inAmount,
        inAmountInDecimal,
        inAmountInUSD,
        outMint,
        outAmount,
        outAmountInDecimal,
        outAmountInUSD,
    };
}
async function extractVolume(accountInfosMap, mint, amount) {
    const tokenPriceInUSD = await (0, utils_1.getTokenPriceByUSD)(mint.toBase58());
    let tokenDecimals = 6;
    try {
        tokenDecimals = extractMintDecimals(accountInfosMap, mint);
    }
    catch (error) {
        console.error(error);
    }
    const amountInDecimal = utils_1.DecimalUtil.fromBN(amount, tokenDecimals);
    const amountInUSD = tokenPriceInUSD
        ? amountInDecimal.mul(tokenPriceInUSD)
        : undefined;
    return {
        mint: mint.toBase58(),
        amount: amount.toString(),
        amountInDecimal,
        amountInUSD,
    };
}
function extractTokenAccountOwner(accountInfosMap, account) {
    const accountData = accountInfosMap.get(account.toBase58());
    if (accountData) {
        try {
            const accountInfo = (0, spl_token_1.unpackAccount)(account, accountData, accountData.owner);
            return accountInfo.owner;
        }
        catch (error) {
            console.log("unpack-error", error);
        }
    }
    return;
}
function extractMintDecimals(accountInfosMap, mint) {
    const mintData = accountInfosMap.get(mint.toBase58());
    if (mintData) {
        const mintInfo = (0, spl_token_1.unpackMint)(mint, mintData, mintData.owner);
        return mintInfo.decimals;
    }
    return;
}
const getJupiterSwapInfo = async (tx) => {
    try {
        const programId = constant_1.JUPITER_V6_PROGRAM_ID;
        const accountInfosMap = new Map();
        const parser = new instruction_parser_1.InstructionParser(programId);
        const events = (0, get_events_1.getEvents)(exports.program, tx, constant_1.JUPITER_V6_PROGRAM_ID);
        const swapEvents = reduceEventData(events, "SwapEvent");
        const feeEvent = reduceEventData(events, "FeeEvent")[0];
        if (swapEvents.length === 0) {
            return;
        }
        const accountsToBeFetched = new Array();
        swapEvents.forEach((swapEvent) => {
            accountsToBeFetched.push(swapEvent.inputMint);
            accountsToBeFetched.push(swapEvent.outputMint);
        });
        if (feeEvent) {
            accountsToBeFetched.push(feeEvent.account);
        }
        const accountInfos = await afx.web3Conn.getMultipleAccountsInfo(accountsToBeFetched);
        accountsToBeFetched.forEach((account, index) => {
            const accountInfo = accountInfos[index];
            if (accountInfo) {
                accountInfosMap.set(account.toBase58(), accountInfo);
            }
        });
        const swapData = await parseSwapEvents(accountInfosMap, swapEvents);
        const instructions = parser.getInstructions(tx);
        const intialAndFinalPosition = parser.getInitialAndFinalSwapPositions(instructions);
        if (!intialAndFinalPosition) {
            return null;
        }
        const initialPositions = intialAndFinalPosition[0];
        const finalPositions = intialAndFinalPosition[1];
        const inSymbol = null;
        const inMint = swapData[initialPositions[0]].inMint;
        const inSwapData = swapData.filter((swap, index) => initialPositions.includes(index) && swap.inMint === inMint);
        const inAmount = inSwapData.reduce((acc, curr) => {
            return acc + BigInt(curr.inAmount);
        }, BigInt(0));
        const inAmountInDecimal = inSwapData.reduce((acc, curr) => {
            return acc.add(curr.inAmountInDecimal ?? 0);
        }, new decimal_js_1.default(0));
        const inAmountInUSD = inSwapData.reduce((acc, curr) => {
            return acc.add(curr.inAmountInUSD ?? 0);
        }, new decimal_js_1.default(0));
        const outSymbol = null;
        const outMint = swapData[finalPositions[0]].outMint;
        const outSwapData = swapData.filter((swap, index) => finalPositions.includes(index) && swap.outMint === outMint);
        const outAmount = outSwapData.reduce((acc, curr) => {
            return acc + BigInt(curr.outAmount);
        }, BigInt(0));
        const outAmountInDecimal = outSwapData.reduce((acc, curr) => {
            return acc.add(curr.outAmountInDecimal ?? 0);
        }, new decimal_js_1.default(0));
        const outAmountInUSD = outSwapData.reduce((acc, curr) => {
            return acc.add(curr.outAmountInUSD ?? 0);
        }, new decimal_js_1.default(0));
        const volumeInUSD = outAmountInUSD && inAmountInUSD
            ? decimal_js_1.default.min(outAmountInUSD, inAmountInUSD)
            : outAmountInUSD ?? inAmountInUSD;
        const swap = {};
        const [instructionName, transferAuthority, lastAccount] = parser.getInstructionNameAndTransferAuthorityAndLastAccount(instructions);
        swap.type = 'jupiter';
        swap.transferAuthority = transferAuthority;
        swap.lastAccount = lastAccount;
        swap.instruction = instructionName;
        const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : tx.transaction.message.accountKeys;
        swap.owner = accountKeys[0].toBase58();
        swap.programId = programId.toBase58();
        swap.signature = tx.transaction.signatures[0];
        swap.timestamp = new Date(new Date((tx?.blockTime ?? 0)).toISOString());
        swap.legCount = swapEvents.length;
        swap.volumeInUSD = volumeInUSD.toNumber();
        swap.inSymbol = inSymbol;
        swap.inAmount = inAmount;
        swap.inAmountInDecimal = inAmountInDecimal.toNumber();
        swap.inAmountInUSD = inAmountInUSD.toNumber();
        swap.inMint = inMint;
        swap.outSymbol = outSymbol;
        swap.outAmount = outAmount;
        swap.outAmountInDecimal = outAmountInDecimal.toNumber();
        swap.outAmountInUSD = outAmountInUSD.toNumber();
        swap.outMint = outMint;
        const exactOutAmount = parser.getExactOutAmount(instructions);
        if (exactOutAmount) {
            swap.exactOutAmount = BigInt(exactOutAmount);
            if (outAmountInUSD) {
                swap.exactOutAmountInUSD = new decimal_js_1.default(exactOutAmount)
                    .div(outAmount.toString())
                    .mul(outAmountInUSD)
                    .toNumber();
            }
        }
        const exactInAmount = parser.getExactInAmount(instructions);
        if (exactInAmount) {
            swap.exactInAmount = BigInt(exactInAmount);
            if (inAmountInUSD) {
                swap.exactInAmountInUSD = new decimal_js_1.default(exactInAmount)
                    .div(inAmount.toString())
                    .mul(inAmountInUSD)
                    .toNumber();
            }
        }
        swap.swapData = JSON.parse(JSON.stringify(swapData));
        if (feeEvent) {
            const { mint, amount, amountInDecimal, amountInUSD } = await extractVolume(accountInfosMap, feeEvent.mint, feeEvent.amount);
            swap.feeTokenPubkey = feeEvent.account.toBase58();
            swap.feeOwner = extractTokenAccountOwner(accountInfosMap, feeEvent.account)?.toBase58();
            swap.feeAmount = BigInt(amount ?? 0);
            swap.feeAmountInDecimal = amountInDecimal?.toNumber();
            swap.feeAmountInUSD = amountInUSD?.toNumber();
            swap.feeMint = mint;
        }
        return swap;
    }
    catch (error) {
    }
};
exports.getJupiterSwapInfo = getJupiterSwapInfo;
//# sourceMappingURL=jupiter-detection.js.map