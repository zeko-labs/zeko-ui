import { createServer } from "./server"

const port = Number(process.env.PORT) || 3000
const server = createServer()
server.listen(port)

console.log(`Indexer service running on port ${port}`)
console.log("Available routes:")
console.log(
	"POST /start  - Start the indexing loop (accepts startingBlock, intervalSeconds, maxRetries)"
)
console.log("POST /stop   - Stop the indexing loop")
console.log("GET  /status - Get current loop status")
console.log("POST /recalculate - Recalculate leaderboard points from actions")
console.log("POST /rebuild - Rebuild leaderboard from scratch")
console.log("POST /broadcast - Trigger distributor broadcast to all shards")
