import * as afx from './global.js'
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Types;
import * as utils from './utils'
import { IPoolKeys } from './poolkeys/interfaces.js';
import { PublicKey } from '@solana/web3.js';
import { wallets } from 'detection/config.js';
import { timeStamp } from 'console';
 
const User = mongoose.model('User', new mongoose.Schema({
  chatid: String,
  username: String,
  admin: Number,
  vip: Number,
  type: String,
  timestamp: Number,
}));

const Token = mongoose.model('Token', new mongoose.Schema({

  address: String,
  name: String,
  symbol: String,
  decimals: Number,
  description: String,
  logo: String,
  totalSupply: String,

}))

const Poolkeys = mongoose.model('Poolkeys', new mongoose.Schema({
  tokenAddress: String,
  poolkeys: Object,
  reverse: Number,
}))
const tokenType = new mongoose.Schema({
  mint:{type:String},
  type:{type:String},
  txTime: {type:String} ,
  inAmount: {type: Number}
})
const TrackWallet = mongoose.model('TrackWallet', new mongoose.Schema({
  wallet: String,
  name: String,
  tokens: {type:[tokenType]}  
}))

const walletType = new mongoose.Schema({
  address: {type:String},
  name: {type:String},
  type: {type:String},
  inAmount: {type: Number},
  txTime: {type: String}
})
const Position = mongoose.model('Position', new mongoose.Schema ({
  token: String,
  wallets: {type:[walletType]},
  old:Boolean,
  // firstTxTime: {
  //     type: Number,
  //     default: 0  
  //   },
  // secondTxTime: {
  //     type: Number,
  //     default: 0   
  // }
}))


export const init = () => {

  return new Promise(async (resolve: any, reject: any) => {

    mongoose.connect(`mongodb://localhost:27017/${process.env.DB_NAME}`)
      .then(() => {
        console.log(`Connected to MongoDB "${process.env.DB_NAME}"...`)

        resolve();
      })
      .catch(err => {
        console.error('Could not connect to MongoDB...', err)
        reject();
      });
  });
}

export const updateUser = (params: any) => {

  return new Promise(async (resolve, reject) => {
    User.findOne({ chatid: params.chatid }).then(async (user : any) => {

      if (!user) {
        user = new User();
      } 

      user.chatid = params.chatid
      user.username = params.username
      user.permit = params.permit
      user.type = params.type
      user.admin = params.admin
      user.vip = params.vip
      
      user.wallet = params.wallet
      user.pkey = params.pkey
      user.announce = params.announce
      user.minPos = params.minPos
      user.autoBuy = params.autoBuy
      user.autoBuyAmount = params.autoBuyAmount
      user.buyConfigLeft = params.buyConfigLeft
      user.buyConfigRight = params.buyConfigRight
      user.sellConfigLeft = params.sellConfigLeft
      user.sellConfigRight = params.sellConfigRight
      user.buySlippage = params.buySlippage
      user.sellSlippage = params.sellSlippage
      user.maxPriceImpact = params.maxPriceImpact
      user.mevProtect = params.mevProtect
      user.trxPriority = params.trxPriority
      user.trxPriorityAmount = params.trxPriorityAmount
      user.referredBy = params.referredBy
      user.referralCode = params.referralCode
      user.referredTimestamp = params.referredTimestamp

      await user.save();

      resolve(user);
    });
  });
}

export const removeUser = (params: any) => {
  return new Promise((resolve, reject) => {
    User.deleteOne({ chatid: params.chatid }).then(() => {
        resolve(true);
    });
  });
}

export async function selectUsers(params : any = {}) {

  return new Promise(async (resolve, reject) => {
    User.find(params).then(async (users) => {
      resolve(users);
    });
  });
}

export async function countUsers(params : any = {}) {

  return new Promise(async (resolve, reject) => {
    User.countDocuments(params).then(async (users) => {
      resolve(users);
    });
  });
}

export async function selectUser(params: any) {

  return new Promise(async (resolve, reject) => {
    User.findOne(params).then(async (user) => {
      resolve(user);
    });
  });
}

export async function selectallTokens(params: any) {
  return new Promise(async (resolve, reject) => {        
      Token.find(params).then(async (tokens) => {
          resolve(tokens);
      });
  });
}

