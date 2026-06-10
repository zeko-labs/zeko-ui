import { createOpsSnapshot } from "../../utils/ops"

export default defineEventHandler(async () => createOpsSnapshot())
