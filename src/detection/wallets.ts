import { isValidAddress } from '../utils'
import * as database from '../db'
import { wallets } from './config'

export const getWallets = async() => {
    let realWallets = []
    
    // DECOMMENTA QUESTA RIGA PER PULIRE TUTTO
     await database.removeAllWallets()  // <-- TOGLI IL COMMENTO
    
    for (let wallet of wallets) {
        if (isValidAddress(wallet.address)) {
            realWallets.push(wallet.address)
            const db_wallet = await database.selectTrackWallet({ wallet: wallet.address})
            if (db_wallet) {
                continue
            }
            await database.updateTrackWallet({ wallet: wallet.address, tokens: [], name: wallet.name })
        }
    }
    console.log("Wallet Count: ", realWallets.length)
    return realWallets
}