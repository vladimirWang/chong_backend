exports.getPaginationValues = (
  { limit = 10, page = 1 } = { limit: 10, page: 1 }
) => {
  return {
    skip: (page - 1) * limit,
    take: limit * 1,
  };
};

exports.getWhereValues = (pairs) => {
  //   const whereValues = {
  //     ...(name ? { name: { contains: name } } : {}),
  //   };
  const res = Object.keys(pairs).reduce((a, c, i) => {
    const value = pairs[c];
    // 如果有value，就生成查询条件
    if (value) {
      a = {
        ...a,
        [c]: { contains: value },
      };
    }
    return a;
  }, {});
  return res;
};