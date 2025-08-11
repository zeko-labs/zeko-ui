import { AccountUpdate, Bool, Mina, PrivateKey, type PublicKey, UInt64 } from "o1js"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { Faucet, type FaucetClaimEvent, type FaucetDepositEvent } from "../zkapp"

describe("Faucet Contract", () => {
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
		const createTestAccount = (n: number) => ({
			privateKey: Local.testAccounts[n].key,
			publicKey: Local.testAccounts[n]
		})
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

	describe("Deploy", () => {
		it("should deploy the contract with correct initial state", async () => {
			const faucetAmount = UInt64.from(100 * 10 ** 9)

			const txn = await Mina.transaction(deployerAccount, async () => {
				AccountUpdate.fundNewAccount(deployerAccount, 1)
				await zkFaucet.deploy({ amount: faucetAmount })
			})
			await txn.prove()
			await txn.sign([deployerKey, zkFaucetPrivateKey]).send()

			const amount = zkFaucet.amount.get()
			expect(amount).toEqual(faucetAmount)
		})

		it("should fail to deploy with zero amount", async () => {
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

	describe("Deposit", () => {
		beforeEach(async () => {
			const faucetAmount = UInt64.from(1000)

			const txn = await Mina.transaction(deployerAccount, async () => {
				AccountUpdate.fundNewAccount(deployerAccount, 1)
				await zkFaucet.deploy({ amount: faucetAmount })
			})
			await txn.prove()
			await txn.sign([deployerKey, zkFaucetPrivateKey]).send()
		})

		it("should allow deposits and emit deposit event", async () => {
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
			const depositEvents = events.filter((e) => e.type === "deposit")
			expect(depositEvents).toHaveLength(1)
			const event = depositEvents[0].event.data as unknown as FaucetDepositEvent
			expect(event.depositor.toBase58()).toEqual(senderAccount.toBase58())
			expect(event.amount).toEqual(depositAmount)
		})

		it("should fail to deposit zero amount", async () => {
			await expect(async () => {
				const txn = await Mina.transaction(senderAccount, async () => {
					await zkFaucet.deposit(UInt64.zero)
				})
				await txn.prove()
				await txn.sign([senderKey]).send()
			}).rejects.toThrow()
		})
	})

	describe("Claim", () => {
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

		it("should allow first-time claim and emit claim event", async () => {
			const initialUserBalance = Mina.getBalance(user1Account)
			const claimAmount = UInt64.from(100 * 10 ** 9)

			const txn = await Mina.transaction(user1Account, async () => {
				AccountUpdate.fundNewAccount(user1Account)
				await zkFaucet.claim(user1Account)
			})
			await txn.prove()
			await txn.sign([user1Key]).send()
			const finalUserBalance = Mina.getBalance(user1Account)
			// Check that the final balance is greater after paying fees
			expect(finalUserBalance.toBigInt() - initialUserBalance.toBigInt()).toBeGreaterThan(0)

			// Check for claim event
			const events = await zkFaucet.fetchEvents()
			const claimEvents = events.filter((e) => e.type === "claim")
			expect(claimEvents).toHaveLength(1)

			const event = claimEvents[0].event.data as unknown as FaucetClaimEvent
			expect(event.claimer.toBase58()).toEqual(user1Account.toBase58())
			expect(event.amount).toEqual(claimAmount)
		})

		it("should prevent double claiming from same user", async () => {
			// First claim should succeed
			const initialUserBalance = Mina.getBalance(user1Account)

			const firstTxn = await Mina.transaction(user1Account, async () => {
				AccountUpdate.fundNewAccount(user1Account)
				await zkFaucet.claim(user1Account)
			})
			await firstTxn.prove()
			await firstTxn.sign([user1Key]).send()
			const firstClaimUserBalance = Mina.getBalance(user1Account)

			await expect(async () => {
				const secondTxn = await Mina.transaction(user1Account, async () => {
					await zkFaucet.claim(user1Account)
				})
				await secondTxn.prove()
				await secondTxn.sign([user1Key]).send()
			}).rejects.toThrow()

			const secondClaimUserBalance = Mina.getBalance(user1Account)

			expect(secondClaimUserBalance.toBigInt()).toEqual(firstClaimUserBalance.toBigInt())
			expect(firstClaimUserBalance.toBigInt() - initialUserBalance.toBigInt()).toBeGreaterThan(0)

			// Check that both claims created events
			const events = await zkFaucet.fetchEvents()
			const claimEvents = events.filter((e) => e.type === "claim")
			expect(claimEvents).toHaveLength(1)
		})

		it("should allow different users to claim", async () => {
			const initialUser1Balance = Mina.getBalance(user1Account)
			const initialUser2Balance = Mina.getBalance(user2Account)

			// User 1 claims
			const txn1 = await Mina.transaction(user1Account, async () => {
				AccountUpdate.fundNewAccount(user1Account)
				await zkFaucet.claim(user1Account)
			})
			await txn1.prove()
			await txn1.sign([user1Key]).send()

			// User 2 claims
			const txn2 = await Mina.transaction(user2Account, async () => {
				AccountUpdate.fundNewAccount(user2Account)
				await zkFaucet.claim(user2Account)
			})
			await txn2.prove()
			await txn2.sign([user2Key]).send()

			const finalUser1Balance = Mina.getBalance(user1Account)
			const finalUser2Balance = Mina.getBalance(user2Account)

			expect(finalUser1Balance.toBigInt() - initialUser1Balance.toBigInt()).toBeGreaterThan(0)
			expect(finalUser2Balance.toBigInt() - initialUser2Balance.toBigInt()).toBeGreaterThan(0)

			// Check for both claim events
			const events = await zkFaucet.fetchEvents()
			const claimEvents = events.filter((e) => e.type === "claim")
			expect(claimEvents).toHaveLength(2)
		})

		it("should fail to claim when contract has insufficient balance", async () => {
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
					await newZkApp.claim(user1Account)
				})
				await txn.prove()
				await txn.sign([user1Key]).send()
			}).rejects.toThrow()
		})

		it("should prevent transfer of internal tracking token between users", async () => {
			// First, user1 claims to get the tracking token
			const claimTxn = await Mina.transaction(user1Account, async () => {
				AccountUpdate.fundNewAccount(user1Account)
				await zkFaucet.claim(user1Account)
			})
			await claimTxn.prove()
			await claimTxn.sign([user1Key]).send()

			// Verify user1 has the tracking token (balance = 1)
			const user1TokenBalance = Mina.getBalance(user1Account, zkFaucet.deriveTokenId())
			expect(user1TokenBalance).toEqual(UInt64.one)

			// Try to transfer the tracking token from user1 to user2 - this should fail
			// because the contract's approveBase method prevents any token operations
			await expect(async () => {
				const transferTxn = await Mina.transaction(user1Account, async () => {
					AccountUpdate.fundNewAccount(user1Account, 1) // Fund for new token account creation
					const user1Update = AccountUpdate.createSigned(user1Account, zkFaucet.deriveTokenId())
					const user2Update = AccountUpdate.create(user2Account, zkFaucet.deriveTokenId())

					user1Update.send({ to: user2Update, amount: UInt64.one })
					user2Update.account.isNew.requireEquals(Bool(true))
				})
				await transferTxn.prove()
				await transferTxn.sign([user1Key]).send()
			}).rejects.toThrow()

			// Verify balances remain unchanged after failed transfer
			const user1FinalTokenBalance = Mina.getBalance(user1Account, zkFaucet.deriveTokenId())

			expect(user1FinalTokenBalance).toEqual(UInt64.one)
		})

		it("should allow claiming on behalf of someone else", async () => {
			// user1 will claim on behalf of user2
			const initialUser2Balance = Mina.getBalance(user2Account)
			const claimAmount = UInt64.from(100 * 10 ** 9)

			// user1 initiates the transaction but claims for user2
			const txn = await Mina.transaction(user1Account, async () => {
				AccountUpdate.fundNewAccount(user1Account) // user1 pays for account creation
				await zkFaucet.claim(user2Account) // but user2 receives the funds
			})
			await txn.prove() //On the client`
			await txn.sign([user1Key]).send()

			// Check that user2 received the funds
			const finalUser2Balance = Mina.getBalance(user2Account)
			expect(finalUser2Balance.toBigInt() - initialUser2Balance.toBigInt()).toEqual(
				claimAmount.toBigInt()
			)

			// Verify user2 has the tracking token (to prevent double claims)
			const user2TokenBalance = Mina.getBalance(user2Account, zkFaucet.deriveTokenId())
			expect(user2TokenBalance).toEqual(UInt64.one)

			// Check for claim event with correct claimer
			const events = await zkFaucet.fetchEvents()
			const claimEvents = events.filter((e) => e.type === "claim")
			expect(claimEvents).toHaveLength(1)

			const event = claimEvents[0].event.data as unknown as FaucetClaimEvent
			expect(event.claimer.toBase58()).toEqual(user2Account.toBase58()) // Event should show user2 as claimer
			expect(event.amount).toEqual(claimAmount)
		})
	})

	describe("Contract Balance Transfer", () => {
		beforeEach(async () => {
			const faucetAmount = UInt64.from(100 * 10 ** 9)

			// Deploy contract
			const deployTxn = await Mina.transaction(deployerAccount, async () => {
				AccountUpdate.fundNewAccount(deployerAccount, 1)
				await zkFaucet.deploy({ amount: faucetAmount })
			})
			await deployTxn.prove()
			await deployTxn.sign([deployerKey, zkFaucetPrivateKey]).send()

			// Fund the contract with a substantial amount
			const depositAmount = UInt64.from(1000 * 10 ** 9)
			const depositTxn = await Mina.transaction(senderAccount, async () => {
				await zkFaucet.deposit(depositAmount)
			})
			await depositTxn.prove()
			await depositTxn.sign([senderKey]).send()
		})

		it("should transfer entire MINA balance to another wallet using contract private key", async () => {
			// Get initial balances
			const initialContractBalance = Mina.getBalance(zkFaucetAddress)
			const initialUser1Balance = Mina.getBalance(user1Account)

			// Transfer the entire contract balance to user1 using the contract's private key
			const txn = await Mina.transaction(deployerAccount, async () => {
				const contractUpdate = AccountUpdate.createSigned(zkFaucetAddress)

				// Transfer the entire balance (minus fees) to user1
				contractUpdate.send({ to: user1Account, amount: initialContractBalance })
			})
			await txn.prove()
			await txn.sign([deployerKey, zkFaucetPrivateKey]).send()

			// Verify the transfer
			const finalContractBalance = Mina.getBalance(zkFaucetAddress)
			const finalUser1Balance = Mina.getBalance(user1Account)

			// Contract should have zero balance (or minimal amount due to account minimum)
			expect(finalContractBalance.toBigInt()).toBeLessThan(initialContractBalance.toBigInt())

			// User1 should have received the transferred amount
			const transferredAmount = finalUser1Balance.sub(initialUser1Balance)
			expect(transferredAmount.toBigInt()).toBeGreaterThan(0)

			// The transferred amount should approximately equal the initial contract balance
			// (allowing for some difference due to fees and account minimums)
			expect(transferredAmount.toBigInt()).toBeGreaterThan(
				(initialContractBalance.toBigInt() * BigInt(90)) / BigInt(100)
			)
		})
	})

	describe("Update Amount", () => {
		beforeEach(async () => {
			const faucetAmount = UInt64.from(100 * 10 ** 9)

			// Deploy contract
			const deployTxn = await Mina.transaction(deployerAccount, async () => {
				AccountUpdate.fundNewAccount(deployerAccount, 1)
				await zkFaucet.deploy({ amount: faucetAmount })
			})
			await deployTxn.prove()
			await deployTxn.sign([deployerKey, zkFaucetPrivateKey]).send()
		})

		it("should allow contract owner to update amount using contract private key", async () => {
			const initialAmount = zkFaucet.amount.get()
			const newAmount = UInt64.from(200 * 10 ** 9)

			// Update amount using contract private key
			const txn = await Mina.transaction(zkFaucetAddress, async () => {
				await zkFaucet.updateAmount(newAmount)
			})
			await txn.prove()
			await txn.sign([zkFaucetPrivateKey]).send()

			// Verify the amount was updated
			const updatedAmount = zkFaucet.amount.get()
			expect(updatedAmount).toEqual(newAmount)
			expect(updatedAmount).not.toEqual(initialAmount)
		})

		it("should fail when non-owner tries to update amount", async () => {
			const newAmount = UInt64.from(200 * 10 ** 9)

			// Try to update amount from a different account (should fail)
			await expect(async () => {
				const txn = await Mina.transaction(user1Account, async () => {
					await zkFaucet.updateAmount(newAmount)
				})
				await txn.prove()
				await txn.sign([user1Key]).send()
			}).rejects.toThrow()

			// Verify the amount was not changed
			const unchangedAmount = zkFaucet.amount.get()
			expect(unchangedAmount).toEqual(UInt64.from(100 * 10 ** 9)) // Should still be the initial amount
		})

		it("should fail when trying to update amount to zero", async () => {
			await expect(async () => {
				const txn = await Mina.transaction(zkFaucetAddress, async () => {
					await zkFaucet.updateAmount(UInt64.zero)
				})
				await txn.prove()
				await txn.sign([zkFaucetPrivateKey]).send()
			}).rejects.toThrow()

			// Verify the amount was not changed
			const unchangedAmount = zkFaucet.amount.get()
			expect(unchangedAmount).toEqual(UInt64.from(100 * 10 ** 9)) // Should still be the initial amount
		})
	})
})
