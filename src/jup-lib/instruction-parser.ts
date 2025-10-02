import { Message, ParsedInstruction, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { BorshCoder, Program, utils } from "@coral-xyz/anchor";
import { IDL } from "./idl/jupiter";
import { PartialInstruction, RoutePlan, TransactionWithMeta } from "./types";
import bs58 from 'bs58'
import { MessageCompiledInstruction } from "@solana/web3.js";
import { CompiledInstruction } from "@solana/web3.js";

export class InstructionParser {
    private coder: BorshCoder;
    private programId: PublicKey;

    constructor(programId: PublicKey) {
        this.programId = programId;
        this.coder = new BorshCoder(IDL);
    }

    getInstructionNameAndTransferAuthorityAndLastAccount(
        instructions: PartialInstruction[]
    ) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            const data = instruction.accountKeyIndexes ? utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data
            const accounts = instruction.accountKeyIndexes ? instruction.accountKeyIndexes : instruction.accounts
            if (!accounts) {
                continue
            }
            const ix = this.coder.instruction.decode(data, "base58");

            if (ix && this.isRouting(ix.name)) {
                const instructionName = ix.name;
                const transferAuthority =
                    accounts[
                        this.getTransferAuthorityIndex(instructionName)
                    ].toString();
                const lastAccount =
                    accounts[accounts.length - 1].toString();

                return [ix.name, transferAuthority, lastAccount];
            }
        }

        return [];
    }

    getTransferAuthorityIndex(instructionName: string) {
        switch (instructionName) {
            case "route":
            case "exactOutRoute":
            case "routeWithTokenLedger":
                return 1;
            case "sharedAccountsRoute":
            case "sharedAccountsRouteWithTokenLedger":
            case "sharedAccountsExactOutRoute":
                return 2;
            default:
                return 1;
        }
    }

    // For CPI, we have to also check for innerInstructions.
    getInstructions(tx: VersionedTransactionResponse): PartialInstruction[] {
        const parsedInstructions: PartialInstruction[] = [];
        const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : (tx.transaction.message as Message).accountKeys
        const instructions = tx.version === 0 ? tx.transaction.message.compiledInstructions : (tx.transaction.message as Message).instructions
        for (let instruction of instructions) {
            if (instruction.programIdIndex >= accountKeys.length) {
                continue
            }
            const programId = accountKeys[instruction.programIdIndex]
            let extend_instruction = {...instruction, programId}
            if (extend_instruction.programId.equals(this.programId)) {
                parsedInstructions.push(extend_instruction as any);
            }
        }
        if (tx.meta && tx.meta.innerInstructions) {
            for (const instructions of tx.meta.innerInstructions) {
                for (const instruction of instructions.instructions) {
                    if (instruction.programIdIndex >= accountKeys.length) {
                        continue
                    }
                    const programId = accountKeys[instruction.programIdIndex]
                    let extend_instruction = {...instruction, programId}
                    if (extend_instruction.programId.equals(this.programId)) {
                        parsedInstructions.push(extend_instruction as any);
                    }
                }
            }
        }
        return parsedInstructions;
    }

    // Extract the position of the initial and final swap from the swap array.
    getInitialAndFinalSwapPositions(instructions: PartialInstruction[]) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            const data = instruction.accountKeyIndexes ? utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data
            const ix = this.coder.instruction.decode(data, "base58");
            // This will happen because now event is also an CPI instruction.
            if (!ix) {
                continue;
            }

            if (this.isRouting(ix.name)) {
                const routePlan = (ix.data as any).routePlan as RoutePlan;
                const inputIndex = 0;
                const outputIndex = routePlan.length;

                const initialPositions: number[] = [];
                for (let j = 0; j < routePlan.length; j++) {
                    if (routePlan[j].inputIndex === inputIndex) {
                        initialPositions.push(j);
                    }
                }

                const finalPositions: number[] = [];
                for (let j = 0; j < routePlan.length; j++) {
                    if (routePlan[j].outputIndex === outputIndex) {
                        finalPositions.push(j);
                    }
                }

                if (
                    finalPositions.length === 0 &&
                    this.isCircular((ix.data as any).routePlan)
                ) {
                    for (let j = 0; j < (ix.data as any).routePlan.length; j++) {
                        if ((ix.data as any).routePlan[j].outputIndex === 0) {
                            finalPositions.push(j);
                        }
                    }
                }

                return [initialPositions, finalPositions];
            }
        }
    }

    getExactOutAmount(instructions: PartialInstruction[]) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            if (!("data" in instruction)) continue; // Guard in case it is a parsed decoded instruction, should be impossible

            const data = instruction.accountKeyIndexes ? utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data
            const ix = this.coder.instruction.decode(data, "base58");
            
            if (ix && this.isExactIn(ix.name)) {
                return (ix.data as any).quotedOutAmount.toString();
            }
        }

        return;
    }

    getExactInAmount(instructions: PartialInstruction []) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            if (!("data" in instruction)) continue; // Guard in case it is a parsed decoded instruction, should be impossible

            const data = instruction.accountKeyIndexes ? utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data
            const ix = this.coder.instruction.decode(data, "base58");

            if (ix && this.isExactOut(ix.name)) {
                return (ix.data as any).quotedInAmount.toString();
            }
        }

        return;
    }

    isExactIn(name: string) {
        return (
            name === "route" ||
            name === "routeWithTokenLedger" ||
            name === "sharedAccountsRoute" ||
            name === "sharedAccountsRouteWithTokenLedger"
        );
    }

    isExactOut(name: string) {
        return name === "sharedAccountsExactOutRoute" || name === "exactOutRoute";
    }

    isRouting(name: string) {
        return (
            name === "route" ||
            name === "routeWithTokenLedger" ||
            name === "sharedAccountsRoute" ||
            name === "sharedAccountsRouteWithTokenLedger" ||
            name === "sharedAccountsExactOutRoute" ||
            name === "exactOutRoute"
        );
    }

    isCircular(routePlan: RoutePlan) {
        if (!routePlan || routePlan.length === 0) {
            return false; // Empty or null array is not circular
        }

        const indexMap = new Map(
            routePlan.map((obj) => [obj.inputIndex, obj.outputIndex])
        );
        let visited = new Set();
        let currentIndex = routePlan[0].inputIndex; // Start from the first object's inputIndex

        while (true) {
            if (visited.has(currentIndex)) {
                return currentIndex === routePlan[0].inputIndex;
            }

            visited.add(currentIndex);

            if (!indexMap.has(currentIndex)) {
                return false; // No further mapping, not circular
            }
            const newIndex = indexMap.get(currentIndex);
            if ( newIndex !== undefined) {
                currentIndex = newIndex;
            }
        }
    }
}