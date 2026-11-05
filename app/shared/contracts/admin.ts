import type { AdminStats } from '../types/admin';

// 管理后台概览响应契约：该接口只有读操作，contract 层负责固定字段与响应形状
export type AdminStatsResponse = AdminStats;

/** 只输出契约声明的字段，避免 service 以后把内部字段一并漏给客户端 */
export function toAdminStatsResponse(stats: AdminStats): AdminStatsResponse {
    return {
        totalNotes: stats.totalNotes,
        totalTags: stats.totalTags,
        latestNoteAt: stats.latestNoteAt,
    };
}
