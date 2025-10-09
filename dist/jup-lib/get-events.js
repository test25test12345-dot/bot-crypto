"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvents = getEvents;
const anchor_1 = require("@coral-xyz/anchor");
function getEvents(program, transactionResponse, filter) {
    let events = [];
    if (transactionResponse && transactionResponse.meta) {
        let { meta } = transactionResponse;
        const accountKeys = transactionResponse.version === 0 ? transactionResponse.transaction.message.staticAccountKeys : transactionResponse.transaction.message.accountKeys;
        meta.innerInstructions?.map(async (ix) => {
            ix.instructions.map(async (iix) => {
                if (iix.programIdIndex >= accountKeys.length) {
                    return;
                }
                const programId = accountKeys[iix.programIdIndex];
                if (!programId.equals(filter))
                    return;
                if (!("data" in iix))
                    return;
                const ixData = anchor_1.utils.bytes.bs58.decode(iix.data);
                const eventData = anchor_1.utils.bytes.base64.encode(ixData.subarray(8));
                const event = program.coder.events.decode(eventData);
                if (!event)
                    return;
                events.push(event);
            });
        });
    }
    return events;
}
//# sourceMappingURL=get-events.js.map