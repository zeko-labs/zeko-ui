import path from "node:path"
import { fileURLToPath } from "node:url"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const packageRoot = path.resolve(currentDir, "..")
export const repoRoot = path.resolve(packageRoot, "..", "..")
export const skillRoot = path.join(packageRoot, "zeko")
export const skillPath = path.join(skillRoot, "SKILL.md")
export const referencesDir = path.join(skillRoot, "references")
