// Cliente de la API Apps Script. POST text/plain = petición "simple", sin preflight CORS.
const API = {
  token: null,
  async call(action, data) {
    const res = await fetch(window.ES_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: this.token, data: data || {} })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error de servidor');
    return json.data;
  }
};
