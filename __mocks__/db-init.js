module.exports = {
  getDB: () => ({
    runAsync: async (_sql, _params) => ({ changes: 0, lastInsertRowId: 0 }),
    getAllAsync: async (_sql, _params) => [],
    getFirstAsync: async (_sql, _params) => null,
    execAsync: async (_sql) => {}
  })
};
