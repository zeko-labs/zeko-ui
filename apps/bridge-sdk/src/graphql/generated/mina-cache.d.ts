/* eslint-disable */
/* prettier-ignore */
import type { TadaDocumentNode, $tada } from 'gql.tada';
import type { introspection as minaArchiveSchema } from "./mina-archive-env.d"
import type { introspection as minaSchema } from "./mina-env.d"
import type { introspection as zekoSchema } from "./zeko-env.d"

declare module 'gql.tada' {
 interface setupCache {
    "\n  query FetchConfig {\n    circuitsConfig {\n      zekoL1\n      zekoL2\n      holderAccountsL1\n      holderAccountL2\n      helperTokenOwnerL1\n      chainL1\n      chainL2\n      withdrawalDelay\n    }\n  }\n":
      TadaDocumentNode<{ circuitsConfig: unknown; }, {}, void>;
  }
}
