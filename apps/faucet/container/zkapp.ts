import {
    AccountUpdate,
    Field,
    Permissions,
    Provable,
    PublicKey,
    State,
    Struct,
    TokenContract,
    UInt32,
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
    currentSlot: UInt32,
}) { }

export class FaucetDepositEvent extends Struct({
    eventId: Field,
    depositor: PublicKey,
    amount: UInt64,
}) { }


async function getCurrentSlot() {
    const response = await fetch("https://api.minascan.io/node/devnet/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `
        query RuntimeConfig { runtimeConfig }
      `,
            variables: {}
        })
    })

    const { data: { runtimeConfig } } = await response.json()

    const currentTimestamp = Date.now() / 1000
    const forkSlot = runtimeConfig.proof.fork.global_slot_since_genesis
    const genesisTimestamp = Date.parse(runtimeConfig.genesis.genesis_state_timestamp) / 1000

    return UInt32.from(Math.floor(forkSlot + ((currentTimestamp - genesisTimestamp) / 180)))
}

export class Faucet extends TokenContract {
    @state(UInt64) amount = State<UInt64>()

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

        // Set the initial state of the contract
        this.amount.set(args.amount)

        // Set the permissions for the contract
        this.account.permissions.set({
            ...Permissions.default(),
            send: Permissions.proofOrSignature(),
            setVerificationKey: Permissions.VerificationKey.none(),
            setPermissions: Permissions.impossible()
        })
    }

    @method
    async deposit(amount: UInt64) {
        amount.assertGreaterThan(UInt64.zero, "Deposit amount must be greater than zero")
        const depositor = this.sender.getUnconstrained()
        // Create account update for the sender to send MINA to the contract
        const senderUpdate = AccountUpdate.createSigned(depositor)
        senderUpdate.send({ to: this.address, amount })

        this.emitEvent('deposit', new FaucetDepositEvent({
            eventId: Field(0),
            depositor,
            amount,
        }))
    }

    @method
    async claim(claimer: PublicKey) {
        const amount = this.amount.getAndRequireEquals()

        // Check if we have enough MINA
        const contractBalance = this.account.balance.getAndRequireEquals()
        contractBalance.assertGreaterThanOrEqual(amount, "Insufficient MINA balance in faucet")

        // Check if the tracking token balance of the claimer is 0 to prevent double claims
        const senderToken = AccountUpdate.create(claimer, this.deriveTokenId())
        senderToken.account.balance.requireEquals(UInt64.zero)

        // Send MINA tokens to the claimer
        this.send({ to: claimer, amount })

        // If the user hasn't claimed, mint 1 unit of the tracking token to their account
        this.internal.mint({ address: claimer, amount: UInt64.one })
        // currentSlot logic
        const currentSlot = await Provable.witnessAsync(UInt32, async () => await getCurrentSlot())
        this.network.globalSlotSinceGenesis.requireBetween(currentSlot, currentSlot.add(UInt32.from(100)))
        // Emit the claim event only if it's the first claim for the sender
        this.emitEventIf(senderToken.account.balance.get().equals(UInt64.zero), 'claim', new FaucetClaimEvent({
            eventId: Field(1),
            claimer,
            amount,
            currentSlot
        }))
    }

    @method
    async updateAmount(newAmount: UInt64) {
        newAmount.assertGreaterThan(UInt64.zero, "New amount must be greater than zero")

        // Only the contract itself can update the amount (requires contract private key)
        const sender = this.sender.getAndRequireSignature()
        sender.assertEquals(this.address)

        // Update the amount state
        this.amount.set(newAmount)
    }
}