// dprint-ignore-file
/* eslint-disable */
/* prettier-ignore */

export type introspection_types = {
    'Action': { kind: 'INTERFACE'; name: 'Action'; fields: { 'afterState': { name: 'afterState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'beforeState': { name: 'beforeState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'blockHeight': { name: 'blockHeight'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'fields': { name: 'fields'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; } }; 'index': { name: 'index'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'kind': { name: 'kind'; type: { kind: 'ENUM'; name: 'ActionKind'; ofType: null; } }; 'slotRangeLower': { name: 'slotRangeLower'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'slotRangeUpper': { name: 'slotRangeUpper'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'timestamp': { name: 'timestamp'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'txnHash': { name: 'txnHash'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; possibleTypes: 'Commit' | 'Witness'; };
    'ActionKind': { name: 'ActionKind'; enumValues: 'COMMIT' | 'WITNESS'; };
    'ActionUnion': { kind: 'UNION'; name: 'ActionUnion'; fields: {}; possibleTypes: 'Commit' | 'Witness'; };
    'ActionsInput': { kind: 'INPUT_OBJECT'; name: 'ActionsInput'; isOneOf: false; inputFields: [{ name: 'afterState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }, { name: 'beforeState'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'Boolean': unknown;
    'Commit': { kind: 'OBJECT'; name: 'Commit'; fields: { 'afterState': { name: 'afterState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'beforeState': { name: 'beforeState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'blockHeight': { name: 'blockHeight'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'fields': { name: 'fields'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; } }; 'index': { name: 'index'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'innerActionState': { name: 'innerActionState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'innerActionStateLength': { name: 'innerActionStateLength'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'kind': { name: 'kind'; type: { kind: 'ENUM'; name: 'ActionKind'; ofType: null; } }; 'ledger': { name: 'ledger'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'slotRangeLower': { name: 'slotRangeLower'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'slotRangeUpper': { name: 'slotRangeUpper'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'synchronizedOuterActionState': { name: 'synchronizedOuterActionState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'synchronizedOuterActionStateLength': { name: 'synchronizedOuterActionStateLength'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'timestamp': { name: 'timestamp'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'txnHash': { name: 'txnHash'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'CommitAsePastWithdrawalDelayResult': { kind: 'OBJECT'; name: 'CommitAsePastWithdrawalDelayResult'; fields: { 'ase': { name: 'ase'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'UNION'; name: 'ActionUnion'; ofType: null; }; }; } }; 'commit': { name: 'commit'; type: { kind: 'OBJECT'; name: 'Commit'; ofType: null; } }; }; };
    'Int': unknown;
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'actions': { name: 'actions'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'UNION'; name: 'ActionUnion'; ofType: null; }; }; } }; 'commitAsePastWithdrawalDelay': { name: 'commitAsePastWithdrawalDelay'; type: { kind: 'OBJECT'; name: 'CommitAsePastWithdrawalDelayResult'; ofType: null; } }; 'witnessesFromAuxes': { name: 'witnessesFromAuxes'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Witness'; ofType: null; }; }; } }; }; };
    'String': unknown;
    'Witness': { kind: 'OBJECT'; name: 'Witness'; fields: { 'afterState': { name: 'afterState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'aux': { name: 'aux'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'beforeState': { name: 'beforeState'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'blockHeight': { name: 'blockHeight'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'fields': { name: 'fields'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; } }; 'index': { name: 'index'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'kind': { name: 'kind'; type: { kind: 'ENUM'; name: 'ActionKind'; ofType: null; } }; 'slotRangeLower': { name: 'slotRangeLower'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'slotRangeUpper': { name: 'slotRangeUpper'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'timestamp': { name: 'timestamp'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'txnHash': { name: 'txnHash'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'WitnessesFromAuxesInput': { kind: 'INPUT_OBJECT'; name: 'WitnessesFromAuxesInput'; isOneOf: false; inputFields: [{ name: 'auxes'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; }; }; defaultValue: null }]; };
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
  name: 'bridge-indexer';
  query: 'Query';
  mutation: never;
  subscription: never;
  types: introspection_types;
};

import * as gqlTada from 'gql.tada';
