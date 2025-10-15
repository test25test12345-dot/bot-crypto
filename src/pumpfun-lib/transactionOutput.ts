export function transactionOutput(txn: any) {
    try {
        // Log per debugging
        console.log("====== transactionOutput DEBUG ======");
        console.log("Input txn:", JSON.stringify(txn, null, 2));
        
        if (!txn) {
            console.error('ERROR: txn is null or undefined');
            return null;
        }

        if (!txn.instructions) {
            console.error('ERROR: txn.instructions is missing');
            return null;
        }

        if (!Array.isArray(txn.instructions)) {
            console.error('ERROR: txn.instructions is not an array');
            return null;
        }

        if (txn.instructions.length === 0) {
            console.error('ERROR: txn.instructions is empty');
            return null;
        }

        const instruction = txn.instructions[0];
        console.log("Instruction:", JSON.stringify(instruction, null, 2));
        
        if (!instruction) {
            console.error('ERROR: First instruction is null');
            return null;
        }

        if (!instruction.name) {
            console.error('ERROR: Instruction name is missing');
            return null;
        }

        if (!instruction.accounts || !Array.isArray(instruction.accounts)) {
            console.error('ERROR: Instruction accounts is missing or invalid');
            return null;
        }

        if (!instruction.args) {
            console.error('ERROR: Instruction args is missing');
            return null;
        }

        const type = instruction.name === "sell" ? "SELL" : "BUY";
        console.log("Type:", type);
        
        // Cerca il mint account
        const mintAccount = instruction.accounts.find((item: any) => {
            if (!item) return false;
            return item.name === 'mint';
        });
        
        if (!mintAccount) {
            console.error('ERROR: Mint account not found in accounts');
            console.error('Available accounts:', instruction.accounts.map((a: any) => a?.name).join(', '));
            return null;
        }
        
        if (!mintAccount.pubkey) {
            console.error('ERROR: Mint account has no pubkey');
            return null;
        }
        
        const mint = mintAccount.pubkey;
        console.log("Mint:", mint);
        
        // Cerca l'user account
        const userAccount = instruction.accounts.find((item: any) => {
            if (!item) return false;
            return item.name === 'user';
        });
        
        if (!userAccount) {
            console.error('ERROR: User account not found in accounts');
            console.error('Available accounts:', instruction.accounts.map((a: any) => a?.name).join(', '));
            return null;
        }
        
        if (!userAccount.pubkey) {
            console.error('ERROR: User account has no pubkey');
            return null;
        }
        
        const user = userAccount.pubkey;
        console.log("User:", user);
        
        // Estrai gli amount
        let solAmount, tokenAmount;
        
        if (type === "SELL") {
            solAmount = instruction.args.minSolOutput;
            tokenAmount = instruction.args.amount;
        } else {
            solAmount = instruction.args.maxSolCost;
            tokenAmount = instruction.args.amount;
        }
        
        console.log("solAmount:", solAmount);
        console.log("tokenAmount:", tokenAmount);
        
        if (solAmount === undefined || solAmount === null) {
            console.error('ERROR: solAmount is undefined or null');
            console.error('Available args:', Object.keys(instruction.args).join(', '));
            return null;
        }
        
        if (tokenAmount === undefined || tokenAmount === null) {
            console.error('ERROR: tokenAmount is undefined or null');
            console.error('Available args:', Object.keys(instruction.args).join(', '));
            return null;
        }
        
        const result = {
            type,
            mint,
            solAmount,
            tokenAmount,
            user
        };
        
        console.log("Success! Result:", JSON.stringify(result, null, 2));
        console.log("====================================");
        
        return result;
    } catch (error) {
        console.error('EXCEPTION in transactionOutput:', error);
        console.error('Stack trace:', (error as Error).stack);
        return null;
    }
}
