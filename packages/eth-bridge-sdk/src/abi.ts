import { parseAbi } from "viem"

export const ethereumZekoBridgeAbi = parseAbi([
	"function depositETH(uint256 zekoRecipient) payable returns (uint64 nonce, bytes32 depositLeaf, bytes32 newDepositState)",
	"function claimNativeWithdrawal(uint64 settlementSequence, uint32 offset, address recipient, uint64 amount, bytes32 actionFieldsHash, bytes32[16] merkleProof)",
	"event BridgeDeposit(uint64 indexed nonce, bytes32 indexed depositLeaf, bytes32 indexed newDepositState, bytes32 oldDepositState, address token, address sender, uint256 zekoRecipient, uint256 amount, uint256 zekoAmount, uint64 timeout)"
])
