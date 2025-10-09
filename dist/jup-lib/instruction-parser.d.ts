import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { PartialInstruction, RoutePlan } from "./types";
export declare class InstructionParser {
    private coder;
    private programId;
    constructor(programId: PublicKey);
    getInstructionNameAndTransferAuthorityAndLastAccount(instructions: PartialInstruction[]): string[];
    getTransferAuthorityIndex(instructionName: string): 2 | 1;
    getInstructions(tx: VersionedTransactionResponse): PartialInstruction[];
    getInitialAndFinalSwapPositions(instructions: PartialInstruction[]): number[][];
    getExactOutAmount(instructions: PartialInstruction[]): any;
    getExactInAmount(instructions: PartialInstruction[]): any;
    isExactIn(name: string): name is "route" | "routeWithTokenLedger" | "sharedAccountsRoute" | "sharedAccountsRouteWithTokenLedger";
    isExactOut(name: string): name is "sharedAccountsExactOutRoute" | "exactOutRoute";
    isRouting(name: string): name is "route" | "routeWithTokenLedger" | "sharedAccountsRoute" | "sharedAccountsRouteWithTokenLedger" | "sharedAccountsExactOutRoute" | "exactOutRoute";
    isCircular(routePlan: RoutePlan): boolean;
}
