import {
    Field,
    Mina,
    type PrivateKey,
    PublicKey,
} from 'o1js'
import { beforeEach, describe, expect, it } from 'vitest'

import { sendPayment } from '../faucet'
describe('Faucet Transaction', () => {
    const proofsEnabled = false
    let senderAccount: PublicKey
    let senderKey: PrivateKey
    let zkFaucetAddress: PublicKey
    let zkFaucetPrivateKey: PrivateKey
    let Local: Awaited<ReturnType<typeof Mina.LocalBlockchain>>
    beforeEach(async () => {
        Local = await Mina.LocalBlockchain()
        Mina.setActiveInstance(Local)
        const createTestAccount = (n: number) => ({ privateKey: Local.testAccounts[n].key, publicKey: Local.testAccounts[n] })
        // Get test accounts
        const faucet = createTestAccount(0)
        const sender = createTestAccount(1)
        // Set accounts
        senderAccount = sender.publicKey
        senderKey = sender.privateKey
        zkFaucetAddress = faucet.publicKey
        zkFaucetPrivateKey = faucet.privateKey
    })

    describe('Transaction', () => {

        it('should send a transaction with an event', async () => {
            const initialBalance = Mina.getBalance(senderAccount)
            const depositAmount = BigInt(10 * 1e9) // 10 MINA

            await sendPayment({
                address: senderAccount.toBase58(),
                privateKey: zkFaucetPrivateKey,
                amount: depositAmount,
                publicKey: zkFaucetAddress
            })

            const finalBalance = Mina.getBalance(senderAccount)
            expect(finalBalance.sub(initialBalance).toBigInt()).toEqual(depositAmount)

            // Check for deposit event
            const events = await Local.fetchEvents(zkFaucetAddress)
            expect(events).toHaveLength(1)
            const event = events[0].events[0].data as string[]
            console.log("Event data:", event)
            expect(event[0]).toBe('0') // Claim
            expect(event[1]).toBe('1') // EventId
            expect(PublicKey.fromFields([Field.from(event[2]), Field.from(event[3])]).toBase58()).toBe(senderAccount.toBase58()) // Claimer address
            expect(BigInt(event[4])).toEqual(depositAmount) // Amount
            console.dir(event, { depth: null })
        })
    })
})