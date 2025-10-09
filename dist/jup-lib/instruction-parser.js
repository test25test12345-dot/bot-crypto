"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstructionParser = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const jupiter_1 = require("./idl/jupiter");
class InstructionParser {
    coder;
    programId;
    constructor(programId) {
        this.programId = programId;
        this.coder = new anchor_1.BorshCoder(jupiter_1.IDL);
    }
    getInstructionNameAndTransferAuthorityAndLastAccount(instructions) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            const data = instruction.accountKeyIndexes ? anchor_1.utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data;
            const accounts = instruction.accountKeyIndexes ? instruction.accountKeyIndexes : instruction.accounts;
            if (!accounts) {
                continue;
            }
            const ix = this.coder.instruction.decode(data, "base58");
            if (ix && this.isRouting(ix.name)) {
                const instructionName = ix.name;
                const transferAuthority = accounts[this.getTransferAuthorityIndex(instructionName)].toString();
                const lastAccount = accounts[accounts.length - 1].toString();
                return [ix.name, transferAuthority, lastAccount];
            }
        }
        return [];
    }
    getTransferAuthorityIndex(instructionName) {
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
    getInstructions(tx) {
        const parsedInstructions = [];
        const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : tx.transaction.message.accountKeys;
        const instructions = tx.version === 0 ? tx.transaction.message.compiledInstructions : tx.transaction.message.instructions;
        for (let instruction of instructions) {
            if (instruction.programIdIndex >= accountKeys.length) {
                continue;
            }
            const programId = accountKeys[instruction.programIdIndex];
            let extend_instruction = { ...instruction, programId };
            if (extend_instruction.programId.equals(this.programId)) {
                parsedInstructions.push(extend_instruction);
            }
        }
        if (tx.meta && tx.meta.innerInstructions) {
            for (const instructions of tx.meta.innerInstructions) {
                for (const instruction of instructions.instructions) {
                    if (instruction.programIdIndex >= accountKeys.length) {
                        continue;
                    }
                    const programId = accountKeys[instruction.programIdIndex];
                    let extend_instruction = { ...instruction, programId };
                    if (extend_instruction.programId.equals(this.programId)) {
                        parsedInstructions.push(extend_instruction);
                    }
                }
            }
        }
        return parsedInstructions;
    }
    getInitialAndFinalSwapPositions(instructions) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            const data = instruction.accountKeyIndexes ? anchor_1.utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data;
            const ix = this.coder.instruction.decode(data, "base58");
            if (!ix) {
                continue;
            }
            if (this.isRouting(ix.name)) {
                const routePlan = ix.data.routePlan;
                const inputIndex = 0;
                const outputIndex = routePlan.length;
                const initialPositions = [];
                for (let j = 0; j < routePlan.length; j++) {
                    if (routePlan[j].inputIndex === inputIndex) {
                        initialPositions.push(j);
                    }
                }
                const finalPositions = [];
                for (let j = 0; j < routePlan.length; j++) {
                    if (routePlan[j].outputIndex === outputIndex) {
                        finalPositions.push(j);
                    }
                }
                if (finalPositions.length === 0 &&
                    this.isCircular(ix.data.routePlan)) {
                    for (let j = 0; j < ix.data.routePlan.length; j++) {
                        if (ix.data.routePlan[j].outputIndex === 0) {
                            finalPositions.push(j);
                        }
                    }
                }
                return [initialPositions, finalPositions];
            }
        }
    }
    getExactOutAmount(instructions) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            if (!("data" in instruction))
                continue;
            const data = instruction.accountKeyIndexes ? anchor_1.utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data;
            const ix = this.coder.instruction.decode(data, "base58");
            if (ix && this.isExactIn(ix.name)) {
                return ix.data.quotedOutAmount.toString();
            }
        }
        return;
    }
    getExactInAmount(instructions) {
        for (const instruction of instructions) {
            if (!instruction.programId.equals(this.programId)) {
                continue;
            }
            if (!("data" in instruction))
                continue;
            const data = instruction.accountKeyIndexes ? anchor_1.utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")) : instruction.data;
            const ix = this.coder.instruction.decode(data, "base58");
            if (ix && this.isExactOut(ix.name)) {
                return ix.data.quotedInAmount.toString();
            }
        }
        return;
    }
    isExactIn(name) {
        return (name === "route" ||
            name === "routeWithTokenLedger" ||
            name === "sharedAccountsRoute" ||
            name === "sharedAccountsRouteWithTokenLedger");
    }
    isExactOut(name) {
        return name === "sharedAccountsExactOutRoute" || name === "exactOutRoute";
    }
    isRouting(name) {
        return (name === "route" ||
            name === "routeWithTokenLedger" ||
            name === "sharedAccountsRoute" ||
            name === "sharedAccountsRouteWithTokenLedger" ||
            name === "sharedAccountsExactOutRoute" ||
            name === "exactOutRoute");
    }
    isCircular(routePlan) {
        if (!routePlan || routePlan.length === 0) {
            return false;
        }
        const indexMap = new Map(routePlan.map((obj) => [obj.inputIndex, obj.outputIndex]));
        let visited = new Set();
        let currentIndex = routePlan[0].inputIndex;
        while (true) {
            if (visited.has(currentIndex)) {
                return currentIndex === routePlan[0].inputIndex;
            }
            visited.add(currentIndex);
            if (!indexMap.has(currentIndex)) {
                return false;
            }
            const newIndex = indexMap.get(currentIndex);
            if (newIndex !== undefined) {
                currentIndex = newIndex;
            }
        }
    }
}
exports.InstructionParser = InstructionParser;
//# sourceMappingURL=instruction-parser.js.map