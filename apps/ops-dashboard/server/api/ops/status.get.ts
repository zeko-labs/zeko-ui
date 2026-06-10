import { createOpsSnapshot, resolveOpsNetwork } from "../../utils/ops"

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	return createOpsSnapshot(resolveOpsNetwork(query.network))
})
