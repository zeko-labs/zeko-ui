import { parseAbi } from "viem"

export const ethereumZekoBridgeAbi = parseAbi([
	"function depositETH(uint256 zekoRecipient) payable returns (uint64 nonce, bytes32 depositLeaf, bytes32 newDepositState)",
	"function submitDeposit(address token, uint256 amount, uint256 zekoRecipient) returns (uint64 nonce, bytes32 depositLeaf, bytes32 newDepositState)",
	"function proposeAsset((uint32 schemaVersion,uint32 registryIndex,bytes32 assetId,address ethereumToken,bytes32 tokenOwnerL2,bytes32 tokenIdL2,uint8 decimals,uint64 inventoryCap,bytes32 mftStandardVkId,bytes32 vaultPublicKey,bytes32 universalBridgeVkId) record) returns (bytes32 recordHash)",
	"function cancelLastPendingAsset(address token)",
	"function activateAsset(address token, bytes32 expectedRegistryRoot, uint32 expectedRegistryCount)",
	"function activateAssetFromBatch(address token, uint64 settlementSequence, bytes32 recordCommitment, bytes32[8] siblings)",
	"function assetRecord(address token) view returns ((uint32 schemaVersion,uint32 registryIndex,bytes32 assetId,address ethereumToken,bytes32 tokenOwnerL2,bytes32 tokenIdL2,uint8 decimals,uint64 inventoryCap,bytes32 mftStandardVkId,bytes32 vaultPublicKey,bytes32 universalBridgeVkId))",
	"function assetStatusByToken(address token) view returns (uint8)",
	"function proposedAssetCount() view returns (uint32)",
	"function canonicalTokenRegistered(address token) view returns (bool)",
	"function assetIdByToken(address token) view returns (bytes32)",
	"function zekoTokenOwnerByToken(address token) view returns (bytes32)",
	"function zekoTokenIdByToken(address token) view returns (bytes32)",
	"function depositCapByToken(address token) view returns (uint64)",
	"function allowedToken(address token) view returns (uint8 zekoDecimals, uint8 ethereumDecimals, bool allowed)",
	"function claimNativeWithdrawal(uint64 settlementSequence, uint32 offset, address recipient, uint64 amount, bytes32 actionFieldsHash, bytes32[16] merkleProof)",
	"function claimERC20Withdrawal(uint64 settlementSequence, uint32 offset, address token, address recipient, uint64 amount, bytes32 actionFieldsHash, bytes32[16] merkleProof)",
	"event BridgeDeposit(uint64 indexed nonce, bytes32 indexed depositLeaf, bytes32 indexed newDepositState, bytes32 oldDepositState, address token, address sender, uint256 zekoRecipient, uint256 amount, uint256 zekoAmount, uint64 timeout)"
])
