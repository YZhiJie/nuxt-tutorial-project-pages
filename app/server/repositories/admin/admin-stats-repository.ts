import type { AdminStatsRepository } from '../../services/admin/admin-stats-service';

// 复用 notes 域已有的存储实现，admin 只做只读适配
export const adminStatsRepository: AdminStatsRepository = {
    listNotes: () => listNotes(),
};
