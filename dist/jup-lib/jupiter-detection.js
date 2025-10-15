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
        jupiterIxs.forEach((ix, index) => {
            logDebug(`Instruction ${index}:`, {
                name: ix.name,
                programId: ix.programId.toBase58(),
                accounts: ix.accounts?.length || 0,
            });
        });
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        logDebug(`✓ Transaction signature: ${signature}`);
        logDebug(`✓ Account keys: ${accountKeys.length}`);
        const owner = accountKeys[0].toBase58();
        logDebug(`✓ Owner (fee payer): ${owner}`);
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];
        logDebug(`✓ Pre token balances: ${preBalances.length}`);
        logDebug(`✓ Post token balances: ${postBalances.length}`);
        let inMint = null;
        let outMint = null;
        let inAmount = 0;
        let outAmount = 0;
        for (const postBalance of postBalances) {
            const preBalance = preBalances.find((pre) => pre.accountIndex === postBalance.accountIndex);
            if (!preBalance) {
                if (postBalance.uiTokenAmount.uiAmount && postBalance.uiTokenAmount.uiAmount > 0) {
                    outMint = postBalance.mint;
                    outAmount = Math.floor(postBalance.uiTokenAmount.amount);
                    logDebug(`✓ Output token found: ${outMint}`, {
                        amount: outAmount,
                        uiAmount: postBalance.uiTokenAmount.uiAmount,
                    });
                }
                continue;
            }
            const preAmount = parseFloat(preBalance.uiTokenAmount.amount);
            const postAmount = parseFloat(postBalance.uiTokenAmount.amount);
            const diff = postAmount - preAmount;
            if (diff < 0) {
                inMint = postBalance.mint;
                inAmount = Math.abs(Math.floor(diff));
                logDebug(`✓ Input token found: ${inMint}`, {
                    amount: inAmount,
                    preAmount: preAmount,
                    postAmount: postAmount,
                });
            }
            else if (diff > 0) {
                outMint = postBalance.mint;
                outAmount = Math.floor(diff);
                logDebug(`✓ Output token found: ${outMint}`, {
                    amount: outAmount,
                    preAmount: preAmount,
                    postAmount: postAmount,
                });
            }
        }
        const preSolBalance = tx.meta.preBalances[0] || 0;
        const postSolBalance = tx.meta.postBalances[0] || 0;
        const solDiff = postSolBalance - preSolBalance;
        logDebug(`SOL balance change:`, {
            pre: preSolBalance,
            post: postSolBalance,
            diff: solDiff,
        });
        if (solDiff < -100000) {
            inMint = uniconst_1.WSOL_ADDRESS;
            inAmount = Math.abs(solDiff);
            logDebug(`✓ SOL is input token: ${inAmount} lamports`);
        }
        else if (solDiff > 100000) {
            outMint = uniconst_1.WSOL_ADDRESS;
            outAmount = solDiff;
            logDebug(`✓ SOL is output token: ${outAmount} lamports`);
        }
        if (!inMint || !outMint) {
            logDebug("❌ Could not determine input/output tokens", {
                inMint,
                outMint,
                inAmount,
                outAmount,
            });
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
        logDebug("✅ JUPITER DECODE SUCCESS", swap);
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