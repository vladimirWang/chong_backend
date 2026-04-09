/**
 * 与根应用 `app.state("anonymousUserId", …)` 一致。
 * 子路由需在同一条链上 `.state("anonymousUserId", …)` 才能推断出 store，占位值见 applicantRouter。
 */
export type AppElysiaStore = {
  anonymousUserId: number;
};
