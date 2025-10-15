export function transactionOutput(txn: any) {
    try {
        if (!txn || !txn.instructions || txn.instructions.length === 0) {
            console.error('Invalid transaction structure:', txn);
            return null;
        }

        const instruction = txn.instructions[0];
        
        if (!instruction || !instruction.name || !instruction.accounts || !instruction.args) {
            console.error('Invalid instruction structure:', instruction);
            return null;
        }

        const type = instruction.name === "sell" ? "SELL" : "BUY";
        
        // Trova l'account mint con controllo null
        const mintAccount = instruction.accounts.find((item: any) => item?.name === 'mint');
        if (!mintAccount || !mintAccount.pubkey) {
            console.error('Mint account not found or invalid:', instruction.accounts);
            return null;
        }
        const mint = mintAccount.pubkey;
        
        // Trova l'account user con controllo null
        const userAccount = instruction.accounts.find((item: any) => item?.name === 'user');
        if (!userAccount || !userAccount.pubkey) {
            console.error('User account not found or invalid:', instruction.accounts);
            return null;
        }
        const user = userAccount.pubkey;
        
        // Controlla che gli args esistano
        const solAmount = type === "SELL" 
            ? instruction.args.minSolOutput 
            : instruction.args.maxSolCost;
            
        const tokenAmount = instruction.args.amount;
        
        if (solAmount === undefined || tokenAmount === undefined) {
            console.error('Invalid args:', instruction.args);
            return null;
        }
        
        return {
            type,
            mint,
            solAmount,
            tokenAmount,
            user
        };
    } catch (error) {
        console.error('Error in transactionOutput:', error);
        return null;
    }
}
