import { ParsedInstruction } from "@shyft-to/solana-transaction-parser";
import { Idl } from "@project-serum/anchor";
import { RaydiumAmmLogsParser } from "./raydium-amm-logs-parser";
export type LogEvent = {
    name: string;
    data: any;
};
export declare class LogsParser {
    raydiumAmmLogsParser: RaydiumAmmLogsParser;
    parse(actions: ParsedInstruction<Idl, string>[], logMessages: string[]): LogEvent[];
    isValidIx(actions: ParsedInstruction<Idl, string>[]): boolean;
}
