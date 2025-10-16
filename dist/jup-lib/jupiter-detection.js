"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJupiterSwapInfo = getJupiterSwapInfo;
const solana_transaction_parser_1 = require("@shyft-to/solana-transaction-parser");
const transaction_formatter_1 = require("../detection/transaction-formatter");
const constant_1 = require("./constant");
const uniconst_1 = require("../uniconst");
const TXN_FORMATTER = new transaction_formatter_1.TransactionFormatter();
const JUPITER_IX_PARSER = new solana_transaction_parser_1.SolanaParser([]);
const logDebug = (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JUPITER] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};
function analyzeTokenBalances(tx) {
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    const tokenChanges = new Map();
    for (const postBalance of postBalances) {
        const mint = postBalance.mint;
        const postAmount = parseFloat(postBalance.uiTokenAmount.amount) || 0;
        const preBalance = preBalances.find((pre) => pre.accountIndex === postBalance.accountIndex);
        const preAmount = preBalance ? (parseFloat(preBalance.uiTokenAmount.amount) || 0) : 0;
        const netChange = postAmount - preAmount;
        if (!tokenChanges.has(mint)) {
            tokenChanges.set(mint, {
                mint,
                netChange: 0,
                preAmount: 0,
                postAmount: 0
            });
        }
        const existing = tokenChanges.get(mint);
        existing.netChange += netChange;
        existing.preAmount += preAmount;
        existing.postAmount += postAmount;
    }
    for (const preBalance of preBalances) {
        const mint = preBalance.mint;
        const hasPost = postBalances.some((post) => post.accountIndex === preBalance.accountIndex);
        if (!hasPost) {
            const preAmount = parseFloat(preBalance.uiTokenAmount.amount) || 0;
            if (!tokenChanges.has(mint)) {
                tokenChanges.set(mint, {
                    mint,
                    netChange: 0,
                    preAmount: 0,
                    postAmount: 0
                });
            }
            const existing = tokenChanges.get(mint);
            existing.netChange -= preAmount;
            existing.preAmount += preAmount;
        }
    }
    return Array.from(tokenChanges.values());
}
function identifySwapTokens(tokenChanges, nativeSOLChange) {
    logDebug("🔍 Identifying swap tokens...");
    const significantChanges = tokenChanges.filter(tc => Math.abs(tc.netChange) > 1000);
    logDebug("Significant token changes:", significantChanges.map(tc => ({
        mint: tc.mint.substring(0, 8) + "...",
        netChange: tc.netChange,
        direction: tc.netChange > 0 ? "IN" : "OUT"
    })));
    let outputToken = significantChanges
        .filter(tc => tc.netChange > 0)
        .sort((a, b) => b.netChange - a.netChange)[0];
    let inputToken = significantChanges
        .filter(tc => tc.netChange < 0)
        .sort((a, b) => a.netChange - b.netChange)[0];
    let inMint = null;
    let outMint = null;
    let inAmount = 0;
    let outAmount = 0;
    if (inputToken && outputToken && inputToken.mint !== uniconst_1.WSOL_ADDRESS && outputToken.mint !== uniconst_1.WSOL_ADDRESS) {
        logDebug("✅ Case 1: Token → Token swap");
        inMint = inputToken.mint;
        outMint = outputToken.mint;
        inAmount = Math.abs(Math.floor(inputToken.netChange));
        outAmount = Math.floor(outputToken.netChange);
        logDebug("Result:", { inMint: inMint.substring(0, 8) + "...", outMint: outMint.substring(0, 8) + "...", inAmount, outAmount });
        return { inMint, outMint, inAmount, outAmount };
    }
    if (outputToken && outputToken.mint !== uniconst_1.WSOL_ADDRESS) {
        const wrappedSOLChange = tokenChanges.find(tc => tc.mint === uniconst_1.WSOL_ADDRESS)?.netChange || 0;
        if (wrappedSOLChange < -1000000 || nativeSOLChange < -10000000) {
            logDebug("✅ Case 2: SOL → Token swap (BUY)");
            inMint = uniconst_1.WSOL_ADDRESS;
            outMint = outputToken.mint;
            if (wrappedSOLChange < -1000000) {
                inAmount = Math.abs(Math.floor(wrappedSOLChange));
            }
            else {
                inAmount = Math.abs(nativeSOLChange);
            }
            outAmount = Math.floor(outputToken.netChange);
            logDebug("Result:", { inMint: "SOL", outMint: outMint.substring(0, 8) + "...", inAmount, outAmount });
            return { inMint, outMint, inAmount, outAmount };
        }
    }
    if (inputToken && inputToken.mint !== uniconst_1.WSOL_ADDRESS) {
        const wrappedSOLChange = tokenChanges.find(tc => tc.mint === uniconst_1.WSOL_ADDRESS)?.netChange || 0;
        if (wrappedSOLChange > 1000000 || nativeSOLChange > 10000000) {
            logDebug("✅ Case 3: Token → SOL swap (SELL)");
            inMint = inputToken.mint;
            outMint = uniconst_1.WSOL_ADDRESS;
            inAmount = Math.abs(Math.floor(inputToken.netChange));
            if (wrappedSOLChange > 1000000) {
                outAmount = Math.floor(wrappedSOLChange);
            }
            else {
                outAmount = Math.abs(nativeSOLChange);
            }
            logDebug("Result:", { inMint: inMint.substring(0, 8) + "...", outMint: "SOL", inAmount, outAmount });
            return { inMint, outMint, inAmount, outAmount };
        }
    }
    const wrappedSOLChange = tokenChanges.find(tc => tc.mint === uniconst_1.WSOL_ADDRESS)?.netChange || 0;
    if (Math.abs(wrappedSOLChange) > 1000000 && Math.abs(nativeSOLChange) > 10000000) {
        if (wrappedSOLChange < 0 && nativeSOLChange > 0) {
            logDebug("⚠️ Case 4: Detected unwrap operation (not a swap)");
            return { inMint: null, outMint: null, inAmount: 0, outAmount: 0 };
        }
        if (nativeSOLChange < 0 && wrappedSOLChange > 0) {
            logDebug("⚠️ Case 4: Detected wrap operation (not a swap)");
            return { inMint: null, outMint: null, inAmount: 0, outAmount: 0 };
        }
    }
    if (inputToken || outputToken) {
        logDebug("⚠️ Case 5: Fallback detection");
        if (inputToken && !outputToken) {
            inMint = inputToken.mint;
            outMint = uniconst_1.WSOL_ADDRESS;
            inAmount = Math.abs(Math.floor(inputToken.netChange));
            outAmount = Math.abs(nativeSOLChange);
        }
        else if (outputToken && !inputToken) {
            inMint = uniconst_1.WSOL_ADDRESS;
            outMint = outputToken.mint;
            inAmount = Math.abs(nativeSOLChange);
            outAmount = Math.floor(outputToken.netChange);
        }
        else if (inputToken && outputToken) {
            inMint = inputToken.mint;
            outMint = outputToken.mint;
            inAmount = Math.abs(Math.floor(inputToken.netChange));
            outAmount = Math.floor(outputToken.netChange);
        }
        logDebug("Result:", {
            inMint: inMint?.substring(0, 8) + "...",
            outMint: outMint?.substring(0, 8) + "...",
            inAmount,
            outAmount
        });
        return { inMint, outMint, inAmount, outAmount };
    }
    logDebug("❌ Could not identify swap tokens");
    return { inMint: null, outMint: null, inAmount: 0, outAmount: 0 };
}
function validateSwap(swap) {
    logDebug("🔍 Validating swap data...");
    if (!swap.owner) {
        logDebug("❌ Missing owner");
        return false;
    }
    if (!swap.inMint || !swap.outMint) {
        logDebug("❌ Missing mint addresses");
        return false;
    }
    if (swap.inMint === swap.outMint) {
        logDebug("❌ Invalid swap: input and output are the same token", {
            mint: swap.inMint,
            inAmount: swap.inAmount,
            outAmount: swap.outAmount
        });
        return false;
    }
    if (swap.inAmount <= 0 || swap.outAmount <= 0) {
        logDebug("❌ Invalid amounts", {
            inAmount: swap.inAmount,
            outAmount: swap.outAmount
        });
        return false;
    }
    const involvesSol = swap.inMint === uniconst_1.WSOL_ADDRESS || swap.outMint === uniconst_1.WSOL_ADDRESS;
    if (swap.inMint === uniconst_1.WSOL_ADDRESS) {
        logDebug(`✅ Detected BUY: ${(swap.inAmount / 1e9).toFixed(4)} SOL → ${swap.outMint.substring(0, 8)}...`);
    }
    else if (swap.outMint === uniconst_1.WSOL_ADDRESS) {
        logDebug(`✅ Detected SELL: ${swap.inMint.substring(0, 8)}... → ${(swap.outAmount / 1e9).toFixed(4)} SOL`);
    }
    else {
        logDebug(`✅ Detected Token→Token: ${swap.inMint.substring(0, 8)}... → ${swap.outMint.substring(0, 8)}...`);
    }
    logDebug("✅ Swap validation passed");
    return true;
}
async function getJupiterSwapInfo(tx) {
    try {
        logDebug("=== JUPITER DECODE START ===");
        if (!tx.meta || tx.meta?.err) {
            logDebug("❌ Transaction has no meta or has error");
            return null;
        }
        logDebug("✓ Transaction meta valid");
        const parsedIxs = JUPITER_IX_PARSER.parseTransactionWithInnerInstructions(tx);
        logDebug(`✓ Parsed ${parsedIxs.length} instructions`);
        const jupiterIxs = parsedIxs.filter((ix) => ix.programId.equals(constant_1.JUPITER_V6_PROGRAM_ID));
        logDebug(`✓ Found ${jupiterIxs.length} Jupiter instructions`);
        if (jupiterIxs.length === 0) {
            logDebug("❌ No Jupiter instructions found");
            return null;
        }
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        logDebug(`✓ Transaction signature: ${signature}`);
        logDebug(`✓ Account keys: ${accountKeys.length}`);
        const owner = accountKeys[0].toBase58();
        logDebug(`✓ Owner (fee payer): ${owner}`);
        const tokenChanges = analyzeTokenBalances(tx);
        logDebug("Token changes calculated:", tokenChanges.map(tc => ({
            mint: tc.mint.substring(0, 8) + "...",
            netChange: tc.netChange,
            preAmount: tc.preAmount,
            postAmount: tc.postAmount
        })));
        const preSolBalance = tx.meta.preBalances[0] || 0;
        const postSolBalance = tx.meta.postBalances[0] || 0;
        const nativeSOLChange = postSolBalance - preSolBalance;
        logDebug("Native SOL balance change:", {
            pre: preSolBalance,
            post: postSolBalance,
            netChange: nativeSOLChange,
            netChangeInSOL: (nativeSOLChange / 1e9).toFixed(6) + " SOL"
        });
        const { inMint, outMint, inAmount, outAmount } = identifySwapTokens(tokenChanges, nativeSOLChange);
        if (!inMint || !outMint) {
            logDebug("❌ Could not identify swap tokens");
            return null;
        }
        const swap = {
            signature,
            owner,
            type: 'jupiter',
            inMint,
            outMint,
            inAmount,
            outAmount,
        };
        if (!validateSwap(swap)) {
            logDebug("❌ Swap validation failed");
            return null;
        }
        logDebug("✅ JUPITER DECODE SUCCESS", {
            owner: owner.substring(0, 8) + "...",
            inMint: inMint.substring(0, 8) + "...",
            outMint: outMint.substring(0, 8) + "...",
            inAmount: inMint === uniconst_1.WSOL_ADDRESS ? (inAmount / 1e9).toFixed(4) + " SOL" : inAmount,
            outAmount: outMint === uniconst_1.WSOL_ADDRESS ? (outAmount / 1e9).toFixed(4) + " SOL" : outAmount
        });
        logDebug("=== JUPITER DECODE END ===");
        return swap;
    }
    catch (error) {
        logDebug("❌ EXCEPTION in Jupiter decode", error);
        console.error("Jupiter decode error:", error);
        return null;
    }
}
//# sourceMappingURL=jupiter-detection.js.map