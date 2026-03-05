import { readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { $ } from "bun"

type SyncResult = {
	updated: string[]
}

const isMissingFileError = (error: unknown) =>
	typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"

const syncCargoManifestVersion = (cargoManifest: string, packageVersion: string) => {
	const lines = cargoManifest.split("\n")
	let inPackageSection = false

	for (const [index, line] of lines.entries()) {
		if (line.startsWith("[")) {
			inPackageSection = line === "[package]"
			continue
		}

		if (!inPackageSection || !line.startsWith("version = ")) {
			continue
		}

		const nextLine = `version = "${packageVersion}"`

		if (line === nextLine) {
			return {
				changed: false,
				manifest: cargoManifest
			}
		}

		lines[index] = nextLine

		return {
			changed: true,
			manifest: lines.join("\n")
		}
	}

	throw new Error("Unable to find a package version entry in Cargo.toml.")
}

export const syncCargoPackageVersions = async (packagesRoot = "packages"): Promise<SyncResult> => {
	const entries = await readdir(packagesRoot, { withFileTypes: true })
	const updated: string[] = []

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue
		}

		const packageDirectory = join(packagesRoot, entry.name)
		const packageJsonPath = join(packageDirectory, "package.json")
		const cargoTomlPath = join(packageDirectory, "Cargo.toml")

		let packageVersion = ""
		let cargoManifest = ""

		try {
			const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
				version?: string
			}
			packageVersion = typeof packageJson.version === "string" ? packageJson.version : ""
			cargoManifest = await readFile(cargoTomlPath, "utf8")
		} catch (error) {
			if (isMissingFileError(error)) {
				continue
			}

			throw error
		}

		if (!packageVersion) {
			throw new Error(`Unable to resolve package version for ${packageJsonPath}.`)
		}

		const result = syncCargoManifestVersion(cargoManifest, packageVersion)

		if (!result.changed) {
			continue
		}

		await writeFile(cargoTomlPath, result.manifest)
		updated.push(cargoTomlPath)
	}

	return { updated }
}

const main = async () => {
	const skipChangeset = process.argv.includes("--skip-changeset")

	if (!skipChangeset) {
		console.log("Running changeset version...")
		await $`pnpm changeset version`
	} else {
		console.log("Skipping changeset version...")
	}

	console.log("Syncing Cargo.toml package versions...")
	const { updated } = await syncCargoPackageVersions()

	if (updated.length === 0) {
		console.log("Cargo.toml files already match package.json versions.")
	} else {
		for (const path of updated) {
			console.log(`Updated ${path}`)
		}
	}

	console.log("Running format fix...")
	await $`pnpm exec dprint fmt --allow-no-files`
}

if (import.meta.main) {
	await main()
}
