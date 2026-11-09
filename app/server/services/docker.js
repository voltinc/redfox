/* Docker Engine integration boundary.

   Redfox talks to the Docker Engine API over HTTP. Nothing here is simulated:
   if a host does not answer a ping, the caller gets a real error message and the
   interface reports the host as disconnected. Demonstration servers never reach
   this module. */
import http from 'node:http';

function request(server, apiPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const endpoint = server.docker_endpoint || '';
    let options;
    if (endpoint.startsWith('unix://')) {
      options = { socketPath: endpoint.replace('unix://', ''), path: apiPath, method, timeout: 4000 };
    } else if (endpoint.startsWith('tcp://') || endpoint.startsWith('http://')) {
      const target = new URL(endpoint.replace('tcp://', 'http://'));
      options = { hostname: target.hostname, port: target.port || 2375, path: apiPath, method, timeout: 4000 };
    } else {
      reject(new Error('No Docker endpoint configured for this server'));
      return;
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(new Error('Docker API request timed out after 4000ms')); });
    req.on('error', (error) => reject(error));
    req.end();
  });
}

export async function ping(server) {
  try {
    const res = await request(server, '/_ping');
    if (res.status !== 200) return { ok: false, error: `Docker API returned HTTP ${res.status}` };
    let version = null;
    try {
      const info = await request(server, '/version');
      version = JSON.parse(info.body)?.Version ?? null;
    } catch { /* version is optional */ }
    return { ok: true, version };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function listContainers(server) {
  try {
    const res = await request(server, '/v1.41/containers/json?all=1');
    if (res.status !== 200) return { ok: false, error: `Docker API returned HTTP ${res.status}`, containers: [] };
    const containers = JSON.parse(res.body).map((c) => ({
      id: c.Id?.slice(0, 12),
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      image: c.Image,
      status: c.State,
      ports: (c.Ports || []).map((p) => `${p.PublicPort ?? ''}->${p.PrivatePort}`).filter(Boolean).join(', '),
    }));
    return { ok: true, containers };
  } catch (error) {
    return { ok: false, error: error.message, containers: [] };
  }
}

export async function containerAction(server, containerName, action) {
  if (!['start', 'stop', 'restart'].includes(action)) throw new Error(`Unsupported container action: ${action}`);
  try {
    const res = await request(server, `/v1.41/containers/${encodeURIComponent(containerName)}/${action}`, 'POST');
    if (res.status >= 300) return { ok: false, error: `Docker API returned HTTP ${res.status}: ${res.body.slice(0, 200)}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
