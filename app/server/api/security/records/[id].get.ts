interface DemoRecord {
    id: number;
    title: string;
    amount: number;
    owner: string;
}

const RECORDS: DemoRecord[] = [
    { id: 1, title: 'Q3 财务预算', amount: 128000, owner: 'demo' },
    { id: 2, title: '招聘计划', amount: 46000, owner: 'alice' },
];

export default defineEventHandler((event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store');

    // 演示用请求头；真实项目必须从服务端会话读取用户
    const viewer = getHeader(event, 'x-demo-user')?.trim().toLowerCase();

    if (!viewer) {
        throw createError({ statusCode: 401, message: '缺少身份标识' });
    }

    const id = Number(getRouterParam(event, 'id'));
    const record = RECORDS.find((item) => item.id === id);

    if (!record) {
        throw createError({ statusCode: 404, message: '记录不存在' });
    }

    // 对象级授权：admin 可读全部，其他用户只能读自己的记录
    if (viewer !== 'admin' && record.owner !== viewer) {
        throw createError({ statusCode: 403, message: '无权访问该记录' });
    }

    return {
        viewer,
        record,
    };
});
