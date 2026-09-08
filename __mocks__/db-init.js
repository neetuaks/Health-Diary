module.exports = {
  getDB: () => ({
    transaction: (fn, errCb, okCb) => {
      const tx = {
        executeSql: (_sql, _params, cb) => {
          const res = { rows: { length: 0, item: (_i) => ({}) } };
          if (cb) cb(null, res);
        }
      };
      try {
        fn(tx);
        if (okCb) okCb();
      } catch (e) {
        if (errCb) errCb(e);
      }
    }
  })
};
