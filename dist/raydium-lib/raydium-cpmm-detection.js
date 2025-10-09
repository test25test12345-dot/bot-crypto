"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeRaydiumCpmmTxn = decodeRaydiumCpmmTxn;
const web3_js_1 = require("@solana/web3.js");
const utils_1 = require("../utils");
const uniconst_1 = require("../uniconst");
const solana_transaction_parser_1 = require("@shyft-to/solana-transaction-parser");
const logs_parser_1 = require("./logs-parser");
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logToFile = (message) => {
    const logFilePath = path_1.default.join("/usr/work/wallettrackalertbotcpmm/", 'logs', 'track.log');
    const logMessage = `${message}\n`;
    fs_1.default.appendFileSync(logFilePath, logMessage, 'utf8');
};
const IX_PARSER = new solana_transaction_parser_1.SolanaParser([]);
const LOGS_PARSER = new logs_parser_1.LogsParser();
const LAYOUT = (0, raydium_sdk_1.struct)([(0, raydium_sdk_1.u8)("type"), (0, raydium_sdk_1.u64)("amount")]);
async function decodeRaydiumCpmmTxn(tx) {
    if (!tx.meta || tx.meta?.err)
        return;
    const parsedIxs = IX_PARSER.parseTransactionWithInnerInstructions(tx);
    const programIxs = parsedIxs.filter((ix) => ix.programId.equals(new web3_js_1.PublicKey('CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C')));
    if (programIxs.length === 0)
        return;
    const LogsEvent = LOGS_PARSER.parse(parsedIxs, tx.meta.logMessages);
    const result = { instructions: parsedIxs, events: LogsEvent };
    (0, utils_1.bnLayoutFormatter)(result);
    let dexInstructions = result.instructions.filter((item) => item.name === 'transferChecked' && (item.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') ||
        item.programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
    let setFrom = false;
    let swap = {};
    const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : tx.transaction.message.accountKeys;
    swap.owner = accountKeys[0].toBase58();
    swap.signature = tx.transaction.signatures[0];
    swap.type = 'raydium cpmm';
    for (let i of dexInstructions) {
        if (i.name === 'transferChecked') {
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
//# sourceMappingURL=raydium-cpmm-detection.js.map