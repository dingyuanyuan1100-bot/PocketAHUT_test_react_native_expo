/**
 * API 层统一出口。
 *
 * ⚠️ 页面 / hooks 请优先从具体模块导入（`../api/endpoints/jwxt`），
 * 这样依赖关系清晰、也便于以后做代码分割；本文件主要用于聚合暴露。
 */
export * from './config';
export * from './contracts';
export * from './client';

// —— 接口封装（按业务域）——
export * from './endpoints/auth';
export * from './endpoints/calendar';
export * from './endpoints/jwxt';
export * from './endpoints/campus';
export * from './endpoints/canteen';
export * from './endpoints/content';
export * from './endpoints/wise';
