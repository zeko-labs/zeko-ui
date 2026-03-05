import fs from "node:fs"
import path from "node:path"

const DEPENDENCY_SECTIONS = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies"
] as const

const parseList = (value: string) =>
	value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter(Boolean)

type CatalogMap = Record<string, string>

type PackageJson = {
	name?: string
	version?: string
	packageManager?: string
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
}

type ReadJsonResult = {
	raw: string
	value: PackageJson
}

type PrepareStandalonePackageOptions = {
	rootDir?: string
	packageDir: string
	projectId: string
	workspacePackages: string[]
	extraWorkspaceVersionSources: string[]
	pinDevCatalogVersions: boolean
}

export type CliOptions = {
	packageDir: string
	projectId: string
	workspacePackages: string[]
	extraWorkspaceVersionSources: string[]
	pinDevCatalogVersions: boolean
}

export const parseCliArgs = (argv: string[]): CliOptions => {
	const getArg = (name: string, fallback = "") => {
		const flag = `--${name}`
		for (let index = 0; index < argv.length; index += 1) {
			const part = argv[index]
			if (part === flag) {
				return argv[index + 1] ?? fallback
			}
			if (part.startsWith(`${flag}=`)) {
				return part.slice(flag.length + 1)
			}
		}
		return fallback
	}

	return {
		packageDir: getArg("package-dir"),
		projectId: getArg("project-id"),
		workspacePackages: parseList(getArg("workspace-packages", ".")),
		extraWorkspaceVersionSources: parseList(getArg("extra-workspace-version-sources")),
		pinDevCatalogVersions: getArg("pin-dev-catalog-versions", "true") !== "false"
	}
}

const ensureRequiredArgs = (options: CliOptions) => {
	if (!options.packageDir) {
		throw new Error("Missing required --package-dir")
	}

	if (!options.projectId) {
		throw new Error("Missing required --project-id")
	}
}

const readJson = (filePath: string): ReadJsonResult => {
	const raw = fs.readFileSync(filePath, "utf8")
	return { raw, value: JSON.parse(raw) as PackageJson }
}

