import { Idl } from "@project-serum/anchor";
import { LogContext, ParsedInstruction } from "@shyft-to/solana-transaction-parser";
import { LogEvent } from "./logs-parser";
export declare class RaydiumAmmLogsParser {
    parse(action: ParsedInstruction<Idl, string>, log: LogContext): LogEvent | undefined;
}
