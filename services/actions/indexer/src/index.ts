import { server } from "./server"

const port = Number(process.env.PORT) || 3600
server.listen(port)

console.log(`Actions Indexer running on port ${port}`)
console.log("Available routes:")
console.log("POST /start  - Start the indexing loop (accepts intervalSeconds)")
console.log("POST /stop   - Stop the indexing loop")
console.log("GET  /status - Get current loop status")
console.log("POST /rebuild - Rebuild actions table from archive")
