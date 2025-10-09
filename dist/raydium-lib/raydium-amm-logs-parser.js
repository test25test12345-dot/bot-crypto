"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaydiumAmmLogsParser = void 0;
const buffer_layout_1 = require("@solana/buffer-layout");
const buffer_layout_utils_1 = require("@solana/buffer-layout-utils");
const LOG_TO_INSTRUCTION_MAP = {
    Init: "initialize",
    Init2: "initialize2",
    Deposit: "deposit",
    Withdraw: "withdraw",
    SwapBaseIn: "swapBaseIn",
    SwapBaseOut: "SwapBaseOut",
};
const InitLogLayout = (0, buffer_layout_1.struct)([
    (0, buffer_layout_1.u8)("logType"),
    (0, buffer_layout_utils_1.u64)("time"),
    (0, buffer_layout_1.u8)("pcDecimals"),
    (0, buffer_layout_1.u8)("coinDecimals"),
    (0, buffer_layout_utils_1.u64)("pcLotSize"),
    (0, buffer_layout_utils_1.u64)("coinLotSize"),
    (0, buffer_layout_utils_1.u64)("pcAmount"),
    (0, buffer_layout_utils_1.u64)("coinAmount"),
    (0, buffer_layout_utils_1.publicKey)("market"),
]);
const DepositLogLayout = (0, buffer_layout_1.struct)([
    (0, buffer_layout_1.u8)("logType"),
    (0, buffer_layout_utils_1.u64)("maxCoin"),
    (0, buffer_layout_utils_1.u64)("maxPc"),
    (0, buffer_layout_utils_1.u64)("base"),
    (0, buffer_layout_utils_1.u64)("poolCoin"),
    (0, buffer_layout_utils_1.u64)("poolPc"),
    (0, buffer_layout_utils_1.u64)("pcAmount"),
    (0, buffer_layout_utils_1.u64)("poolLp"),
    (0, buffer_layout_utils_1.u128)("calcPnlX"),
    (0, buffer_layout_utils_1.u128)("calcPnlY"),
    (0, buffer_layout_utils_1.u64)("deductCoin"),
    (0, buffer_layout_utils_1.u64)("deductPc"),
    (0, buffer_layout_utils_1.u64)("mintLp"),
]);
const WithdrawLogLayout = (0, buffer_layout_1.struct)([
    (0, buffer_layout_1.u8)("logType"),
    (0, buffer_layout_utils_1.u64)("withdrawLp"),
    (0, buffer_layout_utils_1.u64)("userLp"),
    (0, buffer_layout_utils_1.u64)("poolCoin"),
    (0, buffer_layout_utils_1.u64)("poolPc"),
    (0, buffer_layout_utils_1.u64)("poolLp"),
    (0, buffer_layout_utils_1.u128)("calcPnlX"),
    (0, buffer_layout_utils_1.u128)("calcPnlY"),
    (0, buffer_layout_utils_1.u64)("outCoin"),
    (0, buffer_layout_utils_1.u64)("outPc"),
]);
const SwapBaseInLogLayout = (0, buffer_layout_1.struct)([
    (0, buffer_layout_1.u8)("logType"),
    (0, buffer_layout_utils_1.u64)("amountIn"),
    (0, buffer_layout_utils_1.u64)("minimumOut"),
    (0, buffer_layout_utils_1.u64)("direction"),
    (0, buffer_layout_utils_1.u64)("userSource"),
    (0, buffer_layout_utils_1.u64)("poolCoin"),
    (0, buffer_layout_utils_1.u64)("poolPc"),
    (0, buffer_layout_utils_1.u64)("outAmount"),
]);
const SwapBaseOutLogLayout = (0, buffer_layout_1.struct)([
    (0, buffer_layout_1.u8)("logType"),
    (0, buffer_layout_utils_1.u64)("maxIn"),
    (0, buffer_layout_utils_1.u64)("amountOut"),
    (0, buffer_layout_utils_1.u64)("direction"),
    (0, buffer_layout_utils_1.u64)("userSource"),
    (0, buffer_layout_utils_1.u64)("poolCoin"),
    (0, buffer_layout_utils_1.u64)("poolPc"),
    (0, buffer_layout_utils_1.u64)("directIn"),
]);
class RaydiumAmmLogsParser {
    parse(action, log) {
        if (!log) {
            return;
        }
        const instructionLog = log.logMessages[0]?.split(" ").at(-1);
        const instruction = LOG_TO_INSTRUCTION_MAP[instructionLog];
        if (instruction) {
            action.name = instruction;
        }
        let event;
        switch (action.name) {
            case "initialize":
            case "initialize2":
            case "deposit":
            case "withdraw":
            case "swapBaseIn":
            case "swapBaseOut": {
                try {
                    const rayLog = log.logMessages.at(-1);
                    const base64Log = rayLog.replace("ray_log: ", "");
                    const raydiumEventData = Buffer.from(base64Log, "base64");
                    const discriminator = (0, buffer_layout_1.u8)().decode(raydiumEventData);
                    switch (discriminator) {
                        case 0: {
                            const logData = InitLogLayout.decode(raydiumEventData);
                            event = { name: "init", data: logData };
                            break;
                        }
                        case 1: {
                            const logData = DepositLogLayout.decode(raydiumEventData);
                            event = { name: "deposit", data: logData };
                            break;
                        }
                        case 2: {
                            const logData = WithdrawLogLayout.decode(raydiumEventData);
                            event = { name: "withdraw", data: logData };
                            break;
                        }
                        case 3: {
                            const logData = SwapBaseInLogLayout.decode(raydiumEventData);
                            event = { name: "swapBaseIn", data: logData };
                            break;
                        }
                        case 4: {
                            const logData = SwapBaseOutLogLayout.decode(raydiumEventData);
                            event = { name: "swapBaseOut", data: logData };
                            break;
                        }
                    }
                    return event;
                }
                catch (error) {
                    console.error({
                        message: "raydiumAmmlogParsingErr",
                        error,
                    });
                    return;
                }
            }
            default:
                return;
        }
    }
}
exports.RaydiumAmmLogsParser = RaydiumAmmLogsParser;
//# sourceMappingURL=raydium-amm-logs-parser.js.map