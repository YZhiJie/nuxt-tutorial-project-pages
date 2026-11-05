// 登录用户实体：前后端共享
export interface AuthUser {
    name: string;
}

// 登录入参
export interface LoginInput {
    username: string;
    password: string;
}

// 当前登录态接口返回
export interface AuthState {
    user: AuthUser | null;
}

// 登录成功返回
export interface LoginResponse {
    user: AuthUser;
}
