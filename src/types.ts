import { Field, NetworkId, PublicKey, UInt32, UInt64 } from "o1js";

export type Config = {
  l1Url: string;
  l1ArchiveUrl: string;
  zekoUrl: string;
  l1Network: NetworkId;
  l2Network: NetworkId;
  pollTimeout?: number;
};

export type Action = {
  action: Field[];
  beforeActionState: Field;
  afterActionState: Field;
};

export type OuterWitness = {
  type: "witness";
  aux: Field;
  action: Action;
};

export type OuterCommit = {
  type: "commit";
  action: Action;
};

export type OuterAction = OuterWitness | OuterCommit;

export type Deposit = {
  recipient: PublicKey;
  amount: UInt64;
  timeout: UInt32;
  holderAccountL1: PublicKey;
};

export type Account = {
  zkappState?: string[];
};
