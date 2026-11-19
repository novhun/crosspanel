export type ServerConfigSite = { domain: string; root: string; index: string; engine: string; projectType: string; target: string; proxyPath: string; port: string };

export function serverConfigPreview(site: ServerConfigSite) {
  const domain = site.domain || "example.com";
  if (site.engine === "Apache") {
    return `# Demo template only — not applied or syntax checked\n<VirtualHost *:${site.port}>\n  ServerName ${domain}\n${site.projectType === "Proxy Project" ? `  ProxyPreserveHost On\n  ProxyPass "${site.proxyPath}" "${site.target || "http://127.0.0.1:3000"}"\n  ProxyPassReverse "${site.proxyPath}" "${site.target || "http://127.0.0.1:3000"}"` : `  DocumentRoot "${site.root}"\n  DirectoryIndex ${site.index}`}\n</VirtualHost>`;
  }
  return `# Demo template only — not applied or syntax checked\nserver {\n  listen ${site.port};\n  server_name ${domain};\n${site.projectType === "Proxy Project" ? `  location ${site.proxyPath} {\n    proxy_pass ${site.target || "http://127.0.0.1:3000"};\n  }` : `  root "${site.root}";\n  index ${site.index};\n  location / {\n    try_files $uri $uri/ =404;\n  }`}\n}`;
}

export function validServerPort(port: string) {
  return /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;
}