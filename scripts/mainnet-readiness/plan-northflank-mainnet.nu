#!/usr/bin/env nu

def main [
	--execute
] {
	if $execute {
		error make { msg: "This helper is intentionally dry-run for review. Replace this guard only after PR review approves Northflank mutations." }
	}

	print "# Northflank mainnet/testnet pipeline plan"
	print "# Dry-run only. No commands were executed."
	print ""
	print "- Keep one Northflank project/template: northflank/actions-indexer/project.json"
	print "- Model the existing live deployment as testnet and serve it at testnet.indexer.actions.zeko.io"
	print "- Add a mainnet deployment service at indexer.actions.zeko.io"
	print "- Keep secrets externalized through secure Northflank values"
	print "- Mainnet L1_ARCHIVE_URL: https://api.minascan.io/archive/mainnet/v1/graphql"
	print "- Mainnet L2_ARCHIVE_URL: https://archive.mainnet.zeko.io/graphql"
	print "- Mainnet OUTER_PK/INNER_PK: B62qipwmBKAhWoDr19ydyM3jr2Cwr6rVnrWYUUfLam8oCWedPSem4aC"
	print ""
	print "# Exact CI invocation shape for running the Mainnet pipeline release flow:"
	print 'curl -fsS -X POST "https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/pipelines/${NORTHFLANK_PIPELINE_ID}/release-flows/${NORTHFLANK_STAGE:-Mainnet}/runs" \'
	print '  -H "Authorization: Bearer ${NORTHFLANK_API_TOKEN}" \'
	print '  -H "Content-Type: application/json" \'
	print '  --data "{\"name\":\"Bridge mainnet release ${GITHUB_RUN_NUMBER}\",\"description\":\"Triggered by ${GITHUB_REPOSITORY}@${GITHUB_SHA}\",\"arguments\":{\"BRANCH\":\"${GITHUB_REF_NAME:-main}\",\"SHA\":\"${GITHUB_SHA}\"}}"'
	print ""
	print "# Required CI environment:"
	print "- NORTHFLANK_API_TOKEN"
	print "- NORTHFLANK_PROJECT_ID"
	print "- NORTHFLANK_PIPELINE_ID"
	print "- optional NORTHFLANK_STAGE, default Mainnet"
	print "- GITHUB_REF_NAME"
	print "- GITHUB_SHA"
}
