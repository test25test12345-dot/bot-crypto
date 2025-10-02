import { Event, Program, utils } from "@coral-xyz/anchor";
import bs58 from 'bs58'
import { CompiledInstruction, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { Message } from "@solana/web3.js";

export function getEvents(
  program: Program,
  transactionResponse: VersionedTransactionResponse,
  filter: PublicKey
) {
  let events: Event[] = [];

  if (transactionResponse && transactionResponse.meta) {
    let { meta } = transactionResponse;
    const accountKeys = transactionResponse.version === 0 ? transactionResponse.transaction.message.staticAccountKeys : (transactionResponse.transaction.message as Message).accountKeys
    meta.innerInstructions?.map(async (ix) => {
      ix.instructions.map(async (iix: CompiledInstruction) => {
        if (iix.programIdIndex >= accountKeys.length) {
          return
        }
        const programId = accountKeys[iix.programIdIndex]
        if (!programId.equals(filter)) return;
        if (!("data" in iix)) return; // Guard in case it is a parsed decoded instruction
        const ixData = utils.bytes.bs58.decode(iix.data);//iix.data
        const eventData = utils.bytes.base64.encode(ixData.subarray(8));
        const event = program.coder.events.decode(eventData);
        if (!event) return;

        events.push(event);
      });
    });
  }

  return events;
}
