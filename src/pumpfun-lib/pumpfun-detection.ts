import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { TransactionFormatter } from "../detection/transaction-formatter";
import pumpFunIdl from "./idl/pump_0.1.0.json";
import { Idl } from "@project-serum/anchor";
import { SolanaEventParser } from "./event-parser";
import { bnLayoutFormatter } from "../utils";
import { transactionOutput } from "./transactionOutput";
import { WSOL_ADDRESS } from "../uniconst";

const TXN_FORMATTER = new TransactionFormatter();

export const PUMP_FUN_PROGRAM_ID = new PublicKey(
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);

const PUMP_FUN_IX_PARSER = new SolanaParser([]);
PUMP_FUN_IX_PARSER.addParserFromIdl(
    PUMP_FUN_PROGRAM_ID.toBase58(),
    pumpFunIdl as Idl,
);

const PUMP_FUN_EVENT_PARSER = new SolanaEventParser([], console);
PUMP_FUN_EVENT_PARSER.addParserFromIdl(
    PUMP_FUN_PROGRAM_ID.toBase58(),
    pumpFunIdl as Idl,
);

export async function decodePumpfunTxn(tx: VersionedTransactionResponse) {
    if (!tx.meta || tx.meta?.err) return;
    
    const paredIxs = PUMP_FUN_IX_PARSER.parseTransactionWithInnerInstructions(tx);
    const pumpFunIxs = paredIxs.filter((ix) =>
        ix.programId.equals(PUMP_FUN_PROGRAM_ID),
    );
    
    if (pumpFunIxs.length === 0) return;
    
    const events = PUMP_FUN_EVENT_PARSER.parseEvent(tx);
    const parsedTxn = { instructions: pumpFunIxs, events };
    
    bnLayoutFormatter(parsedTxn);
    
    if (!parsedTxn) return;
    
    const tOutput = transactionOutput(parsedTxn);
    
    let swap: any = {}
    swap.signature = tx.transaction.signatures[0];
    swap.owner = tOutput.user;
    swap.type = 'pump_fun';
    
    if (tOutput.type === 'BUY') {
        swap.inMint = WSOL_ADDRESS;
        swap.outMint = tOutput.mint;
        swap.inAmount = tOutput.solAmount;
        swap.outAmount = tOutput.tokenAmount;
    } else {
        swap.inMint = tOutput.mint;
        swap.outMint = WSOL_ADDRESS;
        swap.inAmount = tOutput.tokenAmount;
        swap.outAmount = tOutput.solAmount;
    }
    
    return swap;
}
