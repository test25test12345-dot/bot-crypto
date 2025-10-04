module.exports = {
  apps: [{
    name: 'crypto-bot',
    script: 'src/index.ts',
    interpreter: 'node',
    interpreter_args: '-r ts-node/register',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    time: true,
    autorestart: true,
    max_memory_restart: '2G'
  }]
};
