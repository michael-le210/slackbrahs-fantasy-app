import { join } from "node:path";

import { sendFile, serveStatic } from "../utils/http.js";

export class PageController {
  constructor(config) {
    this.publicDir = config.publicDir;
    this.indexView = join(config.viewsDir, "index.html");
  }

  home({ res }) {
    return sendFile(res, this.indexView);
  }

  asset({ res, url }) {
    return serveStatic(res, this.publicDir, url.pathname);
  }
}
