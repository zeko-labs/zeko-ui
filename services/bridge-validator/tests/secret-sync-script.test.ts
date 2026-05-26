import { dirname, resolve } from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const script = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/push-secrets-from-env.sh"),
	"utf8"
)

describe("bridge-validator secret sync script", () => {
	it("maps required local values into Cloudflare Worker secrets", () => {
		expect(script).toContain('DEFAULT_ENV_FILE="${REPO_ROOT}/.env"')
		expect(script).toContain(
			'DEFAULT_WRANGLER_CONFIG="${REPO_ROOT}/services/bridge-validator/wrangler.jsonc"'
		)
		expect(script).toContain("ZEKO_BRIDGE_MINA_PRIVATE_KEY")
		expect(script).toContain('put_secret "WALLET_PRIVATE_KEY" "$resolved_wallet_private_key"')
		expect(script).toContain('require_secret "VALIDATOR_API_TOKEN"')
		expect(script).toContain('put_secret "VALIDATOR_API_TOKEN" "$VALIDATOR_API_TOKEN"')
	})
})
