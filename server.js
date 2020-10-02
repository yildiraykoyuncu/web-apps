const http = require('http');
const fs = require('fs');
const path = require('path');
const marked = require('./lib/marked.js');
const ghStyles = require('./lib/gh-markdown-style');

const PORT = process.env.PORT || 3000;
const LOG_DIRNAME = `server-logs`;
const LOG_DIR = path.join(__dirname, LOG_DIRNAME);
const LOG_PATH = path.join(LOG_DIR, `${(new Date()).toJSON().replace(/:/g, '_')}.txt`);
const LOGS_LIMIT = 20;

let cycles = 0;

if (fs.existsSync(LOG_DIR)) {
  const logs = fs.readdirSync(LOG_DIR);
  if (logs.length > LOGS_LIMIT) {
    console.log('--- clearing ' + (logs.length - LOGS_LIMIT) + ' old logs ---');
    for (let i = 0; i < logs.length - LOGS_LIMIT; i++) {
      const oldLog = path.join(LOG_DIR, logs[i]);
      fs.unlinkSync(oldLog);
    };
  };
} else {
  console.log(`--- creating ${LOG_DIRNAME} directory ---`);
  fs.mkdirSync(LOG_DIR);
}

const log = (msg) => {
  const cleanedMsg = msg.split(__dirname).join(' ... ');
  console.log(cleanedMsg);
  fs.appendFileSync(LOG_PATH, cleanedMsg + '\n');
};

const mime = {
  '.md': 'text/html',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// https://bigcodenerd.org/enable-cors-node-js-without-express/
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Max-Age": 2592000, // 30 days
  /** add other headers as per requirement */
};


console.log('\n--- launching server ---\n');

const handleRequest = (req, res) => {
  const cycle = ++cycles;

  const studyMode = req.headers.study
    ? JSON.stringify({ study: req.headers.study })
    : '';
  log(`${cycle}. req: ${req.method} ${req.url} ${studyMode}`);

  const reqUrlMinusParams = req.url.split('?')[0];

  const relPath = reqUrlMinusParams === '/'
    ? './README.md'
    : decodeURIComponent(reqUrlMinusParams);

  const requestedFilePath = path.normalize(path.join(__dirname, relPath));

  const extension = String(path.extname(relPath)).toLowerCase();
  const contentType = mime[extension] || 'application/octet-stream';

  const serveFile = (error, content) => {
    let logMsg = '';
    if (error) {
      if (error.code === 'ENOENT') {
        const html404 = `<!DOCTYPE html><html><head><title>404</title></head><body><h1>404: ${relPath}</h1></body></html>`;
        res.writeHead(404, Object.assign({}, headers, { 'Content-Type': 'text/html' }));
        res.end(html404, 'utf-8');
        logMsg = 'res: 404 ' + relPath;
      } else {
        const errMsg = `Server error: ${error.code} ..`;
        res.writeHead(500);
        res.end(errMsg);
        res.end();
        logMsg = errMsg;
      }
    } else {
      res.writeHead(200, Object.assign({}, headers, { 'Content-Type': contentType }));
      const finalContent = extension === '.md'
        ? `<!DOCTYPE html>\n` +
        `<html>\n` +
        `  <head>\n` +
        `    <title>${relPath}</title>\n` +
        `    <link rel="icon" href="./app/favicon.ico"  type="image/icon type">\n` +
        `    <style>${ghStyles}</style>\n` +
        `  </head>\n` +
        `  <body class='markdown-body'>\n` +
        `    ${marked(content.toString())}\n` +
        `  </body>\n` +
        `</html>`
        : content;

      res.end(finalContent, 'utf-8');
      logMsg = 'res: ' + relPath;
    };
    log(cycle + '. ' + logMsg);
  };

  fs.readFile(requestedFilePath, serveFile);

};

const listeningCB = (err) => {
  if (err) {
    log(err.stack);
  } else {
    log('Server running at http://localhost:' + PORT + '/');
  };
}

http
  .createServer(handleRequest)
  .listen(PORT, listeningCB);

process.on('exit', function onExit(code) {
  log('process.exit with code ' + code);
});

process.on('SIGINT', function onSIGINT() {
  log('\nstopping server ...');
  process.exit(0);
});

process.on('uncaughtException', function onUncaughtException(e) {
  log('- uncaughtException -\n' + e.stack);
  process.exit(99);
});
