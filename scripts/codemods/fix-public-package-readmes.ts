#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs"

const rewrite = ({
	path,
	replacements
}: {
	path: string
	replacements: Array<readonly [string, string]>
}) => {
	const original = readFileSync(path, "utf8")
	const updated = replacements.reduce(
		(content, [from, to]) => content.replaceAll(from, to),
		original
	)

	if (updated !== original) {
		writeFileSync(path, updated)
		console.log(`Updated ${path}`)
	}
}

rewrite({
	path: "packages/bridge-sdk/README.md",
	replacements: [
		[
			"Run all commands from the monorepo root with Moon:",
			"These commands are maintainer workflows and only run from the private zeko-ui monorepo.\n\nRun all commands from the monorepo root with Moon:"
		],
		[
			"To refresh the generated GraphQL schema types used by the package:",
			"This schema refresh command is not available in the standalone bridge-sdk mirror.\n\nTo refresh the generated GraphQL schema types used by the package:"
		],
		["moon bridge-sdk:build", "moon run bridge-sdk:build"],
		["moon bridge-sdk:typecheck", "moon run bridge-sdk:typecheck"],
		["moon graphql:schema-get", "moon run graphql:schema-get"],
		["moon bridge-sdk:submitDeposit", "moon run bridge-sdk:submitDeposit"],
		["moon bridge-sdk:finalizeDeposit", "moon run bridge-sdk:finalizeDeposit"],
		["moon bridge-sdk:submitWithdrawal", "moon run bridge-sdk:submitWithdrawal"],
		["moon bridge-sdk:finalizeWithdrawal", "moon run bridge-sdk:finalizeWithdrawal"],
		["moon bridge-sdk:fetchOuterActions", "moon run bridge-sdk:fetchOuterActions"],
		["moon bridge-sdk:fetchInnerActions", "moon run bridge-sdk:fetchInnerActions"]
	]
})

rewrite({
	path: "packages/graphql/README.md",
	replacements: [
		[
			"Run all commands from the monorepo root with Moon:",
			"These commands are maintainer workflows and only run from the private zeko-ui monorepo.\n\nRun all commands from the monorepo root with Moon:"
		],
		[
			"Use the schema refresh tasks when GraphQL schemas change:",
			"These schema refresh tasks are maintainer workflows, and some of them depend on internal monorepo schemas.\n\nUse the schema refresh tasks when GraphQL schemas change:"
		],
		["moon graphql:build", "moon run graphql:build"],
		["moon graphql:typecheck", "moon run graphql:typecheck"],
		["moon graphql:schema-get", "moon run graphql:schema-get"]
	]
})
