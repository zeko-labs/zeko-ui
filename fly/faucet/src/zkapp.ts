import {
    AccountUpdate,
    Field,
    Permissions,
    PublicKey,
    State,
    Struct,
    TokenContract,
    UInt64,
    method,
    state,
} from "o1js"

import type { AccountUpdateForest, DeployArgs } from "o1js"

export interface FaucetDeployProps extends Exclude<DeployArgs, undefined> {
    amount: UInt64
}

export class FaucetClaimEvent extends Struct({
    eventId: Field,
    claimer: PublicKey,
    amount: UInt64,
}) { }

export class FaucetDepositEvent extends Struct({
    eventId: Field,
    depositor: PublicKey,
    amount: UInt64,
}) { }

export class Faucet extends TokenContract {
    @state(UInt64) amount = State<UInt64>()
    @state(Field) totalClaims = State<Field>()

    events = {
        claim: FaucetClaimEvent,
        deposit: FaucetDepositEvent
    }
    async approveBase(forest: AccountUpdateForest) {
        forest.isEmpty().assertTrue("You can't approve any token operation")
    }

    async deploy(args: FaucetDeployProps) {
        await super.deploy()
        args.amount.assertGreaterThan(UInt64.zero, "Put a default amount")
        this.amount.set(args.amount)

        this.totalClaims.set(Field(0))

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
            eventId: Field(0),
            depositor: this.sender.getUnconstrained(),
            amount,
        }))
    }

    @method
    async claim() {
        const amount = this.amount.getAndRequireEquals()
        const sender = this.sender.getUnconstrained()

        // Check if balance of MINA is sufficient
        const contractBalance = this.account.balance.getAndRequireEquals()
        contractBalance.assertGreaterThanOrEqual(amount, "Insufficient balance in faucet")

        // Check if the tracking token balance of the sender is 0
        const senderToken = AccountUpdate.create(sender, this.deriveTokenId())
        senderToken.account.balance.requireEquals(UInt64.zero)
        // Update total claims counter
        const currentClaims = this.totalClaims.getAndRequireEquals()
        this.totalClaims.set(currentClaims.add(1))

        // Send MINA tokens to the claimer
        this.send({ to: sender, amount }) // This uses the standard MINA balance

        // If the user hasn't claimed, mint 1 unit of *this contract's own custom token* to their account
        this.internal.mint({ address: sender, amount: UInt64.one })

        // Emit the claim event - use a simple counter as timestamp
        this.emitEventIf(senderToken.account.balance.get().equals(UInt64.zero), 'claim', new FaucetClaimEvent({
            eventId: Field(1),
            claimer: sender,
            amount: amount,
        }))
    }
}