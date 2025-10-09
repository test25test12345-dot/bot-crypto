"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogsParser = void 0;
const solana_transaction_parser_1 = require("@shyft-to/solana-transaction-parser");
const raydium_amm_parser_1 = require("./raydium-amm-parser");
const raydium_amm_logs_parser_1 = require("./raydium-amm-logs-parser");
const RAYDIUM_AMM_PROGRAM_ID = raydium_amm_parser_1.RaydiumAmmParser.PROGRAM_ID.toBase58();
class LogsParser {
    raydiumAmmLogsParser = new raydium_amm_logs_parser_1.RaydiumAmmLogsParser();
    parse(actions, logMessages) {
        if (!this.isValidIx(actions)) {
            return [];
        }
        const logs = (0, solana_transaction_parser_1.parseLogs)(logMessages);
        return actions
            .map((action, index) => {
            if ("info" in action) {
                return;
            }
            else {
                const programId = action.programId.toBase58();
                switch (programId) {
                    case RAYDIUM_AMM_PROGRAM_ID: {
                        return this.raydiumAmmLogsParser.parse(action, logs[index]);
                    }
                    default:
                        return;
                }
            }
        })
            .filter((log) => Boolean(log));
    }
    isValidIx(actions) {
        return actions.some((action) => action.programId.toBase58() === RAYDIUM_AMM_PROGRAM_ID);
    }
}
exports.LogsParser = LogsParser;
//# sourceMappingURL=logs-parser.js.map