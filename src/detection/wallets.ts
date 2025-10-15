import { isValidAddress } from '../utils'
import * as database from '../db'
import { wallets } from './config'

export const getWallets = async() => {
    let realWallets = []
    
    // NON PULIRE IL DATABASE
    // await database.removeAllWallets()
    
    // Prima verifica se ci sono wallet nel database
    const existingWallets: any = await database.selectTrackWallets({});
    console.log(`Database contiene ${existingWallets.length} wallet esistenti`);
    
    for (let wallet of wallets) {
        if (isValidAddress(wallet.address)) {
            realWallets.push(wallet.address)
            const db_wallet = await database.selectTrackWallet({ wallet: wallet.address})
            if (db_wallet) {
                console.log(`✓ Wallet esistente: ${wallet.name} (${wallet.address.substring(0,8)}...)`);
                continue
            }
            console.log(`+ Nuovo wallet aggiunto: ${wallet.name} (${wallet.address.substring(0,8)}...)`);
            await database.updateTrackWallet({ wallet: wallet.address, tokens: [], name: wallet.name })
        }
    }
    
    console.log("================================");
    console.log("WALLET TRACCIATI:", realWallets.length);
    console.log("PRIMI 5 WALLET:", realWallets.slice(0, 5));
    console.log("================================");
    
    // Verifica se il wallet problematico è nella lista
    const problematicWallet = '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
    if (realWallets.includes(problematicWallet)) {
        console.log("⚠️ ATTENZIONE: Il wallet problematico È nella lista!");
    } else {
        console.log("✓ Il wallet problematico NON è nella lista");
    }
    
    return realWallets
}