const writeJson = (filePath: string, raw: string, value: PackageJson) => {
	const indent = raw.startsWith("{\n\t") ? "\t" : 2
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, indent)}\n`)
}

const parseCatalogs = (workspacePath: string) => {
	const workspaceRaw = fs.readFileSync(workspacePath, "utf8")
	const defaultCatalog: CatalogMap = {}
	const namedCatalogs: Record<string, CatalogMap> = {}
	let section = ""
	let activeCatalog = ""

	for (const line of workspaceRaw.split("\n")) {
		const trimmed = line.trim()

		if (trimmed === "catalog:") {
			section = "catalog"
			activeCatalog = ""
			continue
		}

		if (trimmed === "catalogs:") {
			section = "catalogs"
			activeCatalog = ""
			continue
		}

		if (/^\S/.test(line)) {
			section = ""
			activeCatalog = ""
			continue
		}

		if (section === "catalog") {
			const match = line.match(/^ {2}['"]?(.+?)['"]?:\s+(.+?)$/)
			if (!match) {
				continue
			}

			defaultCatalog[match[1].replace(/['"]$/g, "").trim()] = match[2]
				.replace(/^['"]|['"]$/g, "")
				.trim()
			continue
		}

		if (section === "catalogs") {
			const header = line.match(/^ {2}([^:\s]+):\s*$/)
			if (header) {
				activeCatalog = header[1]
				namedCatalogs[activeCatalog] = namedCatalogs[activeCatalog] ?? {}
				continue
			}

			if (!activeCatalog) {
				continue
			}

			const match = line.match(/^ {4}['"]?(.+?)['"]?:\s+(.+?)$/)
			if (!match) {
				continue
			}

			namedCatalogs[activeCatalog][match[1].replace(/['"]$/g, "").trim()] = match[2]
				.replace(/^['"]|['"]$/g, "")
				.trim()
		}
	}

	return { defaultCatalog, namedCatalogs }
}

const collectPackageJsonFiles = (rootDir: string) => {
	const files: string[] = []
	const ignoredDirs = new Set([".git", ".moon", "dist", "node_modules", "coverage"])
	const stack = [rootDir]

	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) {
			continue
		}

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!ignoredDirs.has(entry.name)) {
					stack.push(path.join(current, entry.name))
				}
				continue
			}

			if (entry.isFile() && entry.name === "package.json") {
				files.push(path.join(current, entry.name))
			}
		}
	}

	return files.sort((left, right) => left.localeCompare(right))
}

const resolveCatalogSpecifier = ({
	name,
	specifier,
	defaultCatalog,
	namedCatalogs
}: {
	name: string
	specifier: string
	defaultCatalog: CatalogMap
	namedCatalogs: Record<string, CatalogMap>
}) => {
	if (specifier === "catalog:") {
		const version = defaultCatalog[name]
		if (!version) {
			throw new Error(`Unable to resolve catalog specifier for ${name}`)
		}
		return version
	}

	if (!specifier.startsWith("catalog:")) {
		return specifier
	}

	const catalogName = specifier.slice("catalog:".length)
	if (!catalogName) {
		const version = defaultCatalog[name]
		if (!version) {
			throw new Error(`Unable to resolve unnamed catalog specifier for ${name}`)
		}
		return version
	}

	const version = namedCatalogs[catalogName]?.[name]
	if (!version) {
		throw new Error(`Unable to resolve ${specifier} for ${name}`)
	}

	return version
}

const resolveWorkspaceSpecifier = ({
	name,
	specifier,
	localVersions
}: {
	name: string
	specifier: string
	localVersions: Record<string, string>
}) => {
	if (!specifier.startsWith("workspace:")) {
		return specifier
	}

	const range = specifier.slice("workspace:".length).trim()
	const localVersion = localVersions[name]

	if (range === "^" || range === "~" || range === "*" || range === "") {
		if (!localVersion) {
			throw new Error(`Unable to resolve workspace version for ${name}`)
		}

		if (range === "^") {
			return `^${localVersion}`
		}

		if (range === "~") {
			return `~${localVersion}`
		}

		return localVersion
	}

	return range
}

const stripMonorepoDependsOn = (moonConfigPath: string) => {
	if (!fs.existsSync(moonConfigPath)) {
		return
	}

	const original = fs.readFileSync(moonConfigPath, "utf8")
	const lines = original.split("\n")
	const output: string[] = []
	let skippingDependsOnBlock = false
	let changed = false

	for (const line of lines) {
		if (!skippingDependsOnBlock && /^dependsOn:\s*$/.test(line)) {
			skippingDependsOnBlock = true
			changed = true
			continue
		}

		if (skippingDependsOnBlock) {
			if (/^\S/.test(line)) {
				skippingDependsOnBlock = false
			} else {
				continue
			}
		}

		output.push(line)
	}

	if (changed) {
		fs.writeFileSync(moonConfigPath, output.join("\n"))
	}
}

export const prepareStandalonePackage = (options: PrepareStandalonePackageOptions) => {
	const rootDir = options.rootDir ? path.resolve(options.rootDir) : process.cwd()
	const packageDir = path.resolve(rootDir, options.packageDir)

	const { defaultCatalog, namedCatalogs } = parseCatalogs(path.join(rootDir, "pnpm-workspace.yaml"))
	const targetPackageJsonFiles = collectPackageJsonFiles(packageDir)

	if (targetPackageJsonFiles.length === 0) {
		throw new Error(`No package.json files found in ${packageDir}`)
	}

	const localVersions: Record<string, string> = {}
	const versionSourceFiles = new Set([
		...targetPackageJsonFiles,
		...options.extraWorkspaceVersionSources.map((entry) => path.resolve(rootDir, entry))
	])

	for (const sourcePath of versionSourceFiles) {
		if (!fs.existsSync(sourcePath)) {
			throw new Error(`Workspace version source does not exist: ${sourcePath}`)
		}

		const { value } = readJson(sourcePath)
		if (typeof value.name === "string" && typeof value.version === "string") {
			localVersions[value.name] = value.version
		}
	}

	for (const filePath of targetPackageJsonFiles) {
		const { raw, value } = readJson(filePath)
		let changed = false

		for (const section of DEPENDENCY_SECTIONS) {
			const deps = value[section]
			if (!deps) {
				continue
			}

			for (const [name, specifier] of Object.entries(deps)) {
				let resolved = specifier
				let wasCatalogResolved = false

				if (specifier.startsWith("catalog:")) {
					resolved = resolveCatalogSpecifier({ name, specifier, defaultCatalog, namedCatalogs })
					wasCatalogResolved = true
				} else if (specifier.startsWith("workspace:")) {
					resolved = resolveWorkspaceSpecifier({ name, specifier, localVersions })
				}

				if (options.pinDevCatalogVersions && section === "devDependencies" && wasCatalogResolved) {
					resolved = resolved.replace(/^[~^]/, "")
				}

				if (resolved !== specifier) {
					deps[name] = resolved
					changed = true
				}
			}
		}

		if (changed) {
			writeJson(filePath, raw, value)
			console.log(`Resolved dependencies in ${path.relative(rootDir, filePath)}`)
		}
	}

	const rootPackageJsonPath = path.join(packageDir, "package.json")
	const rootPackageJson = readJson(rootPackageJsonPath)
	const rootRepoPackageManager = readJson(path.join(rootDir, "package.json")).value.packageManager

	if (typeof rootRepoPackageManager === "string" && rootRepoPackageManager.length > 0) {
		rootPackageJson.value.packageManager = rootRepoPackageManager
		writeJson(rootPackageJsonPath, rootPackageJson.raw, rootPackageJson.value)
		console.log(`Injected packageManager in ${path.relative(rootDir, rootPackageJsonPath)}`)
	}

	const pnpmWorkspaceYaml = `packages:\n${options.workspacePackages.map((entry) => `  - ${entry}`).join("\n")}\n`
	fs.writeFileSync(path.join(packageDir, "pnpm-workspace.yaml"), pnpmWorkspaceYaml)
	console.log(`Generated standalone pnpm-workspace.yaml in ${options.packageDir}`)

	const moonDir = path.join(packageDir, ".moon")
	fs.mkdirSync(moonDir, { recursive: true })

	const standaloneWorkspaceConfig = `# yaml-language-server: $schema=./cache/schemas/workspace.json

projects:
  ${options.projectId}: "."
`

	fs.writeFileSync(path.join(moonDir, "workspace.yml"), standaloneWorkspaceConfig)
	fs.copyFileSync(
		path.join(rootDir, ".moon", "toolchains.yml"),
		path.join(moonDir, "toolchains.yml")
	)
	console.log(`Generated standalone Moon config in ${path.relative(rootDir, moonDir)}`)

	stripMonorepoDependsOn(path.join(packageDir, "moon.yml"))
	console.log(`Prepared ${options.packageDir} for standalone sync`)
}

export const runFromCli = (argv: string[]) => {
	const parsed = parseCliArgs(argv)
	ensureRequiredArgs(parsed)
	prepareStandalonePackage({
		packageDir: parsed.packageDir,
		projectId: parsed.projectId,
		workspacePackages: parsed.workspacePackages,
		extraWorkspaceVersionSources: parsed.extraWorkspaceVersionSources,
		pinDevCatalogVersions: parsed.pinDevCatalogVersions
	})
}
