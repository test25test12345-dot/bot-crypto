import { PublicKey } from '@solana/web3.js';
import { IPoolKeys } from './interfaces';
export declare function derivePoolKeys(marketId: PublicKey): Promise<IPoolKeys>;
