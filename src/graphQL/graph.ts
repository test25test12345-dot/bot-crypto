import { gql, GraphQLClient } from "graphql-request";

const graphQLClient = new GraphQLClient(process.env.MAINNET_GRAPH_QL as string, {
    method: `POST`,
    jsonSerializer: {
        parse: JSON.parse,
        stringify: JSON.stringify,
    },
});

export async function queryLpMintInfo(token: string, sol: string) {
    // See how we are only querying what we need
    const query = gql`
      query MyQuery ($where: Raydium_LiquidityPoolv4_bool_exp) {
    Raydium_LiquidityPoolv4(
      where: $where
    ) {
      baseMint
      lpMint
      lpReserve
      baseVault
      poolOpenTime
      lpVault
      quoteMint
      quoteVault
      baseDecimal
      owner
      pubkey
      marketId
    }
  }`;

    const variables = {
        where: {
            baseMint: {
                _eq: token,
            },
            quoteMint: {
                _eq: sol,
            },
        },
    };

    return await graphQLClient.request(query, variables);
}