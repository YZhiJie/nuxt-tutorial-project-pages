import { adminStatsRepository } from '../../repositories/admin/admin-stats-repository';
import { createAdminStatsService } from './admin-stats-service';

export const adminStatsService = createAdminStatsService(adminStatsRepository);
export { createAdminStatsService } from './admin-stats-service';
