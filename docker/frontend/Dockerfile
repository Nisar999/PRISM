FROM node:22-alpine

WORKDIR /app

# Phase 1: placeholder frontend — UI not built yet
RUN echo '{"name":"prism-frontend","version":"0.1.0","scripts":{"start":"node server.js"}}' > package.json \
    && echo 'const http=require("http");const s=http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"application/json"});r.end(JSON.stringify({status:"placeholder",message:"PRISM OS frontend — Phase 2"}));});s.listen(3000,()=>console.log("PRISM placeholder on :3000"));' > server.js

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
