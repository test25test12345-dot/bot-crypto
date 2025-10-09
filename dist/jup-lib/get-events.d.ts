import { Event, Program } from "@coral-xyz/anchor";
import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
export declare function getEvents(program: Program, transactionResponse: VersionedTransactionResponse, filter: PublicKey): Event[];
