import * as spl from '@solana/spl-token';
import { AccountInfo, Keypair, PublicKey } from '@solana/web3.js';
import * as structs from './structs';
import { IPoolKeys } from './interfaces';
import * as afx from '../global'
import assert from 'assert';
import { Market } from '@project-serum/serum';
import { OPENBOOK_PROGRAM_ADDRESS } from '../uniconst';

const openbookProgram = new PublicKey(OPENBOOK_PROGRAM_ADDRESS);

async function getMarketInfo(marketId: PublicKey) {
  const connection = afx.web3Conn
  assert(connection)
  let reqs = 0;
  let marketInfo = await connection.getAccountInfo(marketId);
  reqs++;

  while (!marketInfo) {
    marketInfo = await connection.getAccountInfo(marketId);
    reqs++;
    if (marketInfo) {
      break;
    } else if (reqs > 20) {
      console.log(`Could not get market info..`);

      return null;
    }
  }

  return marketInfo;
}

async function getDecodedData(marketInfo: {
  executable?: boolean;
  owner?: PublicKey;
  lamports?: number;
  data: any;
  rentEpoch?: number | undefined;
}) {
  return Market.getLayout(openbookProgram).decode(marketInfo.data);
}

async function getMintData(mint: PublicKey) {
  const connection = afx.web3Conn
  assert(connection)
  return connection.getAccountInfo(mint);
}

async function getDecimals(mintData: AccountInfo<Buffer> | null) {
  if (!mintData) throw new Error('No mint data!');

  return structs.SPL_MINT_LAYOUT.decode(mintData.data).decimals;
}

async function getOwnerAta(mint: { toBuffer: () => Uint8Array | Buffer }, publicKey: PublicKey) {
  const foundAta = PublicKey.findProgramAddressSync(
    [publicKey.toBuffer(), spl.TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    spl.ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];

  return foundAta;
}

function getVaultSigner(marketId: { toBuffer: any }, marketDeco: { vaultSignerNonce: { toString: () => any } }) {
  const seeds = [marketId.toBuffer()];
  const seedsWithNonce = seeds.concat(Buffer.from([Number(marketDeco.vaultSignerNonce.toString())]), Buffer.alloc(7));

  return PublicKey.createProgramAddressSync(seedsWithNonce, openbookProgram);
}

export async function derivePoolKeys(marketId: PublicKey) {
  try {
    const marketInfo = await getMarketInfo(marketId);
    if (!marketInfo) return null;
    const marketDeco = await getDecodedData(marketInfo);
    const { baseMint } = marketDeco;
    const baseMintData = await getMintData(baseMint);
    const baseDecimals = await getDecimals(baseMintData);
    const { quoteMint } = marketDeco;
    const quoteMintData = await getMintData(quoteMint);
    const quoteDecimals = await getDecimals(quoteMintData);
    const authority = PublicKey.findProgramAddressSync(
      [Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])],
      afx.RayLiqPoolv4
    )[0];
  
    const marketAuthority = getVaultSigner(marketId, marketDeco);
  
    // get/derive all the pool keys
    const poolKeys: IPoolKeys = {
      keg: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      version: 4,
      marketVersion: 3,
      programId: afx.RayLiqPoolv4,
      baseMint,
      quoteMint,
      baseDecimals,
      quoteDecimals,
      lpDecimals: baseDecimals,
      authority,
      marketAuthority,
      marketProgramId: openbookProgram,
      marketId,
      marketBids: marketDeco.bids,
      marketAsks: marketDeco.asks,
      marketQuoteVault: marketDeco.quoteVault,
      marketBaseVault: marketDeco.baseVault,
      marketEventQueue: marketDeco.eventQueue,
      id: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('amm_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      baseVault: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('coin_vault_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      coinVault: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('pc_vault_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      lpMint: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('lp_mint_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      lpVault: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('temp_lp_token_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      targetOrders: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('target_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      withdrawQueue: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('withdraw_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      openOrders: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('open_order_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      quoteVault: PublicKey.findProgramAddressSync(
        [afx.RayLiqPoolv4.toBuffer(), marketId.toBuffer(), Buffer.from('pc_vault_associated_seed', 'utf-8')],
        afx.RayLiqPoolv4
      )[0],
      lookupTableAccount: new PublicKey('11111111111111111111111111111111')
    };
  
    return poolKeys;
  } catch (error) {
    console.log("Get Poolkeys error:", error)
  }
  return null
}