export const saveToken = (params: any) => {

  return new Promise(async (resolve, reject) => {
    Token.findOne({ address: params.address }).then(async (token : any) => {

      if (!token) {
        token = new Token();
      } 

      token.address = params.address
      token.name = params.name
      token.symbol = params.symbol
      token.decimals = params.decimals
      token.description = params.description
      token.logo = params.logo
      token.totalSupply = params.totalSupply

      await token.save();

      resolve(token);
    });
  });
}

export const selectToken = (params: any) => {

  return new Promise(async (resolve, reject) => {
    Token.findOne({ address: params.address }).then(async (token : any) => {
      resolve(token);
    });
  });
}

export async function updatePoolkeys(tokenAddress: string, poolkeys: IPoolKeys, reverse: number) {
  return new Promise(async (resolve, reject) => {
    Poolkeys.findOne({ tokenAddress }).then(async (pool: any) => {

      if (!pool) {
        pool = new Poolkeys();
      }

      pool.tokenAddress = tokenAddress
      pool.poolkeys = {
        keg: poolkeys.keg?.toString(),
        version: poolkeys.version,
        marketVersion: poolkeys.marketVersion,
        programId: poolkeys.programId.toString(),
        baseMint: poolkeys.baseMint.toString(),
        quoteMint: poolkeys.quoteMint.toString(),
        baseDecimals: poolkeys.baseDecimals,
        quoteDecimals: poolkeys.quoteDecimals,
        lpDecimals: poolkeys.lpDecimals,
        authority: poolkeys.authority.toString(),
        marketAuthority: poolkeys.marketAuthority.toString(),
        marketProgramId: poolkeys.marketProgramId.toString(),
        marketId: poolkeys.marketId.toString(),
        marketBids: poolkeys.marketBids.toString(),
        marketAsks: poolkeys.marketAsks.toString(),
        marketQuoteVault: poolkeys.marketQuoteVault.toString(),
        marketBaseVault: poolkeys.marketBaseVault.toString(),
        marketEventQueue: poolkeys.marketEventQueue.toString(),
        id: poolkeys.id.toString(),
        baseVault: poolkeys.baseVault.toString(),
        coinVault: poolkeys.coinVault.toString(),
        lpMint: poolkeys.lpMint.toString(),
        lpVault: poolkeys.lpVault.toString(),
        targetOrders: poolkeys.targetOrders.toString(),
        withdrawQueue: poolkeys.withdrawQueue.toString(),
        openOrders: poolkeys.openOrders.toString(),
        quoteVault: poolkeys.quoteVault.toString(),
        lookupTableAccount: poolkeys.lookupTableAccount.toString(),
      }
      pool.reverse = reverse

      await pool.save();

      resolve(pool);
    });
  });
}

export async function selectPoolkeys(tokenAddress: string) {

  return new Promise(async (resolve, reject) => {
    Poolkeys.findOne({ tokenAddress }).then(async (data) => {
      if (data) {
        let poolkeys: IPoolKeys = {
          keg: new PublicKey(data?.poolkeys.keg),
          version: data?.poolkeys.version,
          marketVersion: data?.poolkeys.marketVersion,
          programId: new PublicKey(data?.poolkeys.programId),
          baseMint: new PublicKey(data?.poolkeys.baseMint),
          quoteMint: new PublicKey(data?.poolkeys.quoteMint),
          baseDecimals: data?.poolkeys.baseDecimals,
          quoteDecimals: data?.poolkeys.quoteDecimals,
          lpDecimals: data?.poolkeys.lpDecimals,
          authority: new PublicKey(data?.poolkeys.authority),
          marketAuthority: new PublicKey(data?.poolkeys.marketAuthority),
          marketProgramId: new PublicKey(data?.poolkeys.marketProgramId),
          marketId: new PublicKey(data?.poolkeys.marketId),
          marketBids: new PublicKey(data?.poolkeys.marketBids),
          marketAsks: new PublicKey(data?.poolkeys.marketAsks),
          marketQuoteVault: new PublicKey(data?.poolkeys.marketQuoteVault),
          marketBaseVault: new PublicKey(data?.poolkeys.marketBaseVault),
          marketEventQueue: new PublicKey(data?.poolkeys.marketEventQueue),
          id: new PublicKey(data?.poolkeys.id),
          baseVault: new PublicKey(data?.poolkeys.baseVault),
          coinVault: new PublicKey(data?.poolkeys.coinVault),
          lpMint: new PublicKey(data?.poolkeys.lpMint),
          lpVault: new PublicKey(data?.poolkeys.lpVault),
          targetOrders: new PublicKey(data?.poolkeys.targetOrders),
          withdrawQueue: new PublicKey(data?.poolkeys.withdrawQueue),
          openOrders: new PublicKey(data?.poolkeys.openOrders),
          quoteVault: new PublicKey(data?.poolkeys.quoteVault),
          lookupTableAccount: new PublicKey(data?.poolkeys.lookupTableAccount),
        }
        let result = { poolkeys, reverse: data.reverse }
        resolve(result);
      } else {
        resolve(data);
      }
    });
  });
}


