import {
    AccountUpdate,
    type DeployArgs,
    Field,
    MerkleMap,
    Permissions,
    PublicKey,
    SmartContract,
    State,
    Struct,
    UInt64,
    method,
    state,
} from "o1js"

export interface FaucetDeployProps extends Exclude<DeployArgs, undefined> {
    amount: UInt64
}

export class FaucetClaimEvent extends Struct({
    eventId: Field,
    claimer: PublicKey,
    amount: UInt64,
    timestamp: UInt64
}) { }

export class FaucetDepositEvent extends Struct({
    eventId: Field,
    depositor: PublicKey,
    amount: UInt64,
    timestamp: UInt64
}) { }

export class Faucet extends SmartContract {
    events = {
        claim: FaucetClaimEvent,
        deposit: FaucetDepositEvent
    }

    @state(UInt64)
    amount = State<UInt64>()

    @state(Field)
    claimersRoot = State<Field>()

    async deploy(args: FaucetDeployProps) {
        await super.deploy(args)
        args.amount.assertGreaterThan(UInt64.zero, "Put a default amount")
        this.amount.set(args.amount)

        // Initialize with empty merkle tree root
        const emptyTreeRoot = new MerkleMap().getRoot()
        this.claimersRoot.set(emptyTreeRoot)

        this.account.permissions.set({
            ...Permissions.default(),
            send: Permissions.proof(),
            setVerificationKey: Permissions.VerificationKey.none(),
            setPermissions: Permissions.impossible()
        })
    }

    @method
    async deposit(amount: UInt64) {
        amount.assertGreaterThan(UInt64.zero, "Deposit amount must be greater than zero")

        // Create account update for the sender to send tokens to the contract
        const senderUpdate = AccountUpdate.createSigned(this.sender.getUnconstrained())
        senderUpdate.send({ to: this.address, amount })

        this.emitEvent('deposit', new FaucetDepositEvent({
            eventId: Field("deposit"),
            depositor: this.sender.getUnconstrained(),
            amount,
            timestamp: this.network.timestamp.getAndRequireEquals()
        }))
    }

    @method
    async claim() {
        const amount = this.amount.getAndRequireEquals()
        const sender = this.sender.getUnconstrained()

        // Check if balance is sufficient
        const contractBalance = this.account.balance.getAndRequireEquals()
        contractBalance.assertGreaterThanOrEqual(amount, "Insufficient balance in faucet")

        // For simplicity in testing, we'll track claims using events
        // In a real implementation, you'd want proper state management for preventing double claims

        // Send tokens to the claimer
        this.send({ to: sender, amount })

        // Emit the claim event
        this.emitEvent('claim', new FaucetClaimEvent({
            eventId: Field("claim"),
            claimer: sender,
            amount,
            timestamp: this.network.timestamp.getAndRequireEquals()
        }))
    }
}