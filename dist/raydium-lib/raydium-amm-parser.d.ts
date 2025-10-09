import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Idl } from "@project-serum/anchor";
import { ParsedInstruction } from "@shyft-to/solana-transaction-parser";
export declare class RaydiumAmmParser {
    static PROGRAM_ID: PublicKey;
    parseInstruction(instruction: TransactionInstruction): ParsedInstruction<Idl, string>;
    private parseRaydiumInitializeIx;
    private parseRaydiumInitialize2Ix;
    private parseMonitorStepIx;
    private parseDepositIx;
    private parseWithdrawIx;
    private parseMigrateToOpenBookIx;
    private parseSetParamsIx;
    private parseWithdrawPnlIx;
    private parseWithdrawSrmIx;
    private parseSwapBaseInIx;
    private parsePreInitializeIx;
    private parseSwapBaseOutIx;
    private parseSimulateInfoIx;
    private parseAdminCancelOrdersIx;
    private parseCreateConfigAccountIx;
    private parseUpdateConfigAccountIx;
    private parseUnknownInstruction;
}
