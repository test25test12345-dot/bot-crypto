"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUMP_FUN_PROGRAM_ID = void 0;
exports.decodePumpfunTxn = decodePumpfunTxn;
const solana_transaction_parser_1 = require("@shyft-to/solana-transaction-parser");
const web3_js_1 = require("@solana/web3.js");
const transaction_formatter_1 = require("../detection/transaction-formatter");
const pump_0_1_0_json_1 = __importDefault(require("./idl/pump_0.1.0.json"));
const event_parser_1 = require("./event-parser");
const utils_1 = require("../utils");
const transactionOutput_1 = require("./transactionOutput");
const uniconst_1 = require("../uniconst");
const TXN_FORMATTER = new transaction_formatter_1.TransactionFormatter();
exports.PUMP_FUN_PROGRAM_ID = new web3_js_1.PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_FUN_IX_PARSER = new solana_transaction_parser_1.SolanaParser([]);
PUMP_FUN_IX_PARSER.addParserFromIdl(exports.PUMP_FUN_PROGRAM_ID.toBase58(), pump_0_1_0_json_1.default);
const PUMP_FUN_EVENT_PARSER = new event_parser_1.SolanaEventParser([], console);
PUMP_FUN_EVENT_PARSER.addParserFromIdl(exports.PUMP_FUN_PROGRAM_ID.toBase58(), pump_0_1_0_json_1.default);
async function decodePumpfunTxn(tx) {
    try {
        if (!tx.meta || tx.meta?.err) {
            return null;
        }
        const paredIxs = PUMP_FUN_IX_PARSER.parseTransactionWithInnerInstructions(tx);
        const pumpFunIxs = paredIxs.filter((ix) => ix.programId.equals(exports.PUMP_FUN_PROGRAM_ID));
        if (pumpFunIxs.length === 0) {
            return null;
        }
        const events = PUMP_FUN_EVENT_PARSER.parseEvent(tx);
        const parsedTxn = { instructions: pumpFunIxs, events };
        (0, utils_1.bnLayoutFormatter)(parsedTxn);
        if (!parsedTxn) {
            return null;
        }
        const tOutput = (0, transactionOutput_1.transactionOutput)(parsedTxn);
        if (!tOutput || !tOutput.mint || !tOutput.user) {
            console.error('Failed to parse Pumpfun transaction output');
            return null;
        }
        let swap = {};
        swap.signature = tx.transaction.signatures[0];
        swap.owner = tOutput.user;
        swap.type = 'pump_fun';
        if (tOutput.type === 'BUY') {
            swap.inMint = uniconst_1.WSOL_ADDRESS;
            swap.outMint = tOutput.mint;
            swap.inAmount = tOutput.solAmount;
            swap.outAmount = tOutput.tokenAmount;
        }
        else {
            swap.inMint = tOutput.mint;
            swap.outMint = uniconst_1.WSOL_ADDRESS;
            swap.inAmount = tOutput.tokenAmount;
            swap.outAmount = tOutput.solAmount;
        }
        return swap;
    }
    catch (error) {
        console.error('Error decoding Pumpfun transaction:', error);
        return null;
    }
}
//# sourceMappingURL=pumpfun-detection.js.map