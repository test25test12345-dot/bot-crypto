"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeRaydiumTxn = decodeRaydiumTxn;
const global_1 = require("../global");
const utils_1 = require("../utils");
const uniconst_1 = require("../uniconst");
const solana_transaction_parser_1 = require("@shyft-to/solana-transaction-parser");
const logs_parser_1 = require("./logs-parser");
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const IX_PARSER = new solana_transaction_parser_1.SolanaParser([]);
const LOGS_PARSER = new logs_parser_1.LogsParser();
const LAYOUT = (0, raydium_sdk_1.struct)([(0, raydium_sdk_1.u8)("type"), (0, raydium_sdk_1.u64)("amount")]);
async function decodeRaydiumTxn(tx) {
    if (!tx.meta || tx.meta?.err)
        return;
    const parsedIxs = IX_PARSER.parseTransactionWithInnerInstructions(tx);
    const programIxs = parsedIxs.filter((ix) => ix.programId.equals(global_1.RayLiqPoolv4));
    if (programIxs.length === 0)
        return;
    const LogsEvent = LOGS_PARSER.parse(parsedIxs, tx.meta.logMessages);
    const result = { instructions: parsedIxs, events: LogsEvent };
    (0, utils_1.bnLayoutFormatter)(result);
    let dexInstructions = result.instructions.filter((item) => item.name === 'transfer' && item.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    let setFrom = false;
    let swap = {};
    const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : tx.transaction.message.accountKeys;
    swap.owner = accountKeys[0].toBase58();
    swap.signature = tx.transaction.signatures[0];
    swap.type = 'raydium';
    for (let i of dexInstructions) {
        if (i.name === 'transfer') {
            if (!setFrom) {
                const toAccount = i.accounts.find((item) => item.name === 'destination');
                if (toAccount) {
                    let accountIndex = accountKeys.findIndex((item) => item.toString() === toAccount.pubkey.toString());
                    let tokenMintInfo = tx.meta.postTokenBalances.find((item) => item.accountIndex === accountIndex);
                    let fromMint = tokenMintInfo.mint;
                    if (fromMint === null || fromMint === uniconst_1.WSOL_ADDRESS) {
                        swap.inMint = uniconst_1.WSOL_ADDRESS;
                    }
                    else {
                        swap.inMint = fromMint;
                    }
                    swap.inAmount = i.args.amount;
                    setFrom = true;
                }
            }
            else {
                const sourceAccount = i.accounts.find((item) => item.name === 'source');
                if (sourceAccount) {
                    let accountIndex = accountKeys.findIndex((item) => item.toString() === sourceAccount.pubkey.toString());
                    let tokenMintInfo = tx.meta.postTokenBalances.find((item) => item.accountIndex === accountIndex);
                    let toMint = tokenMintInfo.mint;
                    if (toMint === null || toMint === uniconst_1.WSOL_ADDRESS) {
                        swap.outMint = uniconst_1.WSOL_ADDRESS;
                    }
                    else {
                        swap.outMint = toMint;
                    }
                    swap.outAmount = i.args.amount;
                }
            }
        }
    }
    return swap;
}
//# sourceMappingURL=raydium-detection.js.map