// export const updateTrackPosition = (params: any) => {

//   return new Promise(async (resolve, reject) => {
//       Position.findOne({ token: params.token }).then(async (info : any) => {
//       console.log("2222222222222222222222")
//       if (!info) {
//         info = new Position();
//       } 
//       info.token = params.token
//       info.wallets = params.wallets
//       console.log("info======", info)
//       await info.save();

//       resolve(info);
//     });
//   });
// }

export const updateTrackPosition = (params: any) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Use findOneAndUpdate to find and update or create if not found
      const info = await Position.findOneAndUpdate(
        { token: params.token },  // Filter condition
        { 
          token: params.token,
          wallets: params.wallets,
          old:params.old          
        },  // Data to update
        { 
          new: true,           // Return the updated document
          upsert: true,        // Create a new document if not found
          runValidators: true  // Run validators on the update
        }
      );

      if (!info) {
        throw new Error('Failed to update or create wallet information');
      }

      // console.log("Updated info=======", info);
      resolve(info);
    } catch (error) {
      console.error("Error updating wallet:", error);
      reject(error);
    }
  });
};

export async function selectPositions(params : any = {}) {

  return new Promise(async (resolve, reject) => {
    Position.find(params).then(async (positions) => {
      resolve(positions);
    });
  });
}

export async function selectTrackPosition(params: any) {

  return new Promise(async (resolve, reject) => {
    Position.findOne(params).then(async (position) => {
      resolve(position);
    });
  });
}

export const removeTrackPosition = (params: any) => {
  return new Promise((resolve, reject) => {
    Position.deleteOne(params).then(() => {
        resolve(true);
    });
  });
}

export const removeAllWallets = () => {
  return new Promise((resolve, reject) => {
    TrackWallet.deleteMany({})  // Empty filter means delete all documents
      .then(() => {
        resolve(true);
      })
      .catch((error) => {
        reject(error);  // Reject if there's an error during deletion
      });
  });
};


// export const updateTrackWallet = (params: any) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       TrackWallet.findOne({ wallet: params.wallet }).then(async (info : any) => {

//         if (!info) {
//           info = new TrackWallet();
//         }
//         info.wallet = params.wallet
//         info.tokens = params.tokens
//         info.name = params.name

//         console.log("info=======", info)
//         await info.save();

//         resolve(info);
//       });
//     }
//     catch{      
//       console.log("token address")
//     }
//   }

// );
// }

export const updateTrackWallet = (params: any) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Use findOneAndUpdate to find and update or create if not found
      const info = await TrackWallet.findOneAndUpdate(
        { wallet: params.wallet },  // Filter condition
        { 
          wallet: params.wallet,
          tokens: params.tokens,
          name: params.name
        },  // Data to update
        { 
          new: true,           // Return the updated document
          upsert: true,        // Create a new document if not found
          runValidators: true  // Run validators on the update
        }
      );

      if (!info) {
        throw new Error('Failed to update or create wallet information');
      }

      // console.log("Updated info=======", info);
      resolve(info);
    } catch (error) {
      console.error("Error updating wallet:", error);
      reject(error);
    }
  });
};


export const removeTrackWallet = (params: any) => {
  return new Promise((resolve, reject) => {
    TrackWallet.deleteOne(params).then(() => {
        resolve(true);
    });
  });
}

export async function selectTrackWallets(params : any = {}) {

  return new Promise(async (resolve, reject) => {
    TrackWallet.find(params).then(async (wallets) => {
      resolve(wallets);
    });
  });
}

export async function selectTrackWallet(params: any) {

  return new Promise(async (resolve, reject) => {
    TrackWallet.findOne(params).then(async (wallet) => {
      resolve(wallet);
    });
  });
}