import {
    AccountUpdate,
    Mina,
    PrivateKey,
    type PublicKey,
    UInt64,
} from 'o1js'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { Faucet, type FaucetClaimEvent, type FaucetDepositEvent } from '../src/zkapp'

describe('Faucet Contract', () => {
    const proofsEnabled = false
    let deployerAccount: PublicKey
    let deployerKey: PrivateKey
    let senderAccount: PublicKey
    let senderKey: PrivateKey
    let user1Account: PublicKey
    let user1Key: PrivateKey
    let user2Account: PublicKey
    let user2Key: PrivateKey
    let zkFaucetAddress: PublicKey
    let zkFaucetPrivateKey: PrivateKey
    let zkFaucet: Faucet

    beforeAll(async () => {
        if (proofsEnabled) await Faucet.compile()
    })

    beforeEach(async () => {
        const Local = await Mina.LocalBlockchain({ proofsEnabled })
        Mina.setActiveInstance(Local)
        const createTestAccount = (n: number) => ({ privateKey: Local.testAccounts[n].key, publicKey: Local.testAccounts[n] })
        // Get test accounts
        const deployer = createTestAccount(0)
        const sender = createTestAccount(1)
        const user1 = createTestAccount(2)
        const user2 = createTestAccount(3)

        // Set accounts
        deployerAccount = deployer.publicKey
        deployerKey = deployer.privateKey
        senderAccount = sender.publicKey
        senderKey = sender.privateKey
        user1Account = user1.publicKey
        user1Key = user1.privateKey
        user2Account = user2.publicKey
        user2Key = user2.privateKey

        // Create zkFaucet account
        zkFaucetPrivateKey = PrivateKey.random()
        zkFaucetAddress = zkFaucetPrivateKey.toPublicKey()
        zkFaucet = new Faucet(zkFaucetAddress)
    })

    describe('Deploy', () => {
        it('should deploy the contract with correct initial state', async () => {
            const faucetAmount = UInt64.from(100 * 10 ** 9)

            const txn = await Mina.transaction(deployerAccount, async () => {
                AccountUpdate.fundNewAccount(deployerAccount, 1)
                await zkFaucet.deploy({ amount: faucetAmount })
            })
            await txn.prove()
            await txn.sign([deployerKey, zkFaucetPrivateKey]).send()

            const amount = zkFaucet.amount.get()
            expect(amount).toEqual(faucetAmount)

            const claimersRoot = zkFaucet.totalClaims.get()
            expect(claimersRoot).toBeDefined()
        })

        it('should fail to deploy with zero amount', async () => {
            await expect(async () => {
                const txn = await Mina.transaction(deployerAccount, async () => {
                    AccountUpdate.fundNewAccount(deployerAccount)
                    await zkFaucet.deploy({ amount: UInt64.zero })
                })
                await txn.prove()
                await txn.sign([deployerKey, zkFaucetPrivateKey]).send()
            }).rejects.toThrow()
        })
    })

    describe('Deposit', () => {
        beforeEach(async () => {
            const faucetAmount = UInt64.from(1000)

            const txn = await Mina.transaction(deployerAccount, async () => {
                AccountUpdate.fundNewAccount(deployerAccount, 1)
                await zkFaucet.deploy({ amount: faucetAmount })
            })
            await txn.prove()
            await txn.sign([deployerKey, zkFaucetPrivateKey]).send()
        })

        it('should allow deposits and emit deposit event', async () => {
            const depositAmount = UInt64.from(500)
            const initialBalance = Mina.getBalance(zkFaucetAddress)

            const txn = await Mina.transaction(senderAccount, async () => {
                await zkFaucet.deposit(depositAmount)
            })
            await txn.prove()
            await txn.sign([senderKey]).send()

            const finalBalance = Mina.getBalance(zkFaucetAddress)
            expect(finalBalance.sub(initialBalance)).toEqual(depositAmount)

            // Check for deposit event
            const events = await zkFaucet.fetchEvents()
            const depositEvents = events.filter(e => e.type === 'deposit')
            expect(depositEvents).toHaveLength(1)
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            const event = depositEvents[0].event.data as any as FaucetDepositEvent
            expect(event.depositor.toBase58()).toEqual(senderAccount.toBase58())
            expect(event.amount).toEqual(depositAmount)
        })

        it('should fail to deposit zero amount', async () => {
            await expect(async () => {
                const txn = await Mina.transaction(senderAccount, async () => {
                    await zkFaucet.deposit(UInt64.zero)
                })
                await txn.prove()
                await txn.sign([senderKey]).send()
            }).rejects.toThrow()
        })
    })

    describe('Claim', () => {
        beforeEach(async () => {
            const faucetAmount = UInt64.from(100 * 10 ** 9)

            // Deploy contract
            const deployTxn = await Mina.transaction(deployerAccount, async () => {
                AccountUpdate.fundNewAccount(deployerAccount, 1)
                await zkFaucet.deploy({ amount: faucetAmount })
            })
            await deployTxn.prove()
            await deployTxn.sign([deployerKey, zkFaucetPrivateKey]).send()

            // Fund the contract
            const depositAmount = UInt64.from(1000 * 10 ** 9)
            const depositTxn = await Mina.transaction(senderAccount, async () => {
                await zkFaucet.deposit(depositAmount)
            })
            await depositTxn.prove()
            await depositTxn.sign([senderKey]).send()
        })

        it('should allow first-time claim and emit claim event', async () => {
            const initialUserBalance = Mina.getBalance(user1Account)
            const claimAmount = UInt64.from(100 * 10 ** 9)

            const txn = await Mina.transaction(user1Account, async () => {
                AccountUpdate.fundNewAccount(user1Account)
                await zkFaucet.claim()
            })
            await txn.prove()
            await txn.sign([user1Key]).send()
            const finalUserBalance = Mina.getBalance(user1Account)
            // Check that the final balance is greater after paying fees
            expect(finalUserBalance.toBigInt() - initialUserBalance.toBigInt()).toBeGreaterThan(0)

            // Check for claim event
            const events = await zkFaucet.fetchEvents()
            const claimEvents = events.filter(e => e.type === 'claim')
            expect(claimEvents).toHaveLength(1)

            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            const event = claimEvents[0].event.data as any as FaucetClaimEvent
            expect(event.claimer.toBase58()).toEqual(user1Account.toBase58())
            expect(event.amount).toEqual(claimAmount)
        })

        it('should prevent double claiming from same user', async () => {
            // First claim should succeed
            const initialUserBalance = Mina.getBalance(user1Account)

            const firstTxn = await Mina.transaction(user1Account, async () => {
                AccountUpdate.fundNewAccount(user1Account)
                await zkFaucet.claim()
            })
            await firstTxn.prove()
            await firstTxn.sign([user1Key]).send()
            const firstClaimUserBalance = Mina.getBalance(user1Account)

            await expect(async () => {
                const secondTxn = await Mina.transaction(user1Account, async () => {
                    await zkFaucet.claim()
                })
                await secondTxn.prove()
                await secondTxn.sign([user1Key]).send()
            }).rejects.toThrow()

            const secondClaimUserBalance = Mina.getBalance(user1Account)

            console.log('Initial user balance:', initialUserBalance.toBigInt())
            console.log('First claim user balance:', firstClaimUserBalance.toBigInt())
            console.log('Second claim user balance:', secondClaimUserBalance.toBigInt())


            // Check that both claims created events
            const events = await zkFaucet.fetchEvents()
            const claimEvents = events.filter(e => e.type === 'claim')
            expect(claimEvents).toHaveLength(1)
        })

        it('should allow different users to claim', async () => {
            const initialUser1Balance = Mina.getBalance(user1Account)
            const initialUser2Balance = Mina.getBalance(user2Account)

            // User 1 claims
            const txn1 = await Mina.transaction(user1Account, async () => {
                AccountUpdate.fundNewAccount(user1Account)
                await zkFaucet.claim()
            })
            await txn1.prove()
            await txn1.sign([user1Key]).send()

            // User 2 claims
            const txn2 = await Mina.transaction(user2Account, async () => {
                AccountUpdate.fundNewAccount(user2Account)
                await zkFaucet.claim()
            })
            await txn2.prove()
            await txn2.sign([user2Key]).send()

            const finalUser1Balance = Mina.getBalance(user1Account)
            const finalUser2Balance = Mina.getBalance(user2Account)

            expect(finalUser1Balance.toBigInt() - initialUser1Balance.toBigInt()).toBeGreaterThan(0)
            expect(finalUser2Balance.toBigInt() - initialUser2Balance.toBigInt()).toBeGreaterThan(0)

            // Check for both claim events
            const events = await zkFaucet.fetchEvents()
            const claimEvents = events.filter(e => e.type === 'claim')
            expect(claimEvents).toHaveLength(2)
        })

        it('should fail to claim when contract has insufficient balance', async () => {
            // Deploy a new contract with small amount and no additional deposits
            const smallAmount = UInt64.from(100)
            const newZkAppPrivateKey = PrivateKey.random()
            const newZkAppAddress = newZkAppPrivateKey.toPublicKey()
            const newZkApp = new Faucet(newZkAppAddress)

            const deployTxn = await Mina.transaction(deployerAccount, async () => {
                AccountUpdate.fundNewAccount(deployerAccount, 1)
                await newZkApp.deploy({ amount: smallAmount })
            })
            await deployTxn.prove()
            await deployTxn.sign([deployerKey, newZkAppPrivateKey]).send()

            // Don't fund the contract, so it has zero balance but wants to give 100

            await expect(async () => {
                const txn = await Mina.transaction(user1Account, async () => {
                    await newZkApp.claim()
                })
                await txn.prove()
                await txn.sign([user1Key]).send()
            }).rejects.toThrow()
        })
    })

    // describe('State Management', () => {
    //     beforeEach(async () => {
    //         const faucetAmount = UInt64.from(1000)

    //         const txn = await Mina.transaction(deployerAccount, async () => {
    //             AccountUpdate.fundNewAccount(deployerAccount)
    //             zkFaucet.deploy({ amount: faucetAmount })
    //         })
    //         await txn.prove()
    //         await txn.sign([deployerKey, zkFaucetPrivateKey]).send()
    //     })

    //     it('should maintain correct state after multiple operations', async () => {
    //         const initialRoot = zkFaucet.claimersRoot.get()

    //         // Fund the contract
    //         const depositTxn = await Mina.transaction(senderAccount, async () => {
    //             zkFaucet.deposit(UInt64.from(5000))
    //         })
    //         await depositTxn.prove()
    //         await depositTxn.sign([senderKey]).send()

    //         // User claims
    //         const claimTxn = await Mina.transaction(user1Account, async () => {
    //             zkFaucet.claim()
    //         })
    //         await claimTxn.prove()
    //         await claimTxn.sign([user1Key]).send()

    //         const finalRoot = zkFaucet.claimersRoot.get()
    //         const amount = zkFaucet.amount.get()

    //         expect(finalRoot).not.toEqual(initialRoot) // Root should change after claim
    //         expect(amount).toEqual(UInt64.from(1000)) // Amount should remain the same
    //     })
    // })
})