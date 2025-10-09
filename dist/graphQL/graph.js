"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryLpMintInfo = queryLpMintInfo;
const graphql_request_1 = require("graphql-request");
const graphQLClient = new graphql_request_1.GraphQLClient(process.env.MAINNET_GRAPH_QL, {
    method: `POST`,
    jsonSerializer: {
        parse: JSON.parse,
        stringify: JSON.stringify,
    },
});
async function queryLpMintInfo(token, sol) {
    const query = (0, graphql_request_1.gql) `
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
//# sourceMappingURL=graph.js.map