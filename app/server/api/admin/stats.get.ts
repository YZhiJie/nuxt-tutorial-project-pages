import type { AdminStats } from '#shared/types/admin';
import { adminStatsService } from '../../services/admin';

// 管理后台概览：受 server/middleware/auth.ts 保护，错误统一走 data.error 信封
export default defineEventHandler(async (event): Promise<AdminStats> => {
    try {
        return await adminStatsService.getStats();
    } catch (error) {
        throw toApiError(event, error);
    }
});
