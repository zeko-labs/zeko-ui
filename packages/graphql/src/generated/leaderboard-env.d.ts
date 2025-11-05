// dprint-ignore-file
/* eslint-disable */
/* prettier-ignore */

export type introspection_types = {
    'Boolean': unknown;
    'Int': unknown;
    'LeaderboardEntry': { kind: 'OBJECT'; name: 'LeaderboardEntry'; fields: { 'rank': { name: 'rank'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'score': { name: 'score'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'wallet': { name: 'wallet'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'LeaderboardInput': { kind: 'INPUT_OBJECT'; name: 'LeaderboardInput'; isOneOf: false; inputFields: [{ name: 'cursorScore'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; defaultValue: null }, { name: 'cursorWallet'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }, { name: 'searchWallet'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }]; };
    'LeaderboardResult': { kind: 'OBJECT'; name: 'LeaderboardResult'; fields: { 'entries': { name: 'entries'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'LeaderboardEntry'; ofType: null; }; }; }; } }; 'hasMore': { name: 'hasMore'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'total': { name: 'total'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'leaderboard': { name: 'leaderboard'; type: { kind: 'OBJECT'; name: 'LeaderboardResult'; ofType: null; } }; }; };
    'String': unknown;
};

/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  name: 'leaderboard';
  query: 'Query';
  mutation: never;
  subscription: never;
  types: introspection_types;
};

import * as gqlTada from 'gql.tada';
