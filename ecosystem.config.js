module.exports = {
  apps: [
    {
      name: "qloo-dish-fit",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3077",